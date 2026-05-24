from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.approvals.models import ApprovalRequest
from apps.common.models import (
    ApprovalActionType,
    ApprovalStatus,
    ImpactMethod,
    ResourcePartyType,
)
from apps.communities.models import Community
from apps.groups.models import Group
from apps.members.models import Member
from apps.resources.models import Resource


class ImpactApprovalApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="impact.user",
            password="test-password",
        )
        cls.admin_user = get_user_model().objects.create_superuser(
            username="admin.user",
            email="admin@example.com",
            password="test-password",
        )
        cls.community = Community.objects.create(name="Approvals One")
        cls.other_community = Community.objects.create(name="Approvals Two")
        cls.group = Group.objects.create(
            community=cls.community,
            code="GRP-AP1",
            name="Approval Group",
        )
        cls.other_group = Group.objects.create(
            community=cls.other_community,
            code="GRP-AP2",
            name="Other Group",
        )
        cls.member = Member.objects.create(
            community=cls.community,
            group=cls.group,
            first_name="Ivy",
            last_name="Impact",
        )
        cls.other_member = Member.objects.create(
            community=cls.other_community,
            group=cls.other_group,
            first_name="Ned",
            last_name="Other",
        )
        cls.resource = Resource.objects.create(
            community=cls.community,
            owner_type=ResourcePartyType.GROUP,
            owner_id=cls.group.id,
            name="Approval Resource",
        )
        cls.approval = ApprovalRequest.objects.create(
            community=cls.community,
            entity_type="resource",
            entity_id=cls.resource.id,
            action_type=ApprovalActionType.UPDATE,
            submitted_payload={"status": "active"},
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_impact_record_crud_endpoints(self):
        create_response = self.client.post(
            reverse("impact-record-list"),
            {
                "resource": self.resource.id,
                "beneficiary_type": ResourcePartyType.MEMBER,
                "beneficiary_id": self.member.id,
                "period_type": "monthly",
                "period_start": "2026-05-01",
                "period_end": "2026-05-31",
                "as_of_date": "2026-05-31",
                "beneficiary_count": 12,
                "household_count": 8,
                "member_count": 12,
                "institution_count": 0,
                "method": ImpactMethod.OBSERVED,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        list_response = self.client.get(reverse("impact-record-list"))
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertIn("results", list_response.data)

        record_id = create_response.data["id"]
        retrieve_response = self.client.get(
            reverse("impact-record-detail", kwargs={"pk": record_id})
        )
        self.assertEqual(retrieve_response.status_code, status.HTTP_200_OK)

        patch_response = self.client.patch(
            reverse("impact-record-detail", kwargs={"pk": record_id}),
            {"notes": "Updated impact notes"},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)

    def test_invalid_impact_record_beneficiary_is_rejected(self):
        response = self.client.post(
            reverse("impact-record-list"),
            {
                "resource": self.resource.id,
                "beneficiary_type": ResourcePartyType.MEMBER,
                "beneficiary_id": self.other_member.id,
                "as_of_date": "2026-05-31",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("beneficiary_id", response.data)

    def test_resource_impact_records_nested_endpoint(self):
        list_response = self.client.get(
            reverse("resource-impact-records", kwargs={"pk": self.resource.pk})
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)

        create_response = self.client.post(
            reverse("resource-impact-records", kwargs={"pk": self.resource.pk}),
            {
                "period_type": "monthly",
                "as_of_date": "2026-05-31",
                "beneficiary_count": 5,
                "method": ImpactMethod.ESTIMATED,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

    def test_approval_request_create_list_and_review_actions(self):
        create_response = self.client.post(
            reverse("approval-request-list"),
            {
                "community": self.community.id,
                "entity_type": "member",
                "entity_id": self.member.id,
                "action_type": ApprovalActionType.UPDATE,
                "submitted_payload": {"status": "inactive"},
                "diff_summary": {"status": ["active", "inactive"]},
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data["status"], ApprovalStatus.PENDING)

        list_response = self.client.get(reverse("approval-request-list"))
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertIn("results", list_response.data)

        self.client.force_authenticate(self.admin_user)
        approve_response = self.client.post(
            reverse("approval-request-approve", kwargs={"pk": self.approval.pk}),
            {"review_notes": "Looks good"},
            format="json",
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(approve_response.data["status"], ApprovalStatus.APPROVED)

        second_approval = ApprovalRequest.objects.create(
            community=self.community,
            entity_type="group",
            entity_id=self.group.id,
            action_type=ApprovalActionType.DELETE,
            submitted_payload={"id": self.group.id},
        )
        reject_response = self.client.post(
            reverse("approval-request-reject", kwargs={"pk": second_approval.pk}),
            {"review_notes": "Needs revision"},
            format="json",
        )
        self.assertEqual(reject_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reject_response.data["status"], ApprovalStatus.REJECTED)

    def test_approval_review_actions_require_admin(self):
        response = self.client.post(
            reverse("approval-request-approve", kwargs={"pk": self.approval.pk}),
            {"review_notes": "Nope"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
