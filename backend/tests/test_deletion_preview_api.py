from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.approvals.models import ApprovalRequest
from apps.common.models import (
    ApprovalActionType,
    PaymentEntryType,
    ResourcePartyType,
    UserRole,
)
from apps.common.permissions import assign_role
from apps.communities.models import Community
from apps.groups.models import Group
from apps.institutions.models import Institution
from apps.members.models import Member
from apps.resources.models import (
    Resource,
    ResourceBeneficiary,
    ResourcePaymentObligation,
    ResourcePaymentTransaction,
)


class DeletionPreviewApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_superuser(
            username="archive.preview.admin",
            email="archive.preview@example.com",
            password="test-password",
        )
        cls.community = Community.objects.create(name="Archive Preview")
        cls.group = Group.objects.create(
            community=cls.community,
            code="PREVIEW",
            name="Preview Group",
        )
        cls.member = Member.objects.create(
            community=cls.community,
            group=cls.group,
            first_name="Preview",
            last_name="Member",
        )
        cls.resource = Resource.objects.create(
            community=cls.community,
            owner_type=ResourcePartyType.GROUP,
            owner_id=cls.group.pk,
            name="Preview Resource",
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_preview_exposes_fk_and_polymorphic_references_without_cascade(self):
        response = self.client.get(
            reverse("group-deletion-preview", kwargs={"pk": self.group.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["action"], "archive")
        self.assertTrue(response.data["requires_confirmation"])
        self.assertTrue(response.data["is_reversible"])
        self.assertFalse(response.data["will_cascade"])
        self.assertFalse(response.data["can_archive"])
        by_relationship = {
            item["relationship"]: item for item in response.data["related_records"]
        }
        self.assertEqual(by_relationship["members"]["count"], 1)
        self.assertEqual(by_relationship["owner_type/owner_id"]["count"], 1)
        self.assertEqual(response.data["blocker_count"], 2)
        self.assertEqual(response.data["warning_count"], 0)

    def test_preview_for_empty_record_has_simple_reversible_confirmation(self):
        empty = Community.objects.create(name="Empty Duplicate")

        response = self.client.get(
            reverse("community-deletion-preview", kwargs={"pk": empty.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["related_record_count"], 0)
        self.assertEqual(response.data["related_records"], [])
        self.assertTrue(response.data["can_archive"])
        self.assertIn("restore", response.data["confirmation_message"].lower())

    def test_archive_is_blocked_and_does_not_cascade_to_related_records(self):
        response = self.client.delete(
            reverse("group-detail", kwargs={"pk": self.group.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["code"], "archive_blocked")
        self.assertFalse(response.data["archive_preview"]["can_archive"])
        self.group.refresh_from_db()
        self.member.refresh_from_db()
        self.resource.refresh_from_db()
        self.assertFalse(self.group.is_deleted)
        self.assertFalse(self.member.is_deleted)
        self.assertFalse(self.resource.is_deleted)

    def test_preview_hides_archived_related_records(self):
        self.member.is_deleted = True
        self.member.save(update_fields=["is_deleted", "updated_at"])

        response = self.client.get(
            reverse("group-deletion-preview", kwargs={"pk": self.group.pk})
        )

        relationships = {
            item["relationship"] for item in response.data["related_records"]
        }
        self.assertNotIn("members", relationships)

    def test_restore_is_blocked_until_archived_parent_is_restored(self):
        self.member.is_deleted = True
        self.member.save(update_fields=["is_deleted", "updated_at"])
        self.group.is_deleted = True
        self.group.save(update_fields=["is_deleted", "updated_at"])

        response = self.client.post(
            reverse("member-restore", kwargs={"pk": self.member.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["code"], "restore_blocked")
        self.assertEqual(response.data["restore_blockers"][0]["field"], "group")
        self.member.refresh_from_db()
        self.assertTrue(self.member.is_deleted)

    def test_financial_transaction_reference_is_retained_as_a_warning(self):
        institution = Institution.objects.create(
            community=self.community,
            name="Historical payer",
        )
        resource = Resource.objects.create(
            community=self.community,
            owner_type=ResourcePartyType.COMMUNITY,
            owner_id=self.community.pk,
            name="Financed resource",
        )
        beneficiary = ResourceBeneficiary.objects.create(
            resource=resource,
            beneficiary_type=ResourcePartyType.COMMUNITY,
            beneficiary_id=self.community.pk,
        )
        obligation = ResourcePaymentObligation.objects.create(
            resource=resource,
            resource_beneficiary=beneficiary,
            responsible_party_type=ResourcePartyType.COMMUNITY,
            responsible_party_id=self.community.pk,
            principal_amount=Decimal("100.00"),
        )
        transaction = ResourcePaymentTransaction.objects.create(
            obligation=obligation,
            entry_type=PaymentEntryType.DEPOSIT,
            amount=Decimal("10.00"),
            effective_on=date(2026, 10, 5),
            received_from_type=ResourcePartyType.INSTITUTION,
            received_from_id=institution.pk,
        )

        preview = self.client.get(
            reverse("institution-deletion-preview", kwargs={"pk": institution.pk})
        )

        self.assertEqual(preview.status_code, status.HTTP_200_OK)
        self.assertTrue(preview.data["can_archive"])
        self.assertEqual(preview.data["warning_count"], 1)
        self.assertEqual(preview.data["warnings"][0]["label"], "payment transactions")

        archived = self.client.delete(
            reverse("institution-detail", kwargs={"pk": institution.pk})
        )
        self.assertEqual(archived.status_code, status.HTTP_204_NO_CONTENT)
        transaction.refresh_from_db()
        self.assertFalse(transaction.is_deleted)

    def test_permanent_delete_removes_an_empty_record(self):
        empty = Community.objects.create(name="Permanent duplicate")

        preview = self.client.get(
            reverse(
                "community-permanent-delete-preview",
                kwargs={"pk": empty.pk},
            )
        )
        self.assertEqual(preview.status_code, status.HTTP_200_OK)
        self.assertTrue(preview.data["can_delete"])
        self.assertFalse(preview.data["is_reversible"])
        self.assertFalse(preview.data["will_cascade"])

        deleted = self.client.delete(
            reverse("community-permanent-delete", kwargs={"pk": empty.pk})
        )
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Community.objects.filter(pk=empty.pk).exists())

    def test_permanent_delete_rolls_back_if_more_than_the_target_would_be_removed(self):
        empty = Community.objects.create(name="Unexpected cascade target")

        with patch.object(Community, "delete", return_value=(2, {})):
            response = self.client.delete(
                reverse("community-permanent-delete", kwargs={"pk": empty.pk})
            )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["code"], "delete_blocked")
        self.assertTrue(Community.objects.filter(pk=empty.pk).exists())

    def test_permanent_delete_is_blocked_without_cascading_even_if_child_archived(self):
        self.member.is_deleted = True
        self.member.save(update_fields=["is_deleted", "updated_at"])
        self.resource.is_deleted = True
        self.resource.save(update_fields=["is_deleted", "updated_at"])

        response = self.client.delete(
            reverse("group-permanent-delete", kwargs={"pk": self.group.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["code"], "delete_blocked")
        self.assertGreaterEqual(response.data["delete_preview"]["blocker_count"], 2)
        self.assertTrue(Group.objects.filter(pk=self.group.pk).exists())
        self.assertTrue(Member.objects.filter(pk=self.member.pk).exists())
        self.assertTrue(Resource.objects.filter(pk=self.resource.pk).exists())

    def test_permanent_delete_preserves_generic_approval_history(self):
        target = Group.objects.create(
            community=self.community,
            code="APPROVAL-HISTORY",
            name="Approval history target",
        )
        ApprovalRequest.objects.create(
            community=self.community,
            entity_type="group",
            entity_id=target.pk,
            action_type=ApprovalActionType.UPDATE,
            submitted_payload={"name": "Proposed name"},
        )

        response = self.client.delete(
            reverse("group-permanent-delete", kwargs={"pk": target.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        blockers = response.data["delete_preview"]["blockers"]
        self.assertEqual(
            [item["label"] for item in blockers],
            ["approval requests"],
        )
        self.assertTrue(Group.objects.filter(pk=target.pk).exists())

    def test_permanent_delete_requires_temporary_mvp_capability(self):
        manager = get_user_model().objects.create_user(
            username="archive.only.manager",
            password="test-password",
        )
        assign_role(manager, UserRole.PROGRAMME_MANAGER)
        empty = Community.objects.create(name="Permission target")
        self.client.force_authenticate(manager)

        denied = self.client.get(
            reverse(
                "community-permanent-delete-preview",
                kwargs={"pk": empty.pk},
            )
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        full_access = get_user_model().objects.create_user(
            username="mvp.delete.user",
            password="test-password",
        )
        assign_role(full_access, UserRole.MVP_FULL_ACCESS)
        self.client.force_authenticate(full_access)
        allowed = self.client.delete(
            reverse("community-permanent-delete", kwargs={"pk": empty.pk})
        )
        self.assertEqual(allowed.status_code, status.HTTP_204_NO_CONTENT)

    def test_legacy_archived_status_does_not_soft_archive_a_record(self):
        legacy_status = Community.objects.create(
            name="Legacy Archived Status",
            status="archived",
        )

        list_response = self.client.get(
            reverse("community-list"),
            {"search": legacy_status.name},
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 1)
        self.assertEqual(list_response.data["results"][0]["status"], "archived")
        self.assertFalse(list_response.data["results"][0]["is_deleted"])
