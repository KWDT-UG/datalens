from io import StringIO
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from apps.approvals.models import ApprovalRequest
from apps.common.models import (
    InvitationStatus,
    UserInvitation,
    UserProfile,
    UserRole,
    WorkforceType,
)
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
from apps.resources.models import (
    Resource,
    ResourceBeneficiary,
    ResourceStatusEvent,
    ResourceThematicArea,
    ThematicArea,
)


class ManagementCommandTests(TestCase):
    def test_seed_reference_data_is_idempotent(self):
        for run_number in (1, 2):
            with self.subTest(run=run_number):
                stdout = StringIO()
                call_command("seed_reference_data", stdout=stdout)
                self.assertIn("Reference data seeded", stdout.getvalue())

        self.assertEqual(ThematicArea.objects.count(), 4)
        self.assertSetEqual(
            set(ThematicArea.objects.values_list("code", flat=True)),
            {"WASH", "EDU", "ENV", "ECON"},
        )

    def test_seed_demo_data_is_idempotent(self):
        for run_number in (1, 2):
            with self.subTest(run=run_number):
                stdout = StringIO()
                call_command("seed_demo_data", stdout=stdout)
                self.assertIn("Demo data seeded", stdout.getvalue())

        self.assertEqual(Community.objects.filter(name="KWDT Demo Community").count(), 1)
        self.assertEqual(
            Community.objects.filter(name="KWDT Northern Demonstration Community").count(),
            1,
        )
        self.assertEqual(Community.objects.count(), 2)
        self.assertEqual(Group.objects.filter(code="KWDT-DEMO-GRP").count(), 1)
        self.assertEqual(Group.objects.count(), 5)
        self.assertEqual(Member.objects.filter(member_number="KWDT-DEMO-MEM-001").count(), 1)
        self.assertEqual(Member.objects.count(), 13)
        self.assertEqual(Institution.objects.filter(code="KWDT-DEMO-INS").count(), 1)
        self.assertEqual(Institution.objects.count(), 5)
        self.assertEqual(Committee.objects.filter(name="Demo Oversight Committee").count(), 1)
        self.assertEqual(Committee.objects.count(), 4)
        self.assertEqual(CommitteeMembership.objects.count(), 11)
        self.assertEqual(Cooperative.objects.filter(name="Demo Farmers Cooperative").count(), 1)
        self.assertEqual(Cooperative.objects.count(), 2)
        self.assertEqual(CooperativeMembership.objects.count(), 7)
        self.assertEqual(Resource.objects.filter(name="Demo Irrigation Pump").count(), 1)
        self.assertEqual(Resource.objects.count(), 7)
        self.assertEqual(ResourceThematicArea.objects.count(), 11)
        self.assertEqual(ResourceBeneficiary.objects.count(), 9)
        self.assertEqual(ResourceStatusEvent.objects.count(), 11)
        self.assertEqual(ImpactRecord.objects.count(), 7)
        self.assertEqual(ApprovalRequest.objects.count(), 3)
        self.assertEqual(
            get_user_model().objects.count(),
            9,
        )
        self.assertEqual(UserProfile.objects.count(), 9)
        local_admin = get_user_model().objects.get(username="admin")
        self.assertTrue(local_admin.is_active)
        self.assertTrue(local_admin.is_staff)
        self.assertTrue(local_admin.is_superuser)
        self.assertTrue(local_admin.check_password("adm!n@pass123"))
        self.assertEqual(
            set(local_admin.groups.values_list("name", flat=True)),
            {UserRole.SYSTEM_ADMINISTRATOR},
        )
        self.assertEqual(
            local_admin.datalens_profile.position_title,
            "Local System Administrator",
        )
        login_response = self.client.post(
            reverse("auth-login"),
            {"username": "admin", "password": "adm!n@pass123"},
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            login_response.data["data"]["user"]["username"],
            "admin",
        )
        self.assertTrue(
            UserProfile.objects.filter(workforce_type=WorkforceType.INTERN).exists()
        )
        self.assertTrue(
            UserProfile.objects.filter(workforce_type=WorkforceType.VOLUNTEER).exists()
        )
        self.assertTrue(
            UserProfile.objects.filter(workforce_type=WorkforceType.CONTRACTOR).exists()
        )
        self.assertEqual(UserInvitation.objects.count(), 3)
        self.assertSetEqual(
            set(UserInvitation.objects.values_list("status", flat=True)),
            {
                InvitationStatus.PENDING,
                InvitationStatus.ACCEPTED,
                InvitationStatus.REVOKED,
            },
        )

    def test_smoke_api_command_checks_seeded_endpoints(self):
        user = get_user_model().objects.create_user(
            username="smoke.user",
            password="test-password",
        )
        assign_role(user, UserRole.PROGRAMME_MANAGER)
        stdout = StringIO()

        call_command(
            "smoke_api",
            "--seed-demo-data",
            "--username",
            user.username,
            stdout=stdout,
        )

        output = stdout.getvalue()
        self.assertIn("OK   communities", output)
        self.assertIn("OK   resource-detail", output)
        self.assertIn("API smoke check passed.", output)

    def test_smoke_api_command_can_create_role_scoped_user(self):
        stdout = StringIO()

        call_command(
            "smoke_api",
            "--seed-demo-data",
            "--username",
            "created.smoke.user",
            "--create-user",
            stdout=stdout,
        )

        user = get_user_model().objects.get(username="created.smoke.user")
        self.assertEqual(
            set(user.groups.values_list("name", flat=True)),
            {UserRole.PROGRAMME_MANAGER},
        )
        self.assertIn("API smoke check passed.", stdout.getvalue())

    def test_purge_invitations_removes_terminal_records_after_retention(self):
        now = timezone.now()
        cases = [
            {
                "email": "accepted.old@example.com",
                "status": InvitationStatus.ACCEPTED,
                "token_hash": "a" * 64,
                "accepted_at": now - timedelta(days=31),
                "expires_at": now - timedelta(days=40),
                "should_purge": True,
            },
            {
                "email": "revoked.old@example.com",
                "status": InvitationStatus.REVOKED,
                "token_hash": "b" * 64,
                "revoked_at": now - timedelta(days=31),
                "expires_at": now + timedelta(days=1),
                "should_purge": True,
            },
            {
                "email": "expired.old@example.com",
                "status": InvitationStatus.PENDING,
                "token_hash": "c" * 64,
                "expires_at": now - timedelta(days=31),
                "should_purge": True,
            },
            {
                "email": "expired.recent@example.com",
                "status": InvitationStatus.PENDING,
                "token_hash": "d" * 64,
                "expires_at": now - timedelta(days=15),
                "should_purge": False,
            },
        ]
        for case in cases:
            invitation_data = {
                key: value for key, value in case.items() if key != "should_purge"
            }
            UserInvitation.objects.create(
                workforce_type=WorkforceType.STAFF,
                role=UserRole.FIELD_OFFICER,
                invited_by_user_id=1,
                **invitation_data,
            )

        stdout = StringIO()
        call_command("purge_invitations", "--older-than-days", "30", stdout=stdout)

        self.assertIn("Purged 3 invitation(s)", stdout.getvalue())
        remaining_emails = set(UserInvitation.objects.values_list("email", flat=True))
        self.assertEqual(remaining_emails, {"expired.recent@example.com"})
