from datetime import date

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.common.models import MembershipStatus
from apps.communities.models import Community
from apps.groups.models import Group
from apps.members.models import Member
from apps.participation.models import (
    Committee,
    CommitteeMembership,
    Cooperative,
    CooperativeMembership,
)


class GovernanceModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.community = Community.objects.create(name="Community A")
        cls.other_community = Community.objects.create(name="Community B")
        cls.group = Group.objects.create(
            community=cls.community,
            code="GRP-A",
            name="Group A",
        )
        cls.other_group = Group.objects.create(
            community=cls.other_community,
            code="GRP-B",
            name="Group B",
        )
        cls.member = Member.objects.create(
            community=cls.community,
            group=cls.group,
            first_name="Amina",
            last_name="One",
        )
        cls.other_member = Member.objects.create(
            community=cls.other_community,
            group=cls.other_group,
            first_name="Bala",
            last_name="Two",
        )
        cls.committee = Committee.objects.create(
            community=cls.community,
            name="Water Committee",
        )
        cls.cooperative = Cooperative.objects.create(
            community=cls.community,
            name="Savings Cooperative",
        )

    def test_governance_models_can_be_created(self):
        cases = [
            (
                "committee",
                Committee.objects.create,
                {"community": self.community, "name": "Education Committee"},
            ),
            (
                "committee membership",
                CommitteeMembership.objects.create,
                {
                    "committee": self.committee,
                    "member": self.member,
                    "role_name": "Chair",
                },
            ),
            (
                "cooperative",
                Cooperative.objects.create,
                {"community": self.community, "name": "Crop Cooperative"},
            ),
            (
                "cooperative membership",
                CooperativeMembership.objects.create,
                {
                    "cooperative": self.cooperative,
                    "member": self.member,
                    "role_name": "Treasurer",
                },
            ),
        ]

        for label, factory, payload in cases:
            with self.subTest(label=label):
                instance = factory(**payload)
                self.assertIsNotNone(instance.pk)
                self.assertEqual(instance.sync_version, 1)
                self.assertFalse(instance.is_deleted)

    def test_committee_membership_validation_matrix(self):
        cases = [
            {
                "label": "member from another community",
                "payload": {
                    "committee": self.committee,
                    "member": self.other_member,
                },
                "field": "member",
            },
            {
                "label": "end date before start date",
                "payload": {
                    "committee": self.committee,
                    "member": self.member,
                    "start_date": date(2026, 5, 1),
                    "end_date": date(2026, 4, 1),
                },
                "field": "end_date",
            },
        ]

        for case in cases:
            with self.subTest(case=case["label"]):
                membership = CommitteeMembership(**case["payload"])
                with self.assertRaises(ValidationError) as error:
                    membership.full_clean()
                self.assertIn(case["field"], error.exception.message_dict)

    def test_cooperative_membership_validation_matrix(self):
        cases = [
            {
                "label": "member from another community",
                "payload": {
                    "cooperative": self.cooperative,
                    "member": self.other_member,
                },
                "field": "member",
            },
            {
                "label": "end date before start date",
                "payload": {
                    "cooperative": self.cooperative,
                    "member": self.member,
                    "start_date": date(2026, 5, 1),
                    "end_date": date(2026, 4, 1),
                },
                "field": "end_date",
            },
        ]

        for case in cases:
            with self.subTest(case=case["label"]):
                membership = CooperativeMembership(**case["payload"])
                with self.assertRaises(ValidationError) as error:
                    membership.full_clean()
                self.assertIn(case["field"], error.exception.message_dict)

    def test_duplicate_active_committee_membership_is_rejected(self):
        CommitteeMembership.objects.create(
            committee=self.committee,
            member=self.member,
            status=MembershipStatus.ACTIVE,
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            CommitteeMembership.objects.create(
                committee=self.committee,
                member=self.member,
                status=MembershipStatus.ACTIVE,
            )

        archived_membership = CommitteeMembership.objects.create(
            committee=self.committee,
            member=self.member,
            status=MembershipStatus.ARCHIVED,
        )
        self.assertIsNotNone(archived_membership.pk)

    def test_duplicate_active_cooperative_membership_is_rejected(self):
        CooperativeMembership.objects.create(
            cooperative=self.cooperative,
            member=self.member,
            status=MembershipStatus.ACTIVE,
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            CooperativeMembership.objects.create(
                cooperative=self.cooperative,
                member=self.member,
                status=MembershipStatus.ACTIVE,
            )

        ended_membership = CooperativeMembership.objects.create(
            cooperative=self.cooperative,
            member=self.member,
            status=MembershipStatus.ENDED,
        )
        self.assertIsNotNone(ended_membership.pk)
