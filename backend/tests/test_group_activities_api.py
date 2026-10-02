from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.common.models import UserRole
from apps.common.permissions import assign_role
from apps.communities.models import Community
from apps.groups.models import Group, GroupActivity
from apps.participation.models import Committee


class GroupActivityApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="activity.officer", password="test-password"
        )
        assign_role(cls.user, UserRole.FIELD_OFFICER)
        cls.community = Community.objects.create(name="Activity Community")
        cls.other_community = Community.objects.create(name="Other Community")
        cls.group = Group.objects.create(
            community=cls.community, code="ACT-1", name="Activity Group"
        )
        cls.other_group = Group.objects.create(
            community=cls.other_community, code="ACT-2", name="Other Group"
        )
        cls.committee = Committee.objects.create(
            community=cls.community, name="WASH Committee"
        )
        cls.other_committee = Committee.objects.create(
            community=cls.other_community, name="Other Committee"
        )
        cls.starts_at = timezone.now() + timedelta(days=3)
        cls.activity = GroupActivity.objects.create(
            community=cls.community,
            group=cls.group,
            committee=cls.committee,
            activity_type="meeting",
            title="Monthly WASH review",
            starts_at=cls.starts_at,
            status="planned",
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_crud_and_nested_activity_endpoints(self):
        list_response = self.client.get(
            reverse("group-activity-list"), {"group": self.group.id}
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["results"][0]["title"], self.activity.title)

        detail_response = self.client.get(
            reverse("group-activity-detail", kwargs={"pk": self.activity.pk})
        )
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)

        nested_response = self.client.get(
            reverse("group-activities", kwargs={"pk": self.group.pk})
        )
        self.assertEqual(nested_response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in nested_response.data], [self.activity.id])

        create_response = self.client.post(
            reverse("group-activity-list"),
            {
                "community": self.community.id,
                "group": self.group.id,
                "activity_type": "training",
                "title": "Record keeping refresher",
                "starts_at": (self.starts_at + timedelta(days=4)).isoformat(),
                "status": "planned",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data["created_by_user_id"], self.user.id)

        update_response = self.client.patch(
            reverse("group-activity-detail", kwargs={"pk": self.activity.pk}),
            {
                "status": "completed",
                "women_attendance_count": 12,
                "men_attendance_count": 4,
                "minutes": "Members approved the maintenance plan.",
            },
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["actual_participant_count"], 16)
        self.assertEqual(update_response.data["record_status"], "complete")

    def test_relationship_and_date_validation(self):
        cases = [
            (
                "group community",
                {"group": self.other_group.id},
                "group",
            ),
            (
                "committee community",
                {"committee": self.other_committee.id},
                "committee",
            ),
            (
                "training committee",
                {"activity_type": "training", "committee": self.committee.id},
                "committee",
            ),
            (
                "end before start",
                {"ends_at": (self.starts_at - timedelta(hours=1)).isoformat()},
                "ends_at",
            ),
        ]
        base_payload = {
            "community": self.community.id,
            "group": self.group.id,
            "activity_type": "meeting",
            "title": "Invalid activity",
            "starts_at": self.starts_at.isoformat(),
            "status": "planned",
        }
        for label, change, field in cases:
            with self.subTest(label=label):
                response = self.client.post(
                    reverse("group-activity-list"),
                    {**base_payload, **change},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)

    def test_completed_activity_without_attendance_needs_attention(self):
        activity = GroupActivity.objects.create(
            community=self.community,
            group=self.group,
            activity_type="training",
            title="Incomplete training record",
            starts_at=self.starts_at,
            status="completed",
        )
        response = self.client.get(
            reverse("group-activity-detail", kwargs={"pk": activity.pk})
        )
        self.assertEqual(response.data["record_status"], "needs_attention")
