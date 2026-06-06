from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.approvals.models import ApprovalRequest
from apps.common.models import ApprovalActionType, ApprovalStatus, ResourcePartyType, UserRole
from apps.common.permissions import assign_role
from apps.communities.models import Community
from apps.groups.models import Group
from apps.resources.models import Resource


class PermissionApprovalSyncMilestoneTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.community = Community.objects.create(name="Milestone Community")
        cls.group = Group.objects.create(
            community=cls.community,
            code="GRP-M1",
            name="Milestone Group",
        )
        cls.resource = Resource.objects.create(
            community=cls.community,
            owner_type=ResourcePartyType.GROUP,
            owner_id=cls.group.id,
            name="Milestone Resource",
            status="planned",
        )

    def setUp(self):
        self.client = APIClient()

    def _user_with_role(self, role):
        user = get_user_model().objects.create_user(
            username=f"{role}.{get_user_model().objects.count()}",
            password="test-password",
        )
        assign_role(user, role)
        return user

    def test_role_action_matrix(self):
        cases = [
            {
                "role": UserRole.FIELD_OFFICER,
                "method": "get",
                "url": reverse("community-list"),
                "expected": status.HTTP_200_OK,
            },
            {
                "role": UserRole.FIELD_OFFICER,
                "method": "delete",
                "url": reverse("resource-detail", kwargs={"pk": self.resource.pk}),
                "expected": status.HTTP_403_FORBIDDEN,
            },
            {
                "role": UserRole.COMMUNICATIONS_VIEWER,
                "method": "get",
                "url": reverse("resource-list"),
                "expected": status.HTTP_200_OK,
            },
            {
                "role": UserRole.COMMUNICATIONS_VIEWER,
                "method": "post",
                "url": reverse("community-list"),
                "payload": {"name": "Read Only"},
                "expected": status.HTTP_403_FORBIDDEN,
            },
            {
                "role": UserRole.FINANCE_ADMINISTRATOR,
                "method": "post",
                "url": reverse("community-list"),
                "payload": {"name": "Finance Cannot Create Community"},
                "expected": status.HTTP_403_FORBIDDEN,
            },
            {
                "role": UserRole.RESOURCE_PROCUREMENT_OFFICER,
                "method": "patch",
                "url": reverse("resource-detail", kwargs={"pk": self.resource.pk}),
                "payload": {"name": "Procurement Update"},
                "expected": status.HTTP_200_OK,
            },
            {
                "role": UserRole.MONITORING_EVALUATION_MANAGER,
                "method": "patch",
                "url": reverse("resource-detail", kwargs={"pk": self.resource.pk}),
                "payload": {"name": "M&E Cannot Update Resource"},
                "expected": status.HTTP_403_FORBIDDEN,
            },
            {
                "role": UserRole.PROGRAMME_MANAGER,
                "method": "delete",
                "url": reverse("resource-detail", kwargs={"pk": self.resource.pk}),
                "expected": status.HTTP_204_NO_CONTENT,
            },
        ]

        for case in cases:
            with self.subTest(role=case["role"], method=case["method"]):
                user = self._user_with_role(case["role"])
                self.client.force_authenticate(user)
                response = getattr(self.client, case["method"])(
                    case["url"],
                    case.get("payload", {}),
                    format="json",
                )
                self.assertEqual(response.status_code, case["expected"])
                self.client.force_authenticate(None)

    def test_unassigned_and_staff_users_do_not_receive_implicit_product_access(self):
        cases = [
            {"username": "unassigned.user", "is_staff": False},
            {"username": "django.staff", "is_staff": True},
        ]

        for case in cases:
            with self.subTest(username=case["username"]):
                user = get_user_model().objects.create_user(
                    username=case["username"],
                    password="test-password",
                    is_staff=case["is_staff"],
                )
                self.client.force_authenticate(user)
                response = self.client.get(reverse("community-list"))
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_all_mvp_roles_enforce_domain_permissions(self):
        cases = [
            {
                "role": UserRole.FIELD_OFFICER,
                "method": "post",
                "url": reverse("community-list"),
                "payload": {},
                "expected": status.HTTP_400_BAD_REQUEST,
            },
            {
                "role": UserRole.FIELD_OFFICER,
                "method": "get",
                "url": reverse("admin-user-list"),
                "expected": status.HTTP_403_FORBIDDEN,
            },
            {
                "role": UserRole.PROGRAMME_MANAGER,
                "method": "post",
                "url": reverse("impact-record-list"),
                "payload": {},
                "expected": status.HTTP_400_BAD_REQUEST,
            },
            {
                "role": UserRole.PROGRAMME_MANAGER,
                "method": "get",
                "url": reverse("admin-user-list"),
                "expected": status.HTTP_403_FORBIDDEN,
            },
            {
                "role": UserRole.EXECUTIVE_LEADERSHIP,
                "method": "get",
                "url": reverse("community-list"),
                "expected": status.HTTP_200_OK,
            },
            {
                "role": UserRole.EXECUTIVE_LEADERSHIP,
                "method": "post",
                "url": reverse("community-list"),
                "payload": {},
                "expected": status.HTTP_403_FORBIDDEN,
            },
            {
                "role": UserRole.FINANCE_ADMINISTRATOR,
                "method": "post",
                "url": reverse("resource-list"),
                "payload": {},
                "expected": status.HTTP_400_BAD_REQUEST,
            },
            {
                "role": UserRole.FINANCE_ADMINISTRATOR,
                "method": "post",
                "url": reverse("impact-record-list"),
                "payload": {},
                "expected": status.HTTP_403_FORBIDDEN,
            },
            {
                "role": UserRole.MONITORING_EVALUATION_MANAGER,
                "method": "post",
                "url": reverse("impact-record-list"),
                "payload": {},
                "expected": status.HTTP_400_BAD_REQUEST,
            },
            {
                "role": UserRole.MONITORING_EVALUATION_MANAGER,
                "method": "post",
                "url": reverse("resource-list"),
                "payload": {},
                "expected": status.HTTP_403_FORBIDDEN,
            },
            {
                "role": UserRole.COMMUNICATIONS_VIEWER,
                "method": "get",
                "url": reverse("resource-list"),
                "expected": status.HTTP_200_OK,
            },
            {
                "role": UserRole.COMMUNICATIONS_VIEWER,
                "method": "get",
                "url": reverse("member-list"),
                "expected": status.HTTP_403_FORBIDDEN,
            },
            {
                "role": UserRole.RESOURCE_PROCUREMENT_OFFICER,
                "method": "post",
                "url": reverse("resource-list"),
                "payload": {},
                "expected": status.HTTP_400_BAD_REQUEST,
            },
            {
                "role": UserRole.RESOURCE_PROCUREMENT_OFFICER,
                "method": "post",
                "url": reverse("community-list"),
                "payload": {},
                "expected": status.HTTP_403_FORBIDDEN,
            },
            {
                "role": UserRole.SYSTEM_ADMINISTRATOR,
                "method": "get",
                "url": reverse("admin-user-list"),
                "expected": status.HTTP_200_OK,
            },
            {
                "role": UserRole.SYSTEM_ADMINISTRATOR,
                "method": "post",
                "url": reverse("community-list"),
                "payload": {},
                "expected": status.HTTP_403_FORBIDDEN,
            },
        ]

        for case in cases:
            with self.subTest(role=case["role"], url=case["url"]):
                user = self._user_with_role(case["role"])
                self.client.force_authenticate(user)
                response = getattr(self.client, case["method"])(
                    case["url"],
                    case.get("payload", {}),
                    format="json",
                )
                self.assertEqual(response.status_code, case["expected"])

        review_cases = [
            {
                "role": UserRole.PROGRAMME_MANAGER,
                "entity_type": "resource",
                "expected": status.HTTP_200_OK,
            },
            {
                "role": UserRole.EXECUTIVE_LEADERSHIP,
                "entity_type": "resource",
                "expected": status.HTTP_200_OK,
            },
            {
                "role": UserRole.MONITORING_EVALUATION_MANAGER,
                "entity_type": "impact_record",
                "expected": status.HTTP_200_OK,
            },
            {
                "role": UserRole.MONITORING_EVALUATION_MANAGER,
                "entity_type": "resource",
                "expected": status.HTTP_404_NOT_FOUND,
            },
            {
                "role": UserRole.SYSTEM_ADMINISTRATOR,
                "entity_type": "resource",
                "expected": status.HTTP_403_FORBIDDEN,
            },
        ]

        for case in review_cases:
            with self.subTest(role=case["role"], entity_type=case["entity_type"]):
                approval = ApprovalRequest.objects.create(
                    community=self.community,
                    entity_type=case["entity_type"],
                    entity_id=self.resource.id,
                    action_type=ApprovalActionType.UPDATE,
                    submitted_payload={"name": "Reviewed name"},
                )
                user = self._user_with_role(case["role"])
                self.client.force_authenticate(user)
                response = self.client.post(
                    reverse("approval-request-reject", kwargs={"pk": approval.pk}),
                    {"review_notes": "Role matrix review"},
                    format="json",
                )
                self.assertEqual(response.status_code, case["expected"])

    def test_assign_role_replaces_the_previous_product_role(self):
        user = self._user_with_role(UserRole.FIELD_OFFICER)
        assign_role(user, UserRole.PROGRAMME_MANAGER)
        self.assertEqual(
            set(user.groups.values_list("name", flat=True)),
            {UserRole.PROGRAMME_MANAGER},
        )

    def test_monitoring_and_evaluation_review_is_limited_to_impact(self):
        impact_approval = ApprovalRequest.objects.create(
            community=self.community,
            entity_type="impact_record",
            entity_id=0,
            action_type=ApprovalActionType.CREATE,
            submitted_payload={"resource": self.resource.id},
        )
        resource_approval = ApprovalRequest.objects.create(
            community=self.community,
            entity_type="resource",
            entity_id=self.resource.id,
            action_type=ApprovalActionType.UPDATE,
            submitted_payload={"name": "Restricted Review"},
        )
        reviewer = self._user_with_role(UserRole.MONITORING_EVALUATION_MANAGER)
        self.client.force_authenticate(reviewer)

        impact_response = self.client.post(
            reverse("approval-request-reject", kwargs={"pk": impact_approval.pk}),
            {"review_notes": "Impact evidence is incomplete."},
            format="json",
        )
        resource_response = self.client.post(
            reverse("approval-request-reject", kwargs={"pk": resource_approval.pk}),
            {"review_notes": "Outside M&E scope."},
            format="json",
        )

        self.assertEqual(impact_response.status_code, status.HTTP_200_OK)
        self.assertEqual(resource_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_reviewer_cannot_review_own_submission(self):
        manager = self._user_with_role(UserRole.PROGRAMME_MANAGER)
        approval = ApprovalRequest.objects.create(
            community=self.community,
            entity_type="resource",
            entity_id=self.resource.id,
            action_type=ApprovalActionType.UPDATE,
            submitted_payload={"name": "Self Reviewed"},
            submitted_by_user_id=manager.id,
        )
        self.client.force_authenticate(manager)

        response = self.client.post(
            reverse("approval-request-approve", kwargs={"pk": approval.pk}),
            {"review_notes": "I approve my own request."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_approval_approve_applies_update_and_supersede_is_terminal(self):
        approval = ApprovalRequest.objects.create(
            community=self.community,
            entity_type="resource",
            entity_id=self.resource.id,
            action_type=ApprovalActionType.UPDATE,
            submitted_payload={"status": "active", "name": "Approved Resource"},
        )
        manager = self._user_with_role(UserRole.PROGRAMME_MANAGER)
        self.client.force_authenticate(manager)

        approve_response = self.client.post(
            reverse("approval-request-approve", kwargs={"pk": approval.pk}),
            {"review_notes": "Approved"},
            format="json",
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(approve_response.data["status"], ApprovalStatus.APPROVED)
        self.assertIsNotNone(approve_response.data["applied_at"])

        self.resource.refresh_from_db()
        self.assertEqual(self.resource.status, "active")
        self.assertEqual(self.resource.name, "Approved Resource")
        self.assertEqual(self.resource.sync_version, 2)

        superseded = ApprovalRequest.objects.create(
            community=self.community,
            entity_type="resource",
            entity_id=self.resource.id,
            action_type=ApprovalActionType.UPDATE,
            submitted_payload={"status": "inactive"},
        )
        supersede_response = self.client.post(
            reverse("approval-request-supersede", kwargs={"pk": superseded.pk}),
            {"review_notes": "Replaced by newer request"},
            format="json",
        )
        self.assertEqual(supersede_response.status_code, status.HTTP_200_OK)
        self.assertEqual(supersede_response.data["status"], ApprovalStatus.SUPERSEDED)

        reject_response = self.client.post(
            reverse("approval-request-reject", kwargs={"pk": superseded.pk}),
            {"review_notes": "Too late"},
            format="json",
        )
        self.assertEqual(reject_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sync_pull_and_push_conflict_detection(self):
        user = self._user_with_role(UserRole.FIELD_OFFICER)
        self.client.force_authenticate(user)

        pull_response = self.client.get(
            reverse("sync-pull"),
            {"entity_type": "resource"},
        )
        self.assertEqual(pull_response.status_code, status.HTTP_200_OK)
        self.assertIn("resource", pull_response.data["data"])
        self.assertGreaterEqual(len(pull_response.data["data"]["resource"]), 1)

        cases = [
            {
                "label": "matching version queues change",
                "sync_version": self.resource.sync_version,
                "expected_status": status.HTTP_200_OK,
                "expected_conflicts": 0,
            },
            {
                "label": "stale version returns conflict",
                "sync_version": self.resource.sync_version + 99,
                "expected_status": status.HTTP_409_CONFLICT,
                "expected_conflicts": 1,
            },
        ]

        for case in cases:
            with self.subTest(case=case["label"]):
                push_response = self.client.post(
                    reverse("sync-push"),
                    {
                        "changes": [
                            {
                                "entity_type": "resource",
                                "id": self.resource.id,
                                "sync_version": case["sync_version"],
                                "payload": {"name": "Offline Name"},
                            }
                        ]
                    },
                    format="json",
                )
                self.assertEqual(push_response.status_code, case["expected_status"])
                self.assertEqual(
                    len(push_response.data["data"]["conflicts"]),
                    case["expected_conflicts"],
                )

    def test_init_roles_command(self):
        call_command("init_roles")
        user = self._user_with_role(UserRole.SYSTEM_ADMINISTRATOR)
        self.assertIn(
            UserRole.SYSTEM_ADMINISTRATOR,
            {group.name for group in user.groups.all()},
        )
        self.assertEqual(
            set(UserRole.values),
            set(
                user.groups.model.objects.filter(
                    name__in=UserRole.values
                ).values_list("name", flat=True)
            ),
        )
