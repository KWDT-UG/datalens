from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.approvals.models import ApprovalRequest
from apps.common.models import (
    ApprovalReviewScope,
    ApprovalStatus,
    ApprovalSubmissionSource,
    ResourcePartyType,
    UserRole,
)
from apps.common.permissions import assign_role
from apps.communities.models import Community
from apps.groups.models import Group
from apps.resources.models import Resource


class ApprovalPolicyTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.community = Community.objects.create(name="Policy Community")
        cls.group = Group.objects.create(
            community=cls.community,
            code="POLICY",
            name="Policy Group",
        )
        cls.resource = Resource.objects.create(
            community=cls.community,
            owner_type=ResourcePartyType.GROUP,
            owner_id=cls.group.id,
            name="Policy Resource",
        )

    def setUp(self):
        self.client = APIClient()

    def user_with_role(self, role):
        user = get_user_model().objects.create_user(
            username=f"{role}.{get_user_model().objects.count()}",
            password="test-password",
        )
        assign_role(user, role)
        return user

    def test_operational_updates_are_direct_but_archives_are_queued(self):
        field_officer = self.user_with_role(UserRole.FIELD_OFFICER)
        self.client.force_authenticate(field_officer)

        update_response = self.client.patch(
            reverse("group-detail", kwargs={"pk": self.group.pk}),
            {"meeting_day": "Thursday"},
            format="json",
        )
        archive_response = self.client.delete(
            reverse("group-detail", kwargs={"pk": self.group.pk})
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(archive_response.status_code, status.HTTP_202_ACCEPTED)
        self.group.refresh_from_db()
        self.assertEqual(self.group.meeting_day, "Thursday")
        self.assertFalse(self.group.is_deleted)
        self.assertEqual(
            archive_response.data["approval_request"]["review_scope"],
            ApprovalReviewScope.STANDARD,
        )

    def test_resource_change_is_queued_and_exposed_on_the_record(self):
        submitter = self.user_with_role(UserRole.RESOURCE_PROCUREMENT_OFFICER)
        reviewer = self.user_with_role(UserRole.PROGRAMME_MANAGER)
        self.client.force_authenticate(submitter)

        response = self.client.patch(
            reverse("resource-detail", kwargs={"pk": self.resource.pk}),
            {"name": "Proposed Resource Name"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        approval_id = response.data["approval_request"]["id"]
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.name, "Policy Resource")

        detail_response = self.client.get(
            reverse("resource-detail", kwargs={"pk": self.resource.pk})
        )
        self.assertEqual(
            detail_response.data["approval_status"],
            ApprovalStatus.PENDING,
        )
        self.assertEqual(
            detail_response.data["pending_approval_request_id"],
            approval_id,
        )
        self.assertEqual(detail_response.data["approval_history_count"], 1)

        self.client.force_authenticate(reviewer)
        approve_response = self.client.post(
            reverse("approval-request-approve", kwargs={"pk": approval_id}),
            {"review_notes": "Operational details verified."},
            format="json",
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.name, "Proposed Resource Name")

    def test_resource_value_change_requires_finance_review(self):
        submitter = self.user_with_role(UserRole.RESOURCE_PROCUREMENT_OFFICER)
        programme_reviewer = self.user_with_role(UserRole.PROGRAMME_MANAGER)
        finance_reviewer = self.user_with_role(UserRole.FINANCE_ADMINISTRATOR)
        self.client.force_authenticate(submitter)

        response = self.client.patch(
            reverse("resource-detail", kwargs={"pk": self.resource.pk}),
            {"value_amount": "250000.00", "value_currency": "UGX"},
            format="json",
        )
        approval = ApprovalRequest.objects.get(
            pk=response.data["approval_request"]["id"]
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(approval.review_scope, ApprovalReviewScope.FINANCE)

        self.client.force_authenticate(programme_reviewer)
        blocked_response = self.client.post(
            reverse("approval-request-approve", kwargs={"pk": approval.pk}),
            format="json",
        )
        self.assertEqual(blocked_response.status_code, status.HTTP_404_NOT_FOUND)

        self.client.force_authenticate(finance_reviewer)
        approve_response = self.client.post(
            reverse("approval-request-approve", kwargs={"pk": approval.pk}),
            {"review_notes": "Value checked against procurement records."},
            format="json",
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.resource.refresh_from_db()
        self.assertEqual(str(self.resource.value_amount), "250000.00")

    def test_impact_changes_route_to_monitoring_and_evaluation_review(self):
        submitter = self.user_with_role(UserRole.FIELD_OFFICER)
        reviewer = self.user_with_role(UserRole.MONITORING_EVALUATION_MANAGER)
        self.client.force_authenticate(submitter)

        response = self.client.post(
            reverse("impact-record-list"),
            {
                "resource": self.resource.id,
                "period_type": "monthly",
                "as_of_date": "2026-06-01",
                "beneficiary_count": 12,
            },
            format="json",
        )
        approval_id = response.data["approval_request"]["id"]

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(
            response.data["approval_request"]["review_scope"],
            ApprovalReviewScope.IMPACT,
        )

        self.client.force_authenticate(reviewer)
        approve_response = self.client.post(
            reverse("approval-request-approve", kwargs={"pk": approval_id}),
            format="json",
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.assertTrue(self.resource.impact_records.filter(is_deleted=False).exists())

    def test_offline_resource_change_is_queued_and_replay_is_idempotent(self):
        submitter = self.user_with_role(UserRole.RESOURCE_PROCUREMENT_OFFICER)
        self.client.force_authenticate(submitter)
        payload = {
            "changes": [
                {
                    "entity_type": "resource",
                    "id": self.resource.id,
                    "sync_version": self.resource.sync_version,
                    "client_mutation_id": "offline-resource-1",
                    "action": "update",
                    "payload": {"name": "Offline Proposed Name"},
                }
            ]
        }

        first_response = self.client.post(
            reverse("sync-push"),
            payload,
            format="json",
        )
        second_response = self.client.post(
            reverse("sync-push"),
            payload,
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(first_response.data["meta"]["applied"], 0)
        self.assertEqual(first_response.data["meta"]["pending_approval"], 1)
        first_item = first_response.data["data"]["accepted"][0]
        second_item = second_response.data["data"]["accepted"][0]
        self.assertEqual(first_item["status"], "pending_approval")
        self.assertEqual(
            first_item["approval_request"]["id"],
            second_item["approval_request"]["id"],
        )
        approval = ApprovalRequest.objects.get(pk=first_item["approval_request"]["id"])
        self.assertEqual(
            approval.submission_source,
            ApprovalSubmissionSource.OFFLINE_SYNC,
        )
        self.assertEqual(approval.base_sync_version, self.resource.sync_version)
        self.assertEqual(
            ApprovalRequest.objects.filter(
                client_mutation_id="offline-resource-1"
            ).count(),
            1,
        )
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.name, "Policy Resource")

    def test_approval_rejects_application_when_target_version_changed(self):
        submitter = self.user_with_role(UserRole.RESOURCE_PROCUREMENT_OFFICER)
        reviewer = self.user_with_role(UserRole.PROGRAMME_MANAGER)
        self.client.force_authenticate(submitter)
        response = self.client.patch(
            reverse("resource-detail", kwargs={"pk": self.resource.pk}),
            {"name": "Stale Proposed Name"},
            format="json",
        )
        approval_id = response.data["approval_request"]["id"]

        self.resource.name = "Newer Server Name"
        self.resource.sync_version += 1
        self.resource.save(update_fields=["name", "sync_version", "updated_at"])

        self.client.force_authenticate(reviewer)
        approve_response = self.client.post(
            reverse("approval-request-approve", kwargs={"pk": approval_id}),
            format="json",
        )

        self.assertEqual(approve_response.status_code, status.HTTP_409_CONFLICT)
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.name, "Newer Server Name")
        self.assertEqual(
            ApprovalRequest.objects.get(pk=approval_id).status,
            ApprovalStatus.PENDING,
        )

    def test_submitted_approval_request_is_immutable(self):
        submitter = self.user_with_role(UserRole.RESOURCE_PROCUREMENT_OFFICER)
        self.client.force_authenticate(submitter)
        response = self.client.patch(
            reverse("resource-detail", kwargs={"pk": self.resource.pk}),
            {"name": "Immutable Proposal"},
            format="json",
        )
        approval_id = response.data["approval_request"]["id"]

        edit_response = self.client.patch(
            reverse("approval-request-detail", kwargs={"pk": approval_id}),
            {"submitted_payload": {"name": "Changed Proposal"}},
            format="json",
        )

        self.assertEqual(
            edit_response.status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )
        self.assertEqual(
            ApprovalRequest.objects.get(pk=approval_id).submitted_payload,
            {"name": "Immutable Proposal"},
        )
