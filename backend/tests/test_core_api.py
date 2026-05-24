from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.common.models import InstitutionType, MemberStatus, ResourcePartyType
from apps.communities.models import Community
from apps.groups.models import Group
from apps.institutions.models import Institution
from apps.members.models import Member
from apps.participation.models import Committee, Cooperative
from apps.resources.models import Resource


class CoreApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="field.officer",
            password="test-password",
        )
        cls.community = Community.objects.create(
            name="Primary Community",
            district_name="Kampala",
        )
        cls.other_community = Community.objects.create(
            name="Other Community",
        )
        cls.group = Group.objects.create(
            community=cls.community,
            code="GRP-1",
            name="Primary Group",
        )
        cls.other_group = Group.objects.create(
            community=cls.other_community,
            code="GRP-2",
            name="Other Group",
        )
        cls.member = Member.objects.create(
            community=cls.community,
            group=cls.group,
            member_number="MEM-1",
            first_name="Grace",
            last_name="Nabirye",
        )
        cls.institution = Institution.objects.create(
            community=cls.community,
            code="INST-1",
            name="Primary School",
            institution_type=InstitutionType.SCHOOL,
        )
        cls.committee = Committee.objects.create(
            community=cls.community,
            name="Primary Committee",
        )
        cls.cooperative = Cooperative.objects.create(
            community=cls.community,
            name="Primary Cooperative",
        )
        cls.resource = Resource.objects.create(
            community=cls.community,
            owner_type=ResourcePartyType.GROUP,
            owner_id=cls.group.id,
            name="Primary Resource",
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_core_crud_endpoints(self):
        cases = [
            {
                "label": "communities",
                "basename": "community",
                "instance": self.community,
                "create": {
                    "name": "Created Community",
                    "country": "Uganda",
                },
                "patch": {"notes": "Updated community notes"},
                "patch_field": "notes",
            },
            {
                "label": "groups",
                "basename": "group",
                "instance": self.group,
                "create": {
                    "community": self.community.id,
                    "code": "GRP-3",
                    "name": "Created Group",
                },
                "patch": {"meeting_day": "Tuesday"},
                "patch_field": "meeting_day",
            },
            {
                "label": "members",
                "basename": "member",
                "instance": self.member,
                "create": {
                    "community": self.community.id,
                    "group": self.group.id,
                    "member_number": "MEM-2",
                    "first_name": "Sarah",
                    "last_name": "Akello",
                    "status": MemberStatus.ACTIVE,
                },
                "patch": {"preferred_name": "Sarry"},
                "patch_field": "preferred_name",
            },
            {
                "label": "institutions",
                "basename": "institution",
                "instance": self.institution,
                "create": {
                    "community": self.community.id,
                    "code": "INST-2",
                    "name": "Created Clinic",
                    "institution_type": InstitutionType.CLINIC,
                },
                "patch": {"contact_name": "Dr. Jane"},
                "patch_field": "contact_name",
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

    def test_member_create_rejects_group_from_another_community(self):
        payload = {
            "community": self.community.id,
            "group": self.other_group.id,
            "first_name": "Invalid",
            "last_name": "Member",
        }
        response = self.client.post(reverse("member-list"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("group", response.data)

    def test_nested_read_endpoints(self):
        cases = [
            {
                "label": "community summary",
                "url": reverse("community-summary", kwargs={"pk": self.community.pk}),
            },
            {
                "label": "community groups",
                "url": reverse("community-groups", kwargs={"pk": self.community.pk}),
            },
            {
                "label": "community institutions",
                "url": reverse(
                    "community-institutions",
                    kwargs={"pk": self.community.pk},
                ),
            },
            {
                "label": "group members",
                "url": reverse("group-members", kwargs={"pk": self.group.pk}),
            },
        ]

        for case in cases:
            with self.subTest(endpoint=case["label"]):
                response = self.client.get(case["url"])
                self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_community_list_is_ready_for_table_ui(self):
        response = self.client.get(
            reverse("community-list"),
            {"search": "Primary", "ordering": "-member_count"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = response.data["results"][0]

        expected_counts = {
            "member_count": 1,
            "group_count": 1,
            "committee_count": 1,
            "cooperative_count": 1,
            "resource_count": 1,
            "institution_count": 1,
        }
        for field, expected in expected_counts.items():
            with self.subTest(field=field):
                self.assertEqual(row[field], expected)

        member_search_response = self.client.get(
            reverse("community-list"),
            {"member_search": "Grace"},
        )
        self.assertEqual(member_search_response.status_code, status.HTTP_200_OK)
        self.assertEqual(member_search_response.data["count"], 1)
        self.assertEqual(
            member_search_response.data["results"][0]["id"],
            self.community.id,
        )
