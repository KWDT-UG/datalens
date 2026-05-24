from datetime import date

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.common.models import InstitutionType, MemberStatus
from apps.communities.models import Community
from apps.groups.models import Group
from apps.institutions.models import Institution
from apps.members.models import Member


class CoreModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.community = Community.objects.create(
            name="Kawempe",
            district_name="Kampala",
        )
        cls.other_community = Community.objects.create(
            name="Mukono",
            district_name="Mukono",
        )
        cls.group = Group.objects.create(
            community=cls.community,
            code="GRP-A",
            name="Kawempe Group",
        )
        cls.other_group = Group.objects.create(
            community=cls.other_community,
            code="GRP-B",
            name="Mukono Group",
        )

    def test_core_models_can_be_created(self):
        cases = [
            (
                "community",
                Community.objects.create,
                {"name": "Entebbe"},
            ),
            (
                "group",
                Group.objects.create,
                {"community": self.community, "code": "GRP-C", "name": "New Group"},
            ),
            (
                "member",
                Member.objects.create,
                {
                    "community": self.community,
                    "group": self.group,
                    "member_number": "MEM-1",
                    "first_name": "Amina",
                    "last_name": "Okello",
                },
            ),
            (
                "institution",
                Institution.objects.create,
                {
                    "community": self.community,
                    "code": "SCH-1",
                    "name": "Kawempe School",
                    "institution_type": InstitutionType.SCHOOL,
                },
            ),
        ]

        for label, factory, payload in cases:
            with self.subTest(label=label):
                instance = factory(**payload)
                self.assertIsNotNone(instance.pk)
                self.assertEqual(instance.sync_version, 1)
                self.assertFalse(instance.is_deleted)

    def test_group_unique_constraints_are_community_scoped(self):
        cases = [
            {
                "label": "duplicate name",
                "payload": {
                    "community": self.community,
                    "code": "GRP-UNIQUE-CODE",
                    "name": self.group.name,
                },
            },
            {
                "label": "duplicate code",
                "payload": {
                    "community": self.community,
                    "code": self.group.code,
                    "name": "Unique Name",
                },
            },
        ]

        for case in cases:
            with self.subTest(case=case["label"]):
                with self.assertRaises(IntegrityError), transaction.atomic():
                    Group.objects.create(**case["payload"])

        matching_name_in_other_community = Group.objects.create(
            community=self.other_community,
            code="GRP-A-OTHER",
            name=self.group.name,
        )
        self.assertIsNotNone(matching_name_in_other_community.pk)

    def test_member_validation_matrix(self):
        cases = [
            {
                "label": "group in another community",
                "payload": {
                    "community": self.community,
                    "group": self.other_group,
                    "first_name": "Cross",
                    "last_name": "Community",
                },
                "field": "group",
            },
            {
                "label": "left before joined",
                "payload": {
                    "community": self.community,
                    "group": self.group,
                    "first_name": "Date",
                    "last_name": "Check",
                    "joined_on": date(2026, 4, 10),
                    "left_on": date(2026, 4, 1),
                },
                "field": "left_on",
            },
            {
                "label": "deceased but active",
                "payload": {
                    "community": self.community,
                    "group": self.group,
                    "first_name": "Status",
                    "last_name": "Check",
                    "status": MemberStatus.ACTIVE,
                    "deceased_on": date(2026, 4, 1),
                },
                "field": "status",
            },
        ]

        for case in cases:
            with self.subTest(case=case["label"]):
                member = Member(**case["payload"])
                with self.assertRaises(ValidationError) as error:
                    member.full_clean()
                self.assertIn(case["field"], error.exception.message_dict)

    def test_institution_unique_constraints_are_community_scoped(self):
        Institution.objects.create(
            community=self.community,
            code="INST-A",
            name="Community Clinic",
            institution_type=InstitutionType.CLINIC,
        )
        cases = [
            {
                "label": "duplicate name",
                "payload": {
                    "community": self.community,
                    "code": "INST-B",
                    "name": "Community Clinic",
                },
            },
            {
                "label": "duplicate code",
                "payload": {
                    "community": self.community,
                    "code": "INST-A",
                    "name": "Another Clinic",
                },
            },
        ]

        for case in cases:
            with self.subTest(case=case["label"]):
                with self.assertRaises(IntegrityError), transaction.atomic():
                    Institution.objects.create(**case["payload"])

        same_code_other_community = Institution.objects.create(
            community=self.other_community,
            code="INST-A",
            name="Mukono Clinic",
        )
        self.assertIsNotNone(same_code_other_community.pk)
