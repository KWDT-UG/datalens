from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.approvals.models import ApprovalRequest
from apps.common.models import (
    ApprovalActionType,
    ApprovalStatus,
    MemberStatus,
    ResourcePartyType,
    UserRole,
)
from apps.common.permissions import assign_role
from apps.communities.models import Community
from apps.groups.models import Group
from apps.impacts.models import ImpactRecord
from apps.members.models import Member
from apps.resources.models import Resource, ResourceThematicArea, ThematicArea


class DashboardApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="dashboard.manager",
            password="test-password",
        )
        assign_role(cls.user, UserRole.PROGRAMME_MANAGER)
        cls.other_user = get_user_model().objects.create_user(
            username="dashboard.other",
            password="test-password",
        )
        cls.community = Community.objects.create(name="Dashboard Community")
        cls.group = Group.objects.create(
            community=cls.community,
            code="DASH-1",
            name="Dashboard Group",
        )
        Member.objects.create(
            community=cls.community,
            group=cls.group,
            first_name="Active",
            last_name="Member",
            status=MemberStatus.ACTIVE,
        )
        Member.objects.create(
            community=cls.community,
            group=cls.group,
            first_name="Inactive",
            last_name="Member",
            status=MemberStatus.INACTIVE,
        )
        cls.resource = Resource.objects.create(
            community=cls.community,
            owner_type=ResourcePartyType.GROUP,
            owner_id=cls.group.id,
            name="Dashboard Resource",
        )
        cls.wash = ThematicArea.objects.create(code="WASH", name="WASH")
        cls.education = ThematicArea.objects.create(code="EDU", name="Education")
        ResourceThematicArea.objects.create(
            resource=cls.resource,
            thematic_area=cls.wash,
            is_primary=True,
        )
        ImpactRecord.objects.create(
            resource=cls.resource,
            as_of_date=date(2024, 8, 1),
            beneficiary_count=25,
            household_count=8,
        )
        cls.other_resource = Resource.objects.create(
            community=cls.community,
            owner_type=ResourcePartyType.GROUP,
            owner_id=cls.group.id,
            name="Education Resource",
        )
        ResourceThematicArea.objects.create(
            resource=cls.other_resource,
            thematic_area=cls.education,
            is_primary=True,
        )
        ImpactRecord.objects.create(
            resource=cls.other_resource,
            as_of_date=date(2024, 6, 1),
            beneficiary_count=12,
        )
        ApprovalRequest.objects.create(
            community=cls.community,
            entity_type="resource",
            entity_id=cls.resource.id,
            action_type=ApprovalActionType.UPDATE,
            status=ApprovalStatus.PENDING,
            submitted_by_user_id=cls.other_user.id,
        )

    def setUp(self):
        self.client = APIClient()

    def test_dashboard_requires_authentication(self):
        response = self.client.get(reverse("dashboard"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_dashboard_returns_operation_wide_totals_and_recent_activity(self):
        self.client.force_authenticate(self.user)

        response = self.client.get(reverse("dashboard"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        metrics = response.data["data"]["metrics"]
        expected = {
            "community_count": 1,
            "group_count": 1,
            "active_member_count": 1,
            "resource_count": 2,
            "pending_approval_count": 1,
            "beneficiary_count": 37,
            "household_count": 8,
        }
        for field, value in expected.items():
            with self.subTest(field=field):
                self.assertEqual(metrics[field], value)

        activity_types = {
            item["type"] for item in response.data["data"]["recent_activity"]
        }
        self.assertIn("community", activity_types)
        self.assertIn("resource", activity_types)

    def test_dashboard_filters_programme_and_exposes_interactive_data(self):
        self.client.force_authenticate(self.user)

        response = self.client.get(
            reverse("dashboard"),
            {"thematic_area": "WASH", "period": "3"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]
        self.assertEqual(data["selected_thematic_area"], "WASH")
        self.assertEqual(data["selected_period"], "3")
        self.assertEqual(data["metrics"]["resource_count"], 1)
        self.assertEqual(data["metrics"]["beneficiary_count"], 25)
        self.assertEqual(
            data["impact_trend"],
            [{"as_of_date": date(2024, 8, 1), "beneficiary_count": 25}],
        )
        programme_lenses = {item["code"]: item for item in data["programme_lenses"]}
        self.assertEqual(programme_lenses["WASH"]["resource_count"], 1)
        self.assertEqual(programme_lenses["EDU"]["resource_count"], 1)
        self.assertEqual(data["attention"][0]["type"], "resource")

    def test_non_reviewer_pending_count_is_limited_to_own_requests(self):
        field_user = get_user_model().objects.create_user(
            username="dashboard.field",
            password="test-password",
        )
        assign_role(field_user, UserRole.FIELD_OFFICER)
        self.client.force_authenticate(field_user)

        response = self.client.get(reverse("dashboard"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["data"]["metrics"]["pending_approval_count"],
            0,
        )
from datetime import date
