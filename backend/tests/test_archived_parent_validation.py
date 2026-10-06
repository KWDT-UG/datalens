from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.communities.models import Community
from apps.groups.models import Group
from apps.members.models import Member
from apps.participation.models import Committee, Cooperative
from apps.resources.models import Program, ThematicArea


class ArchivedParentValidationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_superuser(
            username="archived.parent.admin",
            email="archived.parent@example.com",
            password="test-password",
        )
        cls.active_community = Community.objects.create(name="Active Parent")
        cls.archived_community = Community.objects.create(
            name="Archived Parent",
            is_deleted=True,
        )
        cls.active_group = Group.objects.create(
            community=cls.active_community,
            code="ACTIVE-GROUP",
            name="Active Group",
        )
        cls.archived_group = Group.objects.create(
            community=cls.active_community,
            code="ARCHIVED-GROUP",
            name="Archived Group",
            is_deleted=True,
        )
        cls.active_member = Member.objects.create(
            community=cls.active_community,
            group=cls.active_group,
            first_name="Active",
            last_name="Member",
        )
        cls.archived_member = Member.objects.create(
            community=cls.active_community,
            group=cls.active_group,
            first_name="Archived",
            last_name="Member",
            is_deleted=True,
        )
        cls.archived_committee = Committee.objects.create(
            community=cls.active_community,
            name="Archived Committee",
            is_deleted=True,
        )
        cls.archived_cooperative = Cooperative.objects.create(
            community=cls.active_community,
            name="Archived Cooperative",
            is_deleted=True,
        )
        cls.archived_thematic_area = ThematicArea.objects.create(
            code="ARCHIVED-THEME",
            name="Archived Theme",
            is_deleted=True,
        )
        cls.archived_program = Program.objects.create(
            thematic_area=cls.archived_thematic_area,
            code="ARCHIVED-PROGRAM",
            name="Archived Program",
            is_deleted=True,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_create_rejects_archived_fk_parents_across_domain_families(self):
        cases = [
            (
                "group-list",
                {
                    "community": self.archived_community.pk,
                    "code": "INVALID-GROUP",
                    "name": "Invalid Group",
                },
                "community",
            ),
            (
                "institution-list",
                {
                    "community": self.archived_community.pk,
                    "code": "INVALID-INSTITUTION",
                    "name": "Invalid Institution",
                    "institution_type": "other",
                },
                "community",
            ),
            (
                "member-list",
                {
                    "community": self.active_community.pk,
                    "group": self.archived_group.pk,
                    "first_name": "Invalid",
                    "last_name": "Member",
                },
                "group",
            ),
            (
                "committee-membership-list",
                {
                    "committee": self.archived_committee.pk,
                    "member": self.active_member.pk,
                },
                "committee",
            ),
            (
                "cooperative-membership-list",
                {
                    "cooperative": self.archived_cooperative.pk,
                    "member": self.active_member.pk,
                },
                "cooperative",
            ),
            (
                "program-list",
                {
                    "thematic_area": self.archived_thematic_area.pk,
                    "code": "INVALID-PROGRAM",
                    "name": "Invalid Program",
                },
                "thematic_area",
            ),
            (
                "resource-category-list",
                {
                    "program": self.archived_program.pk,
                    "code": "INVALID-CATEGORY",
                    "name": "Invalid Category",
                },
                "program",
            ),
        ]

        for route_name, payload, expected_field in cases:
            with self.subTest(route_name=route_name):
                response = self.client.post(
                    reverse(route_name),
                    payload,
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(expected_field, response.data)
                self.assertIn("archived", str(response.data[expected_field]).lower())

    def test_unrelated_update_of_legacy_row_with_archived_parent_is_allowed(self):
        group = Group.objects.create(
            community=self.active_community,
            code="LEGACY",
            name="Legacy Group",
        )
        self.active_community.is_deleted = True
        self.active_community.save(update_fields=["is_deleted", "updated_at"])

        response = self.client.patch(
            reverse("group-detail", kwargs={"pk": group.pk}),
            {"notes": "Corrected while parent archive is investigated."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        group.refresh_from_db()
        self.assertEqual(
            group.notes,
            "Corrected while parent archive is investigated.",
        )
