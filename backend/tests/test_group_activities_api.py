from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import DatabaseError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.common.models import UserRole
from apps.common.permissions import assign_role
from apps.communities.models import Community
from apps.groups.models import ActivityParty, Group, GroupActivity
from apps.institutions.models import Institution
from apps.participation.models import Committee, Cooperative


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
        cls.cooperative = Cooperative.objects.create(
            community=cls.community, name="Activity Cooperative"
        )
        cls.institution = Institution.objects.create(
            community=cls.community, name="Activity Institution"
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
        self.assertEqual(create_response.data["parties"][0]["party_type"], "group")
        self.assertEqual(create_response.data["parties"][0]["role"], "subject")

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

    def test_activity_parties_support_entity_context_and_roles(self):
        response = self.client.post(
            reverse("group-activity-list"),
            {
                "community": self.community.id,
                "group": None,
                "activity_type": "training",
                "title": "Cooperative finance training",
                "starts_at": self.starts_at.isoformat(),
                "status": "planned",
                "parties": [
                    {
                        "party_type": "cooperative",
                        "party_id": self.cooperative.id,
                        "role": "subject",
                    },
                    {
                        "party_type": "institution",
                        "party_id": self.institution.id,
                        "role": "host",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(
            {
                (party["party_type"], party["role"])
                for party in response.data["parties"]
            },
            {("cooperative", "subject"), ("institution", "host")},
        )

        filtered = self.client.get(
            reverse("group-activity-list"),
            {"party_type": "institution", "party_id": self.institution.id},
        )
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in filtered.data["results"]],
            [response.data["id"]],
        )

    def test_training_may_be_committee_specific(self):
        response = self.client.post(
            reverse("group-activity-list"),
            {
                "community": self.community.id,
                "group": self.group.id,
                "committee": self.committee.id,
                "activity_type": "training",
                "title": "Committee governance training",
                "starts_at": self.starts_at.isoformat(),
                "status": "planned",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        subject = next(
            party for party in response.data["parties"] if party["role"] == "subject"
        )
        self.assertEqual(subject["party_type"], "committee")

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

    def test_party_filters_apply_to_the_same_association(self):
        another_institution = Institution.objects.create(
            community=self.community, name="Second Activity Institution"
        )
        create_response = self.client.post(
            reverse("group-activity-list"),
            {
                "community": self.community.id,
                "activity_type": "meeting",
                "title": "Collision-safe filtering",
                "starts_at": self.starts_at.isoformat(),
                "status": "planned",
                "parties": [
                    {
                        "party_type": "group",
                        "party_id": self.group.id,
                        "role": "subject",
                    },
                    {
                        "party_type": "institution",
                        "party_id": another_institution.id,
                        "role": "host",
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        response = self.client.get(
            reverse("group-activity-list"),
            {"party_type": "institution", "party_id": self.group.id},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn(
            create_response.data["id"],
            [item["id"] for item in response.data["results"]],
        )

        for params in ({"party_type": "group"}, {"party_id": self.group.id}):
            with self.subTest(params=params):
                invalid = self.client.get(reverse("group-activity-list"), params)
                self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_legacy_and_party_updates_stay_synchronized(self):
        create_response = self.client.post(
            reverse("group-activity-list"),
            {
                "community": self.community.id,
                "activity_type": "training",
                "title": "Synchronized activity",
                "starts_at": self.starts_at.isoformat(),
                "status": "planned",
                "parties": [
                    {
                        "party_type": "cooperative",
                        "party_id": self.cooperative.id,
                        "role": "subject",
                    }
                ],
            },
            format="json",
        )
        activity_id = create_response.data["id"]
        self.assertIsNone(create_response.data["group"])

        legacy_update = self.client.patch(
            reverse("group-activity-detail", kwargs={"pk": activity_id}),
            {"group": self.group.id},
            format="json",
        )
        self.assertEqual(legacy_update.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [(party["party_type"], party["role"]) for party in legacy_update.data["parties"]],
            [("group", "subject")],
        )

        party_update = self.client.patch(
            reverse("group-activity-detail", kwargs={"pk": activity_id}),
            {
                "parties": [
                    {
                        "party_type": "committee",
                        "party_id": self.committee.id,
                        "role": "subject",
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(party_update.status_code, status.HTTP_200_OK)
        self.assertIsNone(party_update.data["group"])
        self.assertEqual(party_update.data["committee"], self.committee.id)

        invalid_community = self.client.patch(
            reverse("group-activity-detail", kwargs={"pk": activity_id}),
            {"community": self.other_community.id},
            format="json",
        )
        self.assertEqual(invalid_community.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(
            {"committee", "parties"} & set(invalid_community.data),
            invalid_community.data,
        )

    def test_party_replacement_rolls_back_with_activity_write(self):
        url = reverse("group-activity-list")
        payload = {
            "community": self.community.id,
            "activity_type": "meeting",
            "title": "Atomic activity",
            "starts_at": self.starts_at.isoformat(),
            "status": "planned",
            "parties": [
                {
                    "party_type": "group",
                    "party_id": self.group.id,
                    "role": "subject",
                }
            ],
        }
        with patch.object(
            ActivityParty.objects, "bulk_create", side_effect=DatabaseError("boom")
        ):
            with self.assertRaises(DatabaseError):
                self.client.post(url, payload, format="json")
        self.assertFalse(GroupActivity.objects.filter(title="Atomic activity").exists())

    def test_archived_party_name_remains_on_historical_activity(self):
        response = self.client.post(
            reverse("group-activity-list"),
            {
                "community": self.community.id,
                "activity_type": "meeting",
                "title": "Institution history",
                "starts_at": self.starts_at.isoformat(),
                "status": "completed",
                "parties": [
                    {
                        "party_type": "institution",
                        "party_id": self.institution.id,
                        "role": "subject",
                    }
                ],
            },
            format="json",
        )
        self.institution.is_deleted = True
        self.institution.save(update_fields=["is_deleted"])
        detail = self.client.get(
            reverse("group-activity-detail", kwargs={"pk": response.data["id"]})
        )
        self.assertEqual(
            detail.data["parties"][0]["party_name"], self.institution.name
        )
        edit = self.client.patch(
            reverse("group-activity-detail", kwargs={"pk": response.data["id"]}),
            {
                "notes": "Historical correction",
                "parties": [
                    {
                        "party_type": "institution",
                        "party_id": self.institution.id,
                        "role": "subject",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(edit.status_code, status.HTTP_400_BAD_REQUEST, edit.data)
        self.assertIn("parties", edit.data)

        new_link = self.client.post(
            reverse("group-activity-list"),
            {
                "community": self.community.id,
                "activity_type": "meeting",
                "title": "Invalid archived link",
                "starts_at": self.starts_at.isoformat(),
                "status": "planned",
                "parties": [
                    {
                        "party_type": "institution",
                        "party_id": self.institution.id,
                        "role": "subject",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(new_link.status_code, status.HTTP_400_BAD_REQUEST)

    def test_communications_viewer_does_not_receive_institution_party(self):
        response = self.client.post(
            reverse("group-activity-list"),
            {
                "community": self.community.id,
                "activity_type": "meeting",
                "title": "Private institution link",
                "starts_at": self.starts_at.isoformat(),
                "status": "planned",
                "parties": [
                    {
                        "party_type": "institution",
                        "party_id": self.institution.id,
                        "role": "subject",
                    }
                ],
            },
            format="json",
        )
        viewer = get_user_model().objects.create_user(
            username="communications.activity", password="test-password"
        )
        assign_role(viewer, UserRole.COMMUNICATIONS_VIEWER)
        self.client.force_authenticate(viewer)
        detail = self.client.get(
            reverse("group-activity-detail", kwargs={"pk": response.data["id"]})
        )
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["parties"], [])
