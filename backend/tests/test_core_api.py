from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.common.models import (
    InstitutionType,
    MemberStatus,
    ResourcePartyType,
    UserRole,
)
from apps.common.permissions import assign_role
from apps.communities.models import Community
from apps.groups.models import Group
from apps.impacts.models import ImpactRecord
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
        assign_role(cls.user, UserRole.FIELD_OFFICER)
        cls.community = Community.objects.create(
            name="Primary Community",
            subcounty_name="Nakawa",
            district_name="Kampala",
            resident_count=1250,
        )
        cls.other_community = Community.objects.create(
            name="Other Community",
        )
        cls.group = Group.objects.create(
            community=cls.community,
            code="GRP-1",
            name="Primary Group",
            sub_county="Mpunge",
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
            gender="Female",
            group_position="Treasurer",
            community_position="District councillor",
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
                    "subcounty_name": "Mpunge",
                    "resident_count": 720,
                },
                "patch": {"resident_count": 735},
                "patch_field": "resident_count",
            },
            {
                "label": "groups",
                "basename": "group",
                "instance": self.group,
                "create": {
                    "community": self.community.id,
                    "code": "GRP-3",
                    "name": "Created Group",
                    "sub_county": "Ntenjeru",
                },
                "patch": {"sub_county": "Nakisunga"},
                "patch_field": "sub_county",
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
                    "group_position": "Secretary",
                    "community_position": "Village representative",
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

    def test_member_positions_are_structured_searchable_fields(self):
        detail = self.client.get(
            reverse("member-detail", kwargs={"pk": self.member.pk})
        )
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["group_position"], "Treasurer")
        self.assertEqual(detail.data["community_position"], "District councillor")

        for search_term in ("Treasurer", "District councillor"):
            with self.subTest(search=search_term):
                response = self.client.get(
                    reverse("member-list"),
                    {"search": search_term},
                )
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(
                    [row["id"] for row in response.data["results"]],
                    [self.member.id],
                )

    def test_breakdown_tables_support_server_side_ordering(self):
        larger_group = Group.objects.create(
            community=self.community,
            code="GRP-SORT",
            name="Sorting Group",
            status="inactive",
        )
        for index, gender in enumerate(("Female", "Female", "Male"), start=1):
            Member.objects.create(
                community=self.community,
                group=larger_group,
                first_name=f"Sort {index}",
                last_name="Member",
                gender=gender,
                status="inactive" if index == 1 else "active",
            )
        sortable_institution = Institution.objects.create(
            community=self.community,
            name="Sorting Institution",
            contact_name="Zed Contact",
            status="inactive",
        )
        sortable_committee = Committee.objects.create(
            community=self.community,
            name="Sorting Committee",
            status="inactive",
        )
        sortable_cooperative = Cooperative.objects.create(
            community=self.community,
            name="Sorting Cooperative",
            status="inactive",
        )
        sortable_resource = Resource.objects.create(
            community=self.community,
            owner_type=ResourcePartyType.GROUP,
            owner_id=larger_group.id,
            name="Sorting Resource",
            quantity=10,
            status="active",
        )
        sortable_impact = ImpactRecord.objects.create(
            resource=sortable_resource,
            beneficiary_count=7,
            household_count=5,
            member_count=3,
        )

        cases = [
            ("group-list", "-member_count", larger_group.id),
            ("group-list", "-female_count", larger_group.id),
            ("group-list", "-male_count", larger_group.id),
            (
                "member-list",
                "-status",
                larger_group.members.get(status="inactive").id,
            ),
            ("institution-list", "-contact_name", sortable_institution.id),
            ("committee-list", "-status", sortable_committee.id),
            ("cooperative-list", "-status", sortable_cooperative.id),
            ("resource-list", "-quantity", sortable_resource.id),
            ("impact-record-list", "-beneficiary_count", sortable_impact.id),
        ]

        for route_name, ordering, expected_id in cases:
            with self.subTest(route=route_name, ordering=ordering):
                response = self.client.get(
                    reverse(route_name),
                    {
                        "community": self.community.id,
                        "ordering": ordering,
                        "page_size": 1,
                    },
                )
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data["results"][0]["id"], expected_id)

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
            "resident_count": 1250,
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

        self.assertEqual(row["subcounty_name"], "Nakawa")

        summary_response = self.client.get(
            reverse("community-summary", kwargs={"pk": self.community.pk})
        )
        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)
        self.assertEqual(summary_response.data["resident_count"], 1250)

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

    def test_group_list_includes_member_and_gender_counts(self):
        Member.objects.create(
            community=self.community,
            group=self.group,
            first_name="Peter",
            last_name="Okello",
            gender="male",
        )
        Member.objects.create(
            community=self.community,
            group=self.group,
            first_name="Unspecified",
            last_name="Member",
        )

        response = self.client.get(
            reverse("group-list"),
            {"community": self.community.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = response.data["results"][0]
        self.assertEqual(row["member_count"], 3)
        self.assertEqual(row["female_count"], 1)
        self.assertEqual(row["male_count"], 1)

    def test_community_rejects_negative_resident_count(self):
        response = self.client.post(
            reverse("community-list"),
            {"name": "Invalid Population", "resident_count": -1},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("resident_count", response.data)

    def test_community_accepts_legacy_area_name_for_queued_changes(self):
        response = self.client.post(
            reverse("community-list"),
            {"name": "Legacy Offline Community", "area_name": "Ntenjeru"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["subcounty_name"], "Ntenjeru")
        self.assertNotIn("area_name", response.data)
        self.assertEqual(
            Community.objects.get(pk=response.data["id"]).subcounty_name,
            "Ntenjeru",
        )

    def test_community_rejects_conflicting_subcounty_field_names(self):
        response = self.client.post(
            reverse("community-list"),
            {
                "name": "Conflicting Community",
                "subcounty_name": "Mpunge",
                "area_name": "Ntenjeru",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("area_name", response.data)
