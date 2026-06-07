from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.common.models import ResourcePartyType, UserProfile, UserRole
from apps.common.permissions import assign_role
from apps.communities.models import Community
from apps.groups.models import Group
from apps.members.models import Member
from apps.resources.models import Resource, ResourceThematicArea, ThematicArea


class PermissionsPrivacyTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.community_a = Community.objects.create(
            name="Assigned Community",
            district_name="Assigned District",
        )
        cls.community_b = Community.objects.create(
            name="Private Community",
            district_name="Other District",
        )
        cls.group_a = Group.objects.create(
            community=cls.community_a,
            code="A",
            name="Assigned Group",
        )
        cls.group_b = Group.objects.create(
            community=cls.community_b,
            code="B",
            name="Private Group",
        )
        cls.member_a = Member.objects.create(
            community=cls.community_a,
            group=cls.group_a,
            member_number="MEM-1",
            first_name="Ada",
            last_name="Assigned",
            phone="+256700000001",
            email="ada@example.test",
            address_text="Private address",
        )
        cls.theme_a = ThematicArea.objects.create(code="EDU", name="Education")
        cls.theme_b = ThematicArea.objects.create(code="WASH", name="WASH")
        cls.resource_a = Resource.objects.create(
            community=cls.community_a,
            owner_type=ResourcePartyType.GROUP,
            owner_id=cls.group_a.pk,
            name="Assigned Resource",
            value_amount="125000.00",
            value_currency="UGX",
            source_notes="Internal funding source",
            serial_or_tag_number="PRIVATE-TAG",
        )
        cls.resource_b = Resource.objects.create(
            community=cls.community_b,
            owner_type=ResourcePartyType.GROUP,
            owner_id=cls.group_b.pk,
            name="Private Resource",
        )
        ResourceThematicArea.objects.create(
            resource=cls.resource_a,
            thematic_area=cls.theme_a,
            is_primary=True,
        )
        ResourceThematicArea.objects.create(
            resource=cls.resource_b,
            thematic_area=cls.theme_b,
            is_primary=True,
        )

    def setUp(self):
        self.client = APIClient()

    def make_user(self, role, username):
        user = get_user_model().objects.create_user(
            username=username,
            password="test-password",
        )
        assign_role(user, role)
        profile = UserProfile.objects.create(user=user)
        return user, profile

    def test_field_officer_community_assignment_scopes_lists_details_and_dashboard(self):
        user, profile = self.make_user(UserRole.FIELD_OFFICER, "scoped.field")
        profile.assigned_communities.add(self.community_a)
        self.client.force_authenticate(user)

        list_response = self.client.get(reverse("community-list"))
        hidden_response = self.client.get(
            reverse("community-detail", kwargs={"pk": self.community_b.pk})
        )
        dashboard_response = self.client.get(reverse("dashboard"))

        self.assertEqual(
            [item["id"] for item in list_response.data["results"]],
            [self.community_a.pk],
        )
        self.assertEqual(hidden_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            dashboard_response.data["data"]["metrics"]["community_count"],
            1,
        )
        self.assertEqual(
            dashboard_response.data["data"]["metrics"]["resource_count"],
            1,
        )

    def test_programme_manager_thematic_assignment_scopes_communities_and_themes(self):
        user, profile = self.make_user(
            UserRole.PROGRAMME_MANAGER,
            "scoped.programme",
        )
        profile.assigned_thematic_areas.add(self.theme_a)
        self.client.force_authenticate(user)

        communities = self.client.get(reverse("community-list"))
        themes = self.client.get(reverse("thematic-area-list"))

        self.assertEqual(
            [item["id"] for item in communities.data["results"]],
            [self.community_a.pk],
        )
        self.assertEqual(
            [item["id"] for item in themes.data["results"]],
            [self.theme_a.pk],
        )

    def test_pii_and_financial_fields_are_masked_by_capability(self):
        finance, _profile = self.make_user(
            UserRole.FINANCE_ADMINISTRATOR,
            "finance.reader",
        )
        field, _profile = self.make_user(UserRole.FIELD_OFFICER, "field.reader")

        self.client.force_authenticate(finance)
        member_response = self.client.get(
            reverse("member-detail", kwargs={"pk": self.member_a.pk})
        )
        resource_response = self.client.get(
            reverse("resource-detail", kwargs={"pk": self.resource_a.pk})
        )
        self.assertIsNone(member_response.data["phone"])
        self.assertIsNone(member_response.data["email"])
        self.assertEqual(resource_response.data["value_amount"], "125000.00")

        self.client.force_authenticate(field)
        member_response = self.client.get(
            reverse("member-detail", kwargs={"pk": self.member_a.pk})
        )
        resource_response = self.client.get(
            reverse("resource-detail", kwargs={"pk": self.resource_a.pk})
        )
        self.assertEqual(member_response.data["phone"], "+256700000001")
        self.assertIsNone(resource_response.data["value_amount"])
        self.assertIsNone(resource_response.data["value_currency"])

    def test_communications_resource_output_is_publication_safe(self):
        user, _profile = self.make_user(
            UserRole.COMMUNICATIONS_VIEWER,
            "communications.reader",
        )
        self.client.force_authenticate(user)

        response = self.client.get(
            reverse("resource-detail", kwargs={"pk": self.resource_a.pk})
        )
        member_response = self.client.get(reverse("member-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for field in (
            "value_amount",
            "owner_id",
            "source_notes",
            "serial_or_tag_number",
            "sync_version",
        ):
            if field == "value_amount":
                self.assertIsNone(response.data[field])
            else:
                self.assertNotIn(field, response.data)
        self.assertEqual(member_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_restore_requires_explicit_capability(self):
        self.community_a.is_deleted = True
        self.community_a.save(update_fields=["is_deleted", "updated_at"])
        field, _profile = self.make_user(UserRole.FIELD_OFFICER, "restore.field")
        manager, _profile = self.make_user(
            UserRole.PROGRAMME_MANAGER,
            "restore.manager",
        )
        restore_url = reverse(
            "community-restore",
            kwargs={"pk": self.community_a.pk},
        )

        self.client.force_authenticate(field)
        denied = self.client.post(restore_url, format="json")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(manager)
        restored = self.client.post(restore_url, format="json")
        self.assertEqual(restored.status_code, status.HTTP_200_OK)
        self.community_a.refresh_from_db()
        self.assertFalse(self.community_a.is_deleted)

    def test_admin_can_save_scope_assignments(self):
        admin, _profile = self.make_user(
            UserRole.SYSTEM_ADMINISTRATOR,
            "scope.admin",
        )
        self.client.force_authenticate(admin)

        response = self.client.post(
            reverse("admin-user-list"),
            {
                "username": "assigned.user",
                "password": "StrongPassword123!",
                "role": UserRole.FIELD_OFFICER,
                "workforce_type": "staff",
                "is_active": True,
                "assigned_districts": [" Assigned District "],
                "assigned_community_ids": [self.community_a.pk],
                "assigned_thematic_area_ids": [self.theme_a.pk],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data["data"]["user"]
        self.assertEqual(data["assigned_districts"], ["Assigned District"])
        self.assertEqual(data["assigned_community_ids"], [self.community_a.pk])
        self.assertEqual(data["assigned_thematic_area_ids"], [self.theme_a.pk])
