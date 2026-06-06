from datetime import datetime, timezone

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.common.models import (
    BeneficiaryRelationshipType,
    ResourceEventType,
    ResourcePartyType,
    ResourceStatus,
    ResourceType,
    UserRole,
)
from apps.common.permissions import assign_role
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


class ResourceApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="resource.user",
            password="test-password",
        )
        assign_role(cls.user, UserRole.RESOURCE_PROCUREMENT_OFFICER)
        cls.community = Community.objects.create(name="Resources")
        cls.other_community = Community.objects.create(name="Other")
        cls.group = Group.objects.create(
            community=cls.community,
            code="GRP-RES",
            name="Resource Group",
        )
        cls.other_group = Group.objects.create(
            community=cls.other_community,
            code="GRP-OTH",
            name="Other Group",
        )
        cls.member = Member.objects.create(
            community=cls.community,
            group=cls.group,
            first_name="Lina",
            last_name="Resource",
        )
        cls.other_member = Member.objects.create(
            community=cls.other_community,
            group=cls.other_group,
            first_name="Noah",
            last_name="Other",
        )
        cls.institution = Institution.objects.create(
            community=cls.community,
            code="INST-RES",
            name="Resource School",
        )
        cls.cooperative = Cooperative.objects.create(
            community=cls.community,
            name="Resource Coop",
        )
        cls.thematic_area = ThematicArea.objects.create(code="WASH", name="WASH")
        cls.other_thematic_area = ThematicArea.objects.create(
            code="ENV",
            name="Environment",
        )
        cls.resource = Resource.objects.create(
            community=cls.community,
            owner_type=ResourcePartyType.GROUP,
            owner_id=cls.group.id,
            resource_type=ResourceType.TOOL,
            name="Irrigation Pump",
            status=ResourceStatus.ACTIVE,
        )
        cls.resource_beneficiary = ResourceBeneficiary.objects.create(
            resource=cls.resource,
            beneficiary_type=ResourcePartyType.MEMBER,
            beneficiary_id=cls.member.id,
            relationship_type=BeneficiaryRelationshipType.PRIMARY,
        )
        cls.status_event = ResourceStatusEvent.objects.create(
            resource=cls.resource,
            event_type=ResourceEventType.CREATED,
            effective_at=datetime(2026, 5, 4, 10, 0, tzinfo=timezone.utc),
        )
        cls.thematic_link = ResourceThematicArea.objects.create(
            resource=cls.resource,
            thematic_area=cls.thematic_area,
            is_primary=True,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_thematic_area_crud_endpoints(self):
        response = self.client.get(reverse("thematic-area-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)

        create_response = self.client.post(
            reverse("thematic-area-list"),
            {
                "code": "ECON",
                "name": "Economic Empowerment",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        retrieve_response = self.client.get(
            reverse("thematic-area-detail", kwargs={"pk": self.thematic_area.pk})
        )
        self.assertEqual(retrieve_response.status_code, status.HTTP_200_OK)

        patch_response = self.client.patch(
            reverse("thematic-area-detail", kwargs={"pk": self.thematic_area.pk}),
            {"description": "Water and sanitation"},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)

    def test_resource_crud_endpoints(self):
        cases = [
            {
                "label": "list",
                "method": "get",
                "url": reverse("resource-list"),
                "status": status.HTTP_200_OK,
            },
            {
                "label": "retrieve",
                "method": "get",
                "url": reverse("resource-detail", kwargs={"pk": self.resource.pk}),
                "status": status.HTTP_200_OK,
            },
        ]

        for case in cases:
            with self.subTest(case=case["label"]):
                response = getattr(self.client, case["method"])(case["url"])
                self.assertEqual(response.status_code, case["status"])

        create_response = self.client.post(
            reverse("resource-list"),
            {
                "community": self.community.id,
                "owner_type": ResourcePartyType.COOPERATIVE,
                "owner_id": self.cooperative.id,
                "resource_type": ResourceType.MACHINERY,
                "name": "Rice Mill",
                "status": ResourceStatus.ACTIVE,
                "thematic_area_ids": [self.thematic_area.id, self.other_thematic_area.id],
                "primary_thematic_area_id": self.thematic_area.id,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(create_response.data["thematic_areas"]), 2)

        patch_response = self.client.patch(
            reverse("resource-detail", kwargs={"pk": self.resource.pk}),
            {
                "location_text": "Main storage building",
                "thematic_area_ids": [self.thematic_area.id],
                "primary_thematic_area_id": self.thematic_area.id,
            },
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data["location_text"], "Main storage building")

    def test_invalid_resource_owner_is_rejected(self):
        response = self.client.post(
            reverse("resource-list"),
            {
                "community": self.community.id,
                "owner_type": ResourcePartyType.GROUP,
                "owner_id": self.other_group.id,
                "resource_type": ResourceType.TOOL,
                "name": "Invalid Resource",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("owner_id", response.data)

    def test_resource_beneficiary_endpoints(self):
        list_response = self.client.get(reverse("resource-beneficiary-list"))
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertIn("results", list_response.data)

        create_response = self.client.post(
            reverse("resource-beneficiary-list"),
            {
                "resource": self.resource.id,
                "beneficiary_type": ResourcePartyType.INSTITUTION,
                "beneficiary_id": self.institution.id,
                "relationship_type": BeneficiaryRelationshipType.SECONDARY,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

    def test_invalid_resource_beneficiary_is_rejected(self):
        response = self.client.post(
            reverse("resource-beneficiary-list"),
            {
                "resource": self.resource.id,
                "beneficiary_type": ResourcePartyType.MEMBER,
                "beneficiary_id": self.other_member.id,
                "relationship_type": BeneficiaryRelationshipType.PRIMARY,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("beneficiary_id", response.data)

    def test_nested_resource_endpoints(self):
        cases = [
            {
                "label": "beneficiaries list",
                "method": "get",
                "url": reverse("resource-beneficiaries", kwargs={"pk": self.resource.pk}),
                "payload": None,
                "status": status.HTTP_200_OK,
            },
            {
                "label": "beneficiaries create",
                "method": "post",
                "url": reverse("resource-beneficiaries", kwargs={"pk": self.resource.pk}),
                "payload": {
                    "beneficiary_type": ResourcePartyType.INSTITUTION,
                    "beneficiary_id": self.institution.id,
                    "relationship_type": BeneficiaryRelationshipType.SECONDARY,
                },
                "status": status.HTTP_201_CREATED,
            },
            {
                "label": "status-events list",
                "method": "get",
                "url": reverse("resource-status-events", kwargs={"pk": self.resource.pk}),
                "payload": None,
                "status": status.HTTP_200_OK,
            },
            {
                "label": "status-events create",
                "method": "post",
                "url": reverse("resource-status-events", kwargs={"pk": self.resource.pk}),
                "payload": {
                    "event_type": ResourceEventType.DELIVERED,
                    "effective_at": "2026-05-04T12:30:00Z",
                    "notes": "Delivered to the site",
                },
                "status": status.HTTP_201_CREATED,
            },
            {
                "label": "detail",
                "method": "get",
                "url": reverse("resource-detail-view", kwargs={"pk": self.resource.pk}),
                "payload": None,
                "status": status.HTTP_200_OK,
            },
        ]

        for case in cases:
            with self.subTest(case=case["label"]):
                method = getattr(self.client, case["method"])
                if case["payload"] is None:
                    response = method(case["url"])
                else:
                    response = method(case["url"], case["payload"], format="json")
                self.assertEqual(response.status_code, case["status"])

    def test_resource_related_lists_filter_by_community_for_detail_tabs(self):
        cases = [
            {
                "label": "resources",
                "url": reverse("resource-list"),
                "expected_id": self.resource.id,
            },
            {
                "label": "resource beneficiaries",
                "url": reverse("resource-beneficiary-list"),
                "expected_id": self.resource_beneficiary.id,
            },
            {
                "label": "resource thematic areas",
                "url": reverse("resource-thematic-area-list"),
                "expected_id": self.thematic_link.id,
            },
        ]

        for case in cases:
            with self.subTest(endpoint=case["label"]):
                response = self.client.get(case["url"], {"community": self.community.id})
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data["count"], 1)
                self.assertEqual(response.data["results"][0]["id"], case["expected_id"])
