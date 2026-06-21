from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.common.email import EmailDeliveryError
from apps.common.models import (
    InvitationStatus,
    UserInvitation,
    UserRole,
    WorkforceType,
)
from apps.common.permissions import assign_role


class AdminApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.system_admin = get_user_model().objects.create_user(
            username="system.admin",
            email="system.admin@example.com",
            password="test-password",
        )
        assign_role(cls.system_admin, UserRole.SYSTEM_ADMINISTRATOR)
        cls.manager = get_user_model().objects.create_user(
            username="programme.manager",
            password="test-password",
        )
        assign_role(cls.manager, UserRole.PROGRAMME_MANAGER)
        cls.field_user = get_user_model().objects.create_user(
            username="field.user",
            password="test-password",
        )
        assign_role(cls.field_user, UserRole.FIELD_OFFICER)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.system_admin)

    def test_system_administrator_can_list_users_and_roles(self):
        users_response = self.client.get(reverse("admin-user-list"))
        roles_response = self.client.get(reverse("admin-role-list"))

        self.assertEqual(users_response.status_code, status.HTTP_200_OK)
        self.assertEqual(users_response.data["meta"]["count"], 3)
        self.assertEqual(roles_response.status_code, status.HTTP_200_OK)
        self.assertEqual(roles_response.data["meta"]["count"], len(UserRole.values))
        role_values = {role["value"] for role in roles_response.data["data"]["roles"]}
        self.assertEqual(role_values, set(UserRole.values))

    def test_non_system_administrator_cannot_manage_users(self):
        self.client.force_authenticate(self.manager)

        response = self.client.get(reverse("admin-user-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_system_administrator_can_create_and_update_user(self):
        create_response = self.client.post(
            reverse("admin-user-list"),
            {
                "username": "new.user",
                "email": "new.user@example.com",
                "password": "StrongPassword123!",
                "role": UserRole.RESOURCE_PROCUREMENT_OFFICER,
                "first_name": "New",
                "last_name": "User",
                "workforce_type": WorkforceType.CONTRACTOR,
                "position_title": "Procurement Consultant",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        user_id = create_response.data["data"]["user"]["id"]

        update_response = self.client.patch(
            reverse("admin-user-detail", kwargs={"user_id": user_id}),
            {
                "role": UserRole.MONITORING_EVALUATION_MANAGER,
                "is_active": False,
            },
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertFalse(update_response.data["data"]["user"]["is_active"])
        self.assertEqual(
            update_response.data["data"]["user"]["role"],
            UserRole.MONITORING_EVALUATION_MANAGER,
        )

        user = get_user_model().objects.get(pk=user_id)
        self.assertEqual(
            set(user.groups.values_list("name", flat=True)),
            {UserRole.MONITORING_EVALUATION_MANAGER},
        )
        self.assertEqual(user.datalens_profile.workforce_type, WorkforceType.CONTRACTOR)
        self.assertEqual(user.datalens_profile.position_title, "Procurement Consultant")

    def test_system_administrator_cannot_deactivate_or_demote_self(self):
        cases = [
            {"payload": {"is_active": False}, "field": "is_active"},
            {"payload": {"role": UserRole.FIELD_OFFICER}, "field": "role"},
        ]

        for case in cases:
            with self.subTest(field=case["field"]):
                response = self.client.patch(
                    reverse(
                        "admin-user-detail",
                        kwargs={"user_id": self.system_admin.id},
                    ),
                    case["payload"],
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(case["field"], response.data)

    def test_duplicate_username_is_rejected(self):
        response = self.client.post(
            reverse("admin-user-list"),
            {
                "username": self.field_user.username.upper(),
                "password": "StrongPassword123!",
                "role": UserRole.FIELD_OFFICER,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        FRONTEND_APP_URL="http://frontend.test",
    )
    def test_invitation_can_be_sent_and_accepted_once(self):
        invitation_response = self.client.post(
            reverse("admin-invitation-list"),
            {
                "email": "invited.volunteer@example.com",
                "first_name": "Invited",
                "last_name": "Volunteer",
                "workforce_type": WorkforceType.VOLUNTEER,
                "position_title": "Community Data Volunteer",
                "role": UserRole.FIELD_OFFICER,
            },
            format="json",
        )
        self.assertEqual(invitation_response.status_code, status.HTTP_201_CREATED)
        invitation_url = invitation_response.data["data"]["invitation_url"]
        token = invitation_url.split("token=", 1)[1]
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(invitation_url, mail.outbox[0].body)

        self.client.force_authenticate(None)
        accept_response = self.client.post(
            reverse("accept-invitation"),
            {
                "token": token,
                "username": "invited.volunteer",
                "password": "StrongPassword123!",
            },
            format="json",
        )
        self.assertEqual(accept_response.status_code, status.HTTP_201_CREATED)
        user = get_user_model().objects.get(username="invited.volunteer")
        self.assertEqual(user.email, "invited.volunteer@example.com")
        self.assertEqual(user.first_name, "Invited")
        self.assertEqual(user.last_name, "Volunteer")
        self.assertEqual(user.datalens_profile.workforce_type, WorkforceType.VOLUNTEER)
        self.assertEqual(user.datalens_profile.position_title, "Community Data Volunteer")
        self.assertEqual(
            set(user.groups.values_list("name", flat=True)),
            {UserRole.FIELD_OFFICER},
        )

        reused_response = self.client.post(
            reverse("accept-invitation"),
            {
                "token": token,
                "username": "second.username",
                "password": "StrongPassword123!",
            },
            format="json",
        )
        self.assertEqual(reused_response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(
        MAILTRAP_API_KEY="sandbox-token",
        MAILTRAP_USE_SANDBOX=True,
        MAILTRAP_INBOX_ID="123456",
        DEFAULT_FROM_EMAIL="KWDT Data Lens <noreply@example.test>",
        FRONTEND_APP_URL="http://frontend.test",
    )
    @patch("apps.common.email.import_module")
    def test_invitation_uses_mailtrap_sandbox_when_configured(self, import_module):
        mailtrap = MagicMock()
        mailtrap.MailtrapClient.return_value.send.return_value = {
            "success": True,
            "message_ids": ["mailtrap-message-id"],
        }
        import_module.return_value = mailtrap

        response = self.client.post(
            reverse("admin-invitation-list"),
            {
                "email": "sandbox.invited@example.com",
                "workforce_type": WorkforceType.STAFF,
                "role": UserRole.FIELD_OFFICER,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        mailtrap.MailtrapClient.assert_called_once_with(
            token="sandbox-token",
            sandbox=True,
            inbox_id="123456",
        )
        self.assertEqual(UserInvitation.objects.count(), 1)

    @patch(
        "apps.common.admin_api.send_transactional_email",
        side_effect=EmailDeliveryError("provider unavailable"),
    )
    def test_failed_invitation_delivery_rolls_back_creation(self, _send_email):
        response = self.client.post(
            reverse("admin-invitation-list"),
            {
                "email": "failed.delivery@example.com",
                "workforce_type": WorkforceType.STAFF,
                "role": UserRole.FIELD_OFFICER,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(UserInvitation.objects.count(), 0)

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        FRONTEND_APP_URL="http://localhost:5173",
    )
    def test_invitation_url_uses_request_origin_when_frontend_url_is_local(self):
        invitation_response = self.client.post(
            reverse("admin-invitation-list"),
            {
                "email": "railway.invited@example.com",
                "first_name": "Railway",
                "last_name": "Invite",
                "workforce_type": WorkforceType.STAFF,
                "position_title": "Staging Tester",
                "role": UserRole.PROGRAMME_MANAGER,
            },
            format="json",
            HTTP_ORIGIN="https://datalens-staging.up.railway.app",
        )

        self.assertEqual(invitation_response.status_code, status.HTTP_201_CREATED)
        invitation_url = invitation_response.data["data"]["invitation_url"]
        self.assertTrue(
            invitation_url.startswith(
                "https://datalens-staging.up.railway.app/accept-invite?token="
            )
        )
        self.assertIn(invitation_url, mail.outbox[0].body)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_invitation_expiry_and_revocation(self):
        self.client.post(
            reverse("admin-invitation-list"),
            {
                "email": "temporary.contractor@example.com",
                "workforce_type": WorkforceType.CONTRACTOR,
                "role": UserRole.COMMUNICATIONS_VIEWER,
            },
            format="json",
        )
        invitation = UserInvitation.objects.get(email="temporary.contractor@example.com")

        revoke_response = self.client.patch(
            reverse(
                "admin-invitation-detail",
                kwargs={"invitation_id": invitation.id},
            ),
            {"status": InvitationStatus.REVOKED},
            format="json",
        )
        self.assertEqual(revoke_response.status_code, status.HTTP_200_OK)
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, InvitationStatus.REVOKED)

        expired = UserInvitation.objects.create(
            email="expired.intern@example.com",
            workforce_type=WorkforceType.INTERN,
            role=UserRole.COMMUNICATIONS_VIEWER,
            token_hash="0" * 64,
            invited_by_user_id=self.system_admin.id,
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        list_response = self.client.get(reverse("admin-invitation-list"))
        serialized = {
            item["id"]: item for item in list_response.data["data"]["invitations"]
        }
        self.assertEqual(serialized[expired.id]["status"], "expired")
