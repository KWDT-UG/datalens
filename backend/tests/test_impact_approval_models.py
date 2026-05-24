from datetime import date

from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.approvals.models import ApprovalRequest
from apps.common.models import ApprovalActionType, ApprovalStatus, ImpactMethod, ResourcePartyType
from apps.communities.models import Community
from apps.groups.models import Group
from apps.members.models import Member
from apps.resources.models import Resource
from apps.impacts.models import ImpactRecord


class ImpactApprovalModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.community = Community.objects.create(name="Impact One")
        cls.other_community = Community.objects.create(name="Impact Two")
        cls.group = Group.objects.create(
            community=cls.community,
            code="GRP-I1",
            name="Impact Group",
        )
        cls.other_group = Group.objects.create(
            community=cls.other_community,
            code="GRP-I2",
            name="Other Group",
        )
        cls.member = Member.objects.create(
            community=cls.community,
            group=cls.group,
            first_name="Mira",
            last_name="Impact",
        )
        cls.other_member = Member.objects.create(
            community=cls.other_community,
            group=cls.other_group,
            first_name="Owen",
            last_name="Other",
        )
        cls.resource = Resource.objects.create(
            community=cls.community,
            owner_type=ResourcePartyType.GROUP,
            owner_id=cls.group.id,
            name="Impact Resource",
        )

    def test_impact_record_validation_matrix(self):
        cases = [
            {
                "label": "beneficiary fields must be paired",
                "payload": {
                    "resource": self.resource,
                    "beneficiary_type": ResourcePartyType.MEMBER,
                    "method": ImpactMethod.OBSERVED,
                },
                "field": "beneficiary_id",
            },
            {
                "label": "beneficiary from another community",
                "payload": {
                    "resource": self.resource,
                    "beneficiary_type": ResourcePartyType.MEMBER,
                    "beneficiary_id": self.other_member.id,
                },
                "field": "beneficiary_id",
            },
            {
                "label": "period end before start",
                "payload": {
                    "resource": self.resource,
                    "period_start": date(2026, 5, 4),
                    "period_end": date(2026, 5, 1),
                },
                "field": "period_end",
            },
        ]

        for case in cases:
            with self.subTest(case=case["label"]):
                record = ImpactRecord(**case["payload"])
                with self.assertRaises(ValidationError) as error:
                    record.full_clean()
                self.assertIn(case["field"], error.exception.message_dict)

    def test_impact_record_allows_optional_beneficiary(self):
        record = ImpactRecord.objects.create(
            resource=self.resource,
            period_type="monthly",
            as_of_date=date(2026, 5, 4),
            beneficiary_count=12,
            method=ImpactMethod.OBSERVED,
        )
        self.assertIsNotNone(record.pk)

    def test_approval_request_defaults(self):
        approval = ApprovalRequest.objects.create(
            community=self.community,
            entity_type="resource",
            entity_id=self.resource.id,
            action_type=ApprovalActionType.UPDATE,
            submitted_payload={"status": "active"},
        )

        self.assertEqual(approval.status, ApprovalStatus.PENDING)
        self.assertIsNotNone(approval.submitted_at)
