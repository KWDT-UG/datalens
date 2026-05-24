from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.common.models import MembershipStatus
from apps.communities.models import Community
from apps.groups.models import Group
from apps.members.models import Member
from apps.participation.models import (
    Committee,
    CommitteeMembership,
    Cooperative,
    CooperativeMembership,
)


class GovernanceApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="governance.user",
            password="test-password",
        )
        cls.community = Community.objects.create(name="Governance")
        cls.other_community = Community.objects.create(name="Alternate")
        cls.group = Group.objects.create(
            community=cls.community,
            code="GRP-GOV",
            name="Governance Group",
        )
        cls.other_group = Group.objects.create(
            community=cls.other_community,
            code="GRP-ALT",
            name="Alternate Group",
        )
        cls.member = Member.objects.create(
            community=cls.community,
            group=cls.group,
            first_name="Lina",
            last_name="Member",
        )
        cls.other_member = Member.objects.create(
            community=cls.other_community,
            group=cls.other_group,
            first_name="Noah",
            last_name="Other",
        )
        cls.committee = Committee.objects.create(
            community=cls.community,
            name="Finance Committee",
        )
        cls.committee_membership = CommitteeMembership.objects.create(
            committee=cls.committee,
            member=cls.member,
            role_name="Chair",
            status=MembershipStatus.ACTIVE,
        )
        cls.cooperative = Cooperative.objects.create(
            community=cls.community,
            name="Village Cooperative",
        )
        cls.cooperative_membership = CooperativeMembership.objects.create(
            cooperative=cls.cooperative,
            member=cls.member,
            role_name="Secretary",
            status=MembershipStatus.ACTIVE,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_governance_crud_endpoints(self):
        cases = [
            {
                "label": "committees",
                "basename": "committee",
                "instance": self.committee,
                "create": {
                    "community": self.community.id,
                    "name": "Water Committee",
                    "committee_type": "service",
                },
                "patch": {"description": "Handles finance reviews"},
                "patch_field": "description",
            },
            {
                "label": "committee memberships",
                "basename": "committee-membership",
                "instance": self.committee_membership,
                "create": {
                    "committee": self.committee.id,
                    "member": self.member.id,
                    "role_name": "Vice Chair",
                    "status": MembershipStatus.ARCHIVED,
                },
                "patch": {"role_name": "Lead Chair"},
                "patch_field": "role_name",
            },
            {
                "label": "cooperatives",
                "basename": "cooperative",
                "instance": self.cooperative,
                "create": {
                    "community": self.community.id,
                    "name": "Farmers Cooperative",
                    "cooperative_type": "savings",
                },
                "patch": {"description": "Supports group lending"},
                "patch_field": "description",
            },
            {
                "label": "cooperative memberships",
                "basename": "cooperative-membership",
                "instance": self.cooperative_membership,
                "create": {
                    "cooperative": self.cooperative.id,
                    "member": self.member.id,
                    "role_name": "Member",
                    "status": MembershipStatus.ARCHIVED,
                },
                "patch": {"role_name": "Lead Secretary"},
                "patch_field": "role_name",
            },
        ]

        for case in cases:
            with self.subTest(endpoint=case["label"], action="list"):
                response = self.client.get(reverse(f"{case['basename']}-list"))
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertIn("results", response.data)

            with self.subTest(endpoint=case["label"], action="retrieve"):
                response = self.client.get(
                    reverse(
                        f"{case['basename']}-detail",
                        kwargs={"pk": case["instance"].pk},
                    )
                )
                self.assertEqual(response.status_code, status.HTTP_200_OK)

            with self.subTest(endpoint=case["label"], action="create"):
                response = self.client.post(
                    reverse(f"{case['basename']}-list"),
                    case["create"],
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                self.assertEqual(response.data["created_by_user_id"], self.user.id)

            with self.subTest(endpoint=case["label"], action="partial_update"):
                response = self.client.patch(
                    reverse(
                        f"{case['basename']}-detail",
                        kwargs={"pk": case["instance"].pk},
                    ),
                    case["patch"],
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(
                    response.data[case["patch_field"]],
                    case["patch"][case["patch_field"]],
                )

    def test_invalid_membership_relationships_are_rejected(self):
        cases = [
            {
                "label": "committee membership wrong community",
                "url": reverse("committee-membership-list"),
                "payload": {
                    "committee": self.committee.id,
                    "member": self.other_member.id,
                },
            },
            {
                "label": "cooperative membership wrong community",
                "url": reverse("cooperative-membership-list"),
                "payload": {
                    "cooperative": self.cooperative.id,
                    "member": self.other_member.id,
                },
            },
        ]

        for case in cases:
            with self.subTest(case=case["label"]):
                response = self.client.post(case["url"], case["payload"], format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("member", response.data)

    def test_duplicate_active_memberships_are_rejected(self):
        cases = [
            {
                "label": "duplicate active committee membership",
                "url": reverse("committee-membership-list"),
                "payload": {
                    "committee": self.committee.id,
                    "member": self.member.id,
                    "status": MembershipStatus.ACTIVE,
                },
            },
            {
                "label": "duplicate active cooperative membership",
                "url": reverse("cooperative-membership-list"),
                "payload": {
                    "cooperative": self.cooperative.id,
                    "member": self.member.id,
                    "status": MembershipStatus.ACTIVE,
                },
            },
        ]

        for case in cases:
            with self.subTest(case=case["label"]):
                response = self.client.post(case["url"], case["payload"], format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("status", response.data)

    def test_nested_membership_endpoints(self):
        cases = [
            {
                "label": "committee memberships",
                "url": reverse("committee-memberships", kwargs={"pk": self.committee.pk}),
            },
            {
                "label": "cooperative memberships",
                "url": reverse(
                    "cooperative-memberships",
                    kwargs={"pk": self.cooperative.pk},
                ),
            },
        ]

        for case in cases:
            with self.subTest(endpoint=case["label"]):
                response = self.client.get(case["url"])
                self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_governance_lists_filter_by_community_for_detail_tabs(self):
        cases = [
            {
                "label": "committees",
                "url": reverse("committee-list"),
                "expected_id": self.committee.id,
            },
            {
                "label": "committee memberships",
                "url": reverse("committee-membership-list"),
                "expected_id": self.committee_membership.id,
            },
            {
                "label": "cooperatives",
                "url": reverse("cooperative-list"),
                "expected_id": self.cooperative.id,
            },
            {
                "label": "cooperative memberships",
                "url": reverse("cooperative-membership-list"),
                "expected_id": self.cooperative_membership.id,
            },
        ]

        for case in cases:
            with self.subTest(endpoint=case["label"]):
                response = self.client.get(case["url"], {"community": self.community.id})
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data["count"], 1)
                self.assertEqual(response.data["results"][0]["id"], case["expected_id"])
