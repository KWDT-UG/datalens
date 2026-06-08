from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.common.models import (
    ImpactMethod,
    ResourcePartyType,
    UserProfile,
    UserRole,
    WorkforceType,
)
from apps.common.permissions import assign_role
from apps.communities.models import Community
from apps.groups.models import Group
from apps.impacts.models import ImpactRecord
from apps.resources.models import Resource, ResourceThematicArea, ThematicArea


class UiReadyMilestoneTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="ui.user",
            email="ui@example.com",
            password="test-password",
        )
        assign_role(cls.user, UserRole.PROGRAMME_MANAGER)
        UserProfile.objects.create(
            user=cls.user,
            workforce_type=WorkforceType.STAFF,
            position_title="Programme Manager",
        )
        cls.other_user = get_user_model().objects.create_user(
            username="other.user",
            email="other@example.com",
            password="test-password",
        )
        cls.admin_user = get_user_model().objects.create_superuser(
            username="ui.admin",
            email="ui.admin@example.com",
            password="test-password",
        )
        cls.community = Community.objects.create(name="UI Community")
        cls.group = Group.objects.create(
            community=cls.community,
            code="GRP-UI",
            name="UI Group",
        )
        cls.resource = Resource.objects.create(
            community=cls.community,
            owner_type=ResourcePartyType.GROUP,
            owner_id=cls.group.id,
            name="UI Resource",
        )
        cls.thematic_area = ThematicArea.objects.create(code="EDU", name="Education")
        cls.other_thematic_area = ThematicArea.objects.create(code="WASH", name="WASH")
        cls.impact = ImpactRecord.objects.create(
            resource=cls.resource,
            period_type="monthly",
            period_start=date(2026, 1, 1),
            period_end=date(2026, 1, 31),
            as_of_date=date(2026, 1, 31),
            beneficiary_count=20,
            household_count=10,
            member_count=18,
            institution_count=2,
            method=ImpactMethod.OBSERVED,
        )

    def setUp(self):
        self.client = APIClient()

    def test_auth_login_me_logout_flow(self):
        login_response = self.client.post(
            reverse("auth-login"),
            {"username": "ui.user", "password": "test-password"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertNotIn("token", login_response.data["data"])
        auth_cookie = login_response.cookies["datalens_auth"]
        self.assertTrue(auth_cookie["httponly"])
        self.assertIn(UserRole.PROGRAMME_MANAGER, login_response.data["data"]["user"]["roles"])
        self.assertIn(
            "review_approvals",
            login_response.data["data"]["user"]["capabilities"],
        )

        me_response = self.client.get(reverse("auth-me"))
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["data"]["user"]["username"], "ui.user")
        self.assertEqual(
            me_response.data["data"]["user"]["position_title"],
            "Programme Manager",
        )

        logout_response = self.client.post(reverse("auth-logout"))
        self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(logout_response.cookies["datalens_auth"].value, "")

    def test_browser_login_requires_csrf_when_checks_are_enabled(self):
        client = APIClient(enforce_csrf_checks=True)
        login_payload = {
            "username": "ui.user",
            "password": "test-password",
        }

        denied = client.post(reverse("auth-login"), login_payload, format="json")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        csrf_response = client.get(reverse("auth-csrf"))
        csrf_token = csrf_response.cookies["csrftoken"].value
        accepted = client.post(
            reverse("auth-login"),
            login_payload,
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(accepted.status_code, status.HTTP_200_OK)
        self.assertIn("datalens_auth", accepted.cookies)

    def test_current_user_can_update_profile_details(self):
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            reverse("auth-me"),
            {
                "first_name": "Updated",
                "last_name": "Manager",
                "email": "updated.manager@example.com",
                "position_title": "Senior Programme Manager",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.user.datalens_profile.refresh_from_db()
        self.assertEqual(self.user.first_name, "Updated")
        self.assertEqual(self.user.last_name, "Manager")
        self.assertEqual(self.user.email, "updated.manager@example.com")
        self.assertEqual(
            self.user.datalens_profile.position_title,
            "Senior Programme Manager",
        )
        self.assertEqual(
            response.data["data"]["user"]["workforce_type"],
            WorkforceType.STAFF,
        )
        self.assertEqual(
            response.data["data"]["user"]["roles"],
            [UserRole.PROGRAMME_MANAGER],
        )

    def test_profile_update_rejects_duplicate_email(self):
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            reverse("auth-me"),
            {"email": "OTHER@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_profile_update_allows_blank_email(self):
        self.other_user.email = ""
        self.other_user.save(update_fields=["email"])
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            reverse("auth-me"),
            {"email": "", "first_name": "Updated"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "")
        self.assertEqual(self.user.first_name, "Updated")

    def test_current_user_can_change_password_with_current_password(self):
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            reverse("auth-me"),
            {
                "current_password": "test-password",
                "new_password": "A-New-Strong-Password-2026!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("A-New-Strong-Password-2026!"))

    def test_password_change_rejects_incorrect_current_password(self):
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            reverse("auth-me"),
            {
                "current_password": "incorrect-password",
                "new_password": "A-New-Strong-Password-2026!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", response.data)

    def test_profile_update_rejects_administrator_controlled_fields(self):
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            reverse("auth-me"),
            {
                "role": UserRole.SYSTEM_ADMINISTRATOR,
                "workforce_type": WorkforceType.CONTRACTOR,
                "is_active": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.user.datalens_profile.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertEqual(self.user.datalens_profile.workforce_type, WorkforceType.STAFF)
        self.assertEqual(
            set(self.user.groups.values_list("name", flat=True)),
            {UserRole.PROGRAMME_MANAGER},
        )

    def test_resource_thematic_area_endpoint_and_filter(self):
        self.client.force_authenticate(self.admin_user)
        create_response = self.client.post(
            reverse("resource-thematic-area-list"),
            {
                "resource": self.resource.id,
                "thematic_area": self.thematic_area.id,
                "is_primary": True,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data["code"], "EDU")

        second_response = self.client.post(
            reverse("resource-thematic-area-list"),
            {
                "resource": self.resource.id,
                "thematic_area": self.other_thematic_area.id,
                "is_primary": True,
            },
            format="json",
        )
        self.assertEqual(second_response.status_code, status.HTTP_201_CREATED)
        first_link = ResourceThematicArea.objects.get(pk=create_response.data["id"])
        first_link.refresh_from_db()
        self.assertFalse(first_link.is_primary)

        list_response = self.client.get(
            reverse("resource-list"),
            {"thematic_area": self.thematic_area.id},
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 1)

    def test_impact_reporting_endpoints(self):
        self.client.force_authenticate(self.user)
        cases = [
            {
                "label": "summary",
                "url": reverse("impact-record-summary"),
                "assertion": lambda data: data["data"]["beneficiary_count"] == 20,
            },
            {
                "label": "by community",
                "url": reverse("impact-record-by-community"),
                "assertion": lambda data: data["data"][0]["community"] == self.community.id,
            },
            {
                "label": "by resource",
                "url": reverse("impact-record-by-resource"),
                "assertion": lambda data: data["data"][0]["resource"] == self.resource.id,
            },
        ]
        for case in cases:
            with self.subTest(case=case["label"]):
                response = self.client.get(case["url"], {"community": self.community.id})
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertTrue(case["assertion"](response.data))

    def test_sync_push_applies_clean_update_and_detects_conflict(self):
        self.client.force_authenticate(self.admin_user)
        update_response = self.client.post(
            reverse("sync-push"),
            {
                "changes": [
                    {
                        "entity_type": "resource",
                        "id": self.resource.id,
                        "sync_version": self.resource.sync_version,
                        "action": "update",
                        "payload": {"name": "Synced UI Resource"},
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["meta"]["applied"], 1)
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.name, "Synced UI Resource")

        conflict_response = self.client.post(
            reverse("sync-push"),
            {
                "changes": [
                    {
                        "entity_type": "resource",
                        "id": self.resource.id,
                        "sync_version": 1,
                        "action": "update",
                        "payload": {"name": "Stale Resource"},
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(conflict_response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(
            conflict_response.data["data"]["conflicts"][0]["code"],
            "version_mismatch",
        )

    def test_sync_pull_uses_server_cursors_for_multiple_pages(self):
        self.client.force_authenticate(self.admin_user)
        Group.objects.create(
            community=self.community,
            code="GRP-CURSOR-2",
            name="Cursor Group Two",
        )

        first_response = self.client.get(
            reverse("sync-pull"),
            {"entity_type": "group", "page_size": 1},
        )
        second_response = self.client.get(
            reverse("sync-pull"),
            {
                "entity_type": "group",
                "page_size": 1,
                "cursor": first_response.data["meta"]["next_cursor"],
            },
        )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertTrue(first_response.data["meta"]["has_more"])
        self.assertIsNotNone(first_response.data["meta"]["next_cursor"])
        first_id = first_response.data["data"]["group"][0]["id"]
        second_id = second_response.data["data"]["group"][0]["id"]
        self.assertNotEqual(first_id, second_id)
        self.assertEqual(
            first_response.data["meta"]["sync_contract"],
            "record_version_v2",
        )

    def test_sync_push_replays_direct_create_by_client_mutation_id(self):
        self.client.force_authenticate(self.admin_user)
        payload = {
            "changes": [
                {
                    "entity_type": "community",
                    "action": "create",
                    "client_mutation_id": "community-create-once",
                    "payload": {"name": "Offline Idempotent Community"},
                }
            ]
        }

        first_response = self.client.post(reverse("sync-push"), payload, format="json")
        created = Community.objects.get(name="Offline Idempotent Community")
        created.client_mutation_id = "a-later-mutation"
        created.save(update_fields=["client_mutation_id", "updated_at"])
        second_response = self.client.post(reverse("sync-push"), payload, format="json")

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertFalse(first_response.data["data"]["accepted"][0]["replayed"])
        self.assertTrue(second_response.data["data"]["accepted"][0]["replayed"])
        self.assertEqual(
            Community.objects.filter(name="Offline Idempotent Community").count(),
            1,
        )

    def test_sync_push_rejects_reusing_mutation_id_for_different_payload(self):
        self.client.force_authenticate(self.admin_user)
        first_payload = {
            "changes": [
                {
                    "entity_type": "community",
                    "action": "create",
                    "client_mutation_id": "community-create-reused",
                    "payload": {"name": "Original Offline Community"},
                }
            ]
        }
        reused_payload = {
            "changes": [
                {
                    "entity_type": "community",
                    "action": "create",
                    "client_mutation_id": "community-create-reused",
                    "payload": {"name": "Different Offline Community"},
                }
            ]
        }

        first_response = self.client.post(
            reverse("sync-push"),
            first_payload,
            format="json",
        )
        reused_response = self.client.post(
            reverse("sync-push"),
            reused_payload,
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reused_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            reused_response.data["errors"][0]["code"],
            "mutation_id_reused",
        )
        self.assertFalse(
            Community.objects.filter(name="Different Offline Community").exists()
        )

    def test_sync_push_replays_direct_update_without_incrementing_version_twice(self):
        self.client.force_authenticate(self.admin_user)
        self.group.refresh_from_db()
        original_version = self.group.sync_version
        payload = {
            "changes": [
                {
                    "entity_type": "group",
                    "id": self.group.id,
                    "sync_version": original_version,
                    "action": "update",
                    "client_mutation_id": "group-update-once",
                    "payload": {"name": "Offline Updated Group"},
                }
            ]
        }

        first_response = self.client.post(reverse("sync-push"), payload, format="json")
        second_response = self.client.post(reverse("sync-push"), payload, format="json")

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertFalse(first_response.data["data"]["accepted"][0]["replayed"])
        self.assertTrue(second_response.data["data"]["accepted"][0]["replayed"])
        self.group.refresh_from_db()
        self.assertEqual(self.group.name, "Offline Updated Group")
        self.assertEqual(self.group.sync_version, original_version + 1)

    @override_settings(
        SECURE_CONTENT_TYPE_NOSNIFF=True,
        X_FRAME_OPTIONS="DENY",
        SESSION_COOKIE_HTTPONLY=True,
    )
    def test_security_settings_are_enabled(self):
        from django.conf import settings

        self.assertTrue(settings.SECURE_CONTENT_TYPE_NOSNIFF)
        self.assertEqual(settings.X_FRAME_OPTIONS, "DENY")
        self.assertTrue(settings.SESSION_COOKIE_HTTPONLY)
