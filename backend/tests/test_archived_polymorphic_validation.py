from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from apps.common.models import (
    BeneficiaryScope,
    PaymentEntryType,
    ResourcePartyType,
)
from apps.communities.models import Community
from apps.groups.models import (
    ActivityParty,
    ActivityPartyRole,
    ActivityPartyType,
    Group,
    GroupActivity,
    resolve_activity_party,
)
from apps.groups.serializers import GroupActivitySerializer
from apps.impacts.models import ImpactRecord
from apps.members.models import Member
from apps.resources.models import (
    Resource,
    ResourceBeneficiary,
    ResourcePaymentObligation,
    ResourcePaymentTransaction,
    resolve_resource_party,
)
from apps.resources.serializers import ResourceSerializer


class ArchivedPolymorphicPartyValidationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.community = Community.objects.create(name="Archived Party Community")
        cls.active_group = Group.objects.create(
            community=cls.community,
            code="ACTIVE-PARTY",
            name="Active Party Group",
        )
        cls.archived_group = Group.objects.create(
            community=cls.community,
            code="ARCHIVED-PARTY",
            name="Archived Party Group",
            is_deleted=True,
        )
        cls.member = Member.objects.create(
            community=cls.community,
            group=cls.active_group,
            first_name="Active",
            last_name="Member",
        )
        cls.resource = Resource.objects.create(
            community=cls.community,
            owner_type=ResourcePartyType.COMMUNITY,
            owner_id=cls.community.pk,
            name="Validation Resource",
        )
        cls.resource_beneficiary = ResourceBeneficiary.objects.create(
            resource=cls.resource,
            beneficiary_type=ResourcePartyType.MEMBER,
            beneficiary_id=cls.member.pk,
            benefit_scope=BeneficiaryScope.INDIVIDUAL,
        )
        cls.obligation = ResourcePaymentObligation.objects.create(
            resource=cls.resource,
            resource_beneficiary=cls.resource_beneficiary,
            responsible_party_type=ResourcePartyType.MEMBER,
            responsible_party_id=cls.member.pk,
            principal_amount=Decimal("100.00"),
        )
        cls.activity = GroupActivity.objects.create(
            community=cls.community,
            activity_type="meeting",
            title="Archived party validation",
            starts_at=timezone.now(),
        )

    def test_new_polymorphic_links_reject_archived_parties(self):
        cases = [
            (
                "resource owner",
                Resource(
                    community=self.community,
                    owner_type=ResourcePartyType.GROUP,
                    owner_id=self.archived_group.pk,
                    name="Invalid owner",
                ),
                "owner_id",
            ),
            (
                "resource beneficiary",
                ResourceBeneficiary(
                    resource=self.resource,
                    beneficiary_type=ResourcePartyType.GROUP,
                    beneficiary_id=self.archived_group.pk,
                ),
                "beneficiary_id",
            ),
            (
                "impact beneficiary",
                ImpactRecord(
                    resource=self.resource,
                    beneficiary_type=ResourcePartyType.GROUP,
                    beneficiary_id=self.archived_group.pk,
                ),
                "beneficiary_id",
            ),
            (
                "payment responsible party",
                ResourcePaymentObligation(
                    resource=self.resource,
                    resource_beneficiary=self.resource_beneficiary,
                    responsible_party_type=ResourcePartyType.GROUP,
                    responsible_party_id=self.archived_group.pk,
                    principal_amount=Decimal("100.00"),
                ),
                "responsible_party_id",
            ),
            (
                "payment received-from party",
                ResourcePaymentTransaction(
                    obligation=self.obligation,
                    entry_type=PaymentEntryType.DEPOSIT,
                    amount=Decimal("10.00"),
                    effective_on=date(2026, 10, 5),
                    received_from_type=ResourcePartyType.GROUP,
                    received_from_id=self.archived_group.pk,
                ),
                "received_from_id",
            ),
            (
                "activity party",
                ActivityParty(
                    activity=self.activity,
                    party_type=ActivityPartyType.GROUP,
                    party_id=self.archived_group.pk,
                    role=ActivityPartyRole.SUBJECT,
                ),
                "party_id",
            ),
        ]

        for label, instance, expected_field in cases:
            with self.subTest(case=label):
                with self.assertRaises(ValidationError) as error:
                    instance.full_clean()
                self.assertIn(expected_field, error.exception.message_dict)

    def test_updates_revalidate_archived_polymorphic_parties(self):
        historical_resource = Resource.objects.create(
            community=self.community,
            owner_type=ResourcePartyType.GROUP,
            owner_id=self.archived_group.pk,
            name="Historical resource",
        )
        ActivityParty.objects.create(
            activity=self.activity,
            party_type=ActivityPartyType.GROUP,
            party_id=self.archived_group.pk,
            role=ActivityPartyRole.SUBJECT,
        )

        cases = [
            (
                "resource update",
                ResourceSerializer(
                    historical_resource,
                    data={"name": "Renamed historical resource"},
                    partial=True,
                ),
                "owner_id",
            ),
            (
                "activity update",
                GroupActivitySerializer(
                    self.activity,
                    data={"title": "Renamed historical activity"},
                    partial=True,
                ),
                "parties",
            ),
        ]

        for label, serializer, expected_field in cases:
            with self.subTest(case=label):
                self.assertFalse(serializer.is_valid())
                self.assertIn(expected_field, serializer.errors)

    def test_historical_display_resolution_still_finds_archived_parties(self):
        self.assertEqual(
            resolve_resource_party(
                ResourcePartyType.GROUP,
                self.archived_group.pk,
            ),
            self.archived_group,
        )
        self.assertEqual(
            resolve_activity_party(
                ActivityPartyType.GROUP,
                self.archived_group.pk,
            ),
            self.archived_group,
        )
