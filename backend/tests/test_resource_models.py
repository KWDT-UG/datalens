from datetime import datetime, timezone

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.common.models import (
    BeneficiaryRelationshipType,
    ResourceEventType,
    ResourcePartyType,
    ResourceType,
)
from apps.communities.models import Community
from apps.groups.models import Group
from apps.institutions.models import Institution
from apps.members.models import Member
from apps.participation.models import Cooperative
from apps.resources.models import (
    Resource,
    ResourceBeneficiary,
    ResourceStatusEvent,
    ResourceThematicArea,
    ThematicArea,
)


class ResourceModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.community = Community.objects.create(name="Resource One")
        cls.other_community = Community.objects.create(name="Resource Two")
        cls.group = Group.objects.create(
            community=cls.community,
            code="GRP-R1",
            name="Resource Group",
        )
        cls.other_group = Group.objects.create(
            community=cls.other_community,
            code="GRP-R2",
            name="Other Group",
        )
        cls.member = Member.objects.create(
            community=cls.community,
            group=cls.group,
            first_name="Ada",
            last_name="Member",
        )
        cls.other_member = Member.objects.create(
            community=cls.other_community,
            group=cls.other_group,
            first_name="Ben",
            last_name="Other",
        )
        cls.institution = Institution.objects.create(
            community=cls.community,
            code="INST-R1",
            name="Resource Clinic",
        )
        cls.other_institution = Institution.objects.create(
            community=cls.other_community,
            code="INST-R2",
            name="Other Clinic",
        )
        cls.cooperative = Cooperative.objects.create(
            community=cls.community,
            name="Resource Cooperative",
        )
        cls.other_cooperative = Cooperative.objects.create(
            community=cls.other_community,
            name="Other Cooperative",
        )
        cls.thematic_area = ThematicArea.objects.create(code="WASH", name="WASH")
        cls.other_thematic_area = ThematicArea.objects.create(
            code="EDU",
            name="Education",
        )

    def _resource_payload(self, owner_type, owner_id):
        return {
            "community": self.community,
            "owner_type": owner_type,
            "owner_id": owner_id,
            "resource_type": ResourceType.TOOL,
            "name": f"Resource {owner_type}",
        }

    def test_resource_owner_validation_matrix(self):
        valid_cases = [
            ("community", ResourcePartyType.COMMUNITY, self.community.id),
            ("group", ResourcePartyType.GROUP, self.group.id),
            ("cooperative", ResourcePartyType.COOPERATIVE, self.cooperative.id),
            ("member", ResourcePartyType.MEMBER, self.member.id),
            ("institution", ResourcePartyType.INSTITUTION, self.institution.id),
        ]
        invalid_cases = [
            ("missing group", ResourcePartyType.GROUP, 999999),
            ("cross-community group", ResourcePartyType.GROUP, self.other_group.id),
            (
                "cross-community cooperative",
                ResourcePartyType.COOPERATIVE,
                self.other_cooperative.id,
            ),
            ("cross-community member", ResourcePartyType.MEMBER, self.other_member.id),
            (
                "cross-community institution",
                ResourcePartyType.INSTITUTION,
                self.other_institution.id,
            ),
        ]

        for label, owner_type, owner_id in valid_cases:
            with self.subTest(case=label):
                resource = Resource(**self._resource_payload(owner_type, owner_id))
                resource.full_clean()

        for label, owner_type, owner_id in invalid_cases:
            with self.subTest(case=label):
                resource = Resource(**self._resource_payload(owner_type, owner_id))
                with self.assertRaises(ValidationError) as error:
                    resource.full_clean()
                self.assertIn("owner_id", error.exception.message_dict)

    def test_resource_beneficiary_validation_matrix(self):
        resource = Resource.objects.create(
            **self._resource_payload(ResourcePartyType.GROUP, self.group.id)
        )
        valid_cases = [
            ("community", ResourcePartyType.COMMUNITY, self.community.id),
            ("group", ResourcePartyType.GROUP, self.group.id),
            ("cooperative", ResourcePartyType.COOPERATIVE, self.cooperative.id),
            ("member", ResourcePartyType.MEMBER, self.member.id),
            ("institution", ResourcePartyType.INSTITUTION, self.institution.id),
        ]
        invalid_cases = [
            ("missing group", ResourcePartyType.GROUP, 999999),
            ("cross-community group", ResourcePartyType.GROUP, self.other_group.id),
            (
                "cross-community cooperative",
                ResourcePartyType.COOPERATIVE,
                self.other_cooperative.id,
            ),
            ("cross-community member", ResourcePartyType.MEMBER, self.other_member.id),
            (
                "cross-community institution",
                ResourcePartyType.INSTITUTION,
                self.other_institution.id,
            ),
        ]

        for label, beneficiary_type, beneficiary_id in valid_cases:
            with self.subTest(case=label):
                beneficiary = ResourceBeneficiary(
                    resource=resource,
                    beneficiary_type=beneficiary_type,
                    beneficiary_id=beneficiary_id,
                    relationship_type=BeneficiaryRelationshipType.PRIMARY,
                )
                beneficiary.full_clean()

        for label, beneficiary_type, beneficiary_id in invalid_cases:
            with self.subTest(case=label):
                beneficiary = ResourceBeneficiary(
                    resource=resource,
                    beneficiary_type=beneficiary_type,
                    beneficiary_id=beneficiary_id,
                )
                with self.assertRaises(ValidationError) as error:
                    beneficiary.full_clean()
                self.assertIn("beneficiary_id", error.exception.message_dict)

    def test_resource_thematic_area_uniqueness(self):
        resource = Resource.objects.create(
            **self._resource_payload(ResourcePartyType.GROUP, self.group.id)
        )
        ResourceThematicArea.objects.create(
            resource=resource,
            thematic_area=self.thematic_area,
            is_primary=True,
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            ResourceThematicArea.objects.create(
                resource=resource,
                thematic_area=self.thematic_area,
            )

    def test_resource_status_event_can_be_created(self):
        resource = Resource.objects.create(
            **self._resource_payload(ResourcePartyType.GROUP, self.group.id)
        )
        event = ResourceStatusEvent.objects.create(
            resource=resource,
            event_type=ResourceEventType.DELIVERED,
            effective_at=datetime(2026, 5, 4, 12, 0, tzinfo=timezone.utc),
            notes="Delivered to the group store.",
        )

        self.assertIsNotNone(event.pk)
        self.assertEqual(event.resource_id, resource.id)
