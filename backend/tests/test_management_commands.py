from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from apps.approvals.models import ApprovalRequest
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
        self.assertEqual(Committee.objects.count(), 3)
        self.assertEqual(CommitteeMembership.objects.count(), 8)
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

    def test_smoke_api_command_checks_seeded_endpoints(self):
        user = get_user_model().objects.create_user(
            username="smoke.user",
            password="test-password",
        )
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
