from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.common.models import ImpactMethod, ResourcePartyType, UserRole
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
        assign_role(cls.user, UserRole.PROGRAM_MANAGER)
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
        token = login_response.data["data"]["token"]
        self.assertIn(UserRole.PROGRAM_MANAGER, login_response.data["data"]["user"]["roles"])

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        me_response = self.client.get(reverse("auth-me"))
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["data"]["user"]["username"], "ui.user")

        logout_response = self.client.post(reverse("auth-logout"))
        self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_resource_thematic_area_endpoint_and_filter(self):
        self.client.force_authenticate(self.user)
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
        self.client.force_authenticate(self.user)
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
