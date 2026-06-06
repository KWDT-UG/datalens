from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.approvals.models import ApprovalRequest
from apps.common.models import ApprovalActionType, ResourcePartyType, UserRole
from apps.common.permissions import assign_role
from apps.communities.models import Community
from apps.groups.models import Group
from apps.impacts.models import ImpactRecord
from apps.institutions.models import Institution
from apps.members.models import Member
from apps.participation.models import (
    Committee,
    CommitteeMembership,
    Cooperative,
    CooperativeMembership,
)
from apps.resources.models import Resource, ResourceBeneficiary, ThematicArea


class ApiHardeningTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="hardening.user",
            password="test-password",
        )
        assign_role(cls.user, UserRole.FIELD_OFFICER)
        cls.admin_user = get_user_model().objects.create_superuser(
            username="hardening.admin",
            email="hardening.admin@example.com",
            password="test-password",
        )
        cls.community = Community.objects.create(
            name="Zulu Community",
            status="active",
        )
        cls.other_community = Community.objects.create(
            name="Alpha Community",
            status="inactive",
        )
        cls.group = Group.objects.create(
            community=cls.community,
            code="GRP-H1",
            name="Primary Group",
        )
        cls.member = Member.objects.create(
            community=cls.community,
            group=cls.group,
            first_name="Lara",
            last_name="Filter",
        )
        cls.institution = Institution.objects.create(
            community=cls.community,
            code="INST-H1",
            name="Health Center",
        )
        cls.committee = Committee.objects.create(
            community=cls.community,
            name="Operations Committee",
        )
        cls.committee_membership = CommitteeMembership.objects.create(
            committee=cls.committee,
            member=cls.member,
            role_name="Chair",
        )
        cls.cooperative = Cooperative.objects.create(
            community=cls.community,
            name="Village Coop",
        )
        cls.cooperative_membership = CooperativeMembership.objects.create(
            cooperative=cls.cooperative,
            member=cls.member,
            role_name="Secretary",
        )
        cls.thematic_area = ThematicArea.objects.create(code="WASH", name="WASH")
        cls.resource = Resource.objects.create(
            community=cls.community,
            owner_type=ResourcePartyType.GROUP,
            owner_id=cls.group.id,
            name="Water Pump",
        )
        cls.resource_beneficiary = ResourceBeneficiary.objects.create(
            resource=cls.resource,
            beneficiary_type=ResourcePartyType.MEMBER,
            beneficiary_id=cls.member.id,
        )
        cls.impact_record = ImpactRecord.objects.create(resource=cls.resource)
        cls.approval_request = ApprovalRequest.objects.create(
            community=cls.community,
            entity_type="resource",
            entity_id=cls.resource.id,
            action_type=ApprovalActionType.UPDATE,
            submitted_payload={"name": "Water Pump"},
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_health_and_api_root(self):
        health_response = self.client.get("/health/")
        self.assertEqual(health_response.status_code, status.HTTP_200_OK)

        api_root_response = self.client.get("/api/v1/")
        self.assertEqual(api_root_response.status_code, status.HTTP_200_OK)

    def test_all_list_endpoints_smoke(self):
        cases = [
            "community-list",
            "group-list",
            "member-list",
            "institution-list",
            "committee-list",
            "committee-membership-list",
            "cooperative-list",
            "cooperative-membership-list",
            "thematic-area-list",
            "resource-list",
            "resource-beneficiary-list",
            "impact-record-list",
            "approval-request-list",
        ]

        for route_name in cases:
            with self.subTest(route_name=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertIn("results", response.data)

    def test_filtering_and_ordering_smoke(self):
        cases = [
            {
                "label": "community status filter",
                "url": reverse("community-list"),
                "params": {"status": "active"},
                "expected_first": "Zulu Community",
            },
            {
                "label": "community ordering",
                "url": reverse("community-list"),
                "params": {"ordering": "name"},
                "expected_first": "Alpha Community",
            },
            {
                "label": "community search",
                "url": reverse("community-list"),
                "params": {"search": "Zulu"},
                "expected_first": "Zulu Community",
            },
            {
                "label": "resource owner type filter",
                "url": reverse("resource-list"),
                "params": {"owner_type": ResourcePartyType.GROUP},
                "expected_first": "Water Pump",
            },
        ]

        for case in cases:
            with self.subTest(case=case["label"]):
                response = self.client.get(case["url"], case["params"])
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertGreaterEqual(len(response.data["results"]), 1)
                self.assertEqual(response.data["results"][0]["name"], case["expected_first"])

    def test_structured_validation_errors_are_returned(self):
        response = self.client.post(
            reverse("member-list"),
            {
                "community": self.community.id,
                "group": Group.objects.create(
                    community=self.other_community,
                    code="GRP-H2",
                    name="Other Group",
                ).id,
                "first_name": "Invalid",
                "last_name": "Member",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("errors", response.data)
        self.assertEqual(response.data["errors"][0]["attr"], "group")
        self.assertIn("group", response.data)

    def test_approval_review_permission_and_error_shape(self):
        response = self.client.post(
            reverse("approval-request-approve", kwargs={"pk": self.approval_request.pk}),
            {"review_notes": "No access"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("errors", response.data)

    def test_approval_re_review_is_rejected_for_admin(self):
        self.client.force_authenticate(self.admin_user)
        first_response = self.client.post(
            reverse("approval-request-approve", kwargs={"pk": self.approval_request.pk}),
            {"review_notes": "Approved"},
            format="json",
        )
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)

        second_response = self.client.post(
            reverse("approval-request-reject", kwargs={"pk": self.approval_request.pk}),
            {"review_notes": "Too late"},
            format="json",
        )
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("errors", second_response.data)
        self.assertEqual(second_response.data["errors"][0]["attr"], "status")
