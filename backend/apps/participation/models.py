from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import CoreModel, MembershipStatus, RecordStatus
from apps.communities.models import Community
from apps.members.models import Member


class Committee(CoreModel):
    community = models.ForeignKey(
        Community,
        on_delete=models.PROTECT,
        related_name="committees",
    )
    name = models.CharField(max_length=255)
    committee_type = models.CharField(max_length=64, blank=True)
    status = models.CharField(
        max_length=32,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVE,
    )
    description = models.TextField(blank=True)
    formed_on = models.DateField(null=True, blank=True)
    closed_on = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["community__name", "name"]

    def clean(self) -> None:
        super().clean()
        if self.formed_on and self.closed_on and self.closed_on < self.formed_on:
            raise ValidationError(
                {"closed_on": "Closed date cannot be before formed date."}
            )

    def __str__(self) -> str:
        return f"{self.name} ({self.community.name})"


class CommitteeMembership(CoreModel):
    committee = models.ForeignKey(
        Committee,
        on_delete=models.PROTECT,
        related_name="memberships",
    )
    member = models.ForeignKey(
        Member,
        on_delete=models.PROTECT,
        related_name="committee_memberships",
    )
    role_name = models.CharField(max_length=128, blank=True)
    status = models.CharField(
        max_length=32,
        choices=MembershipStatus.choices,
        default=MembershipStatus.ACTIVE,
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["committee__name", "member__last_name", "member__first_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["committee", "member"],
                condition=models.Q(
                    status=MembershipStatus.ACTIVE,
                    is_deleted=False,
                ),
                name="unique_active_committee_membership",
            )
        ]

    def clean(self) -> None:
        super().clean()
        errors = {}
        if self.committee_id and self.member_id:
            committee_community_id = getattr(self.committee, "community_id", None)
            member_community_id = getattr(self.member, "community_id", None)
            if committee_community_id != member_community_id:
                errors["member"] = (
                    "Committee membership member must belong to the same community."
                )
        if self.start_date and self.end_date and self.end_date < self.start_date:
            errors["end_date"] = "End date cannot be before start date."
        if (
            self.committee_id
            and self.member_id
            and self.status == MembershipStatus.ACTIVE
            and CommitteeMembership.objects.filter(
                committee_id=self.committee_id,
                member_id=self.member_id,
                status=MembershipStatus.ACTIVE,
                is_deleted=False,
            )
            .exclude(pk=self.pk)
            .exists()
        ):
            errors["status"] = (
                "An active membership for this member and committee already exists."
            )
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"{self.member} -> {self.committee}"


class Cooperative(CoreModel):
    community = models.ForeignKey(
        Community,
        on_delete=models.PROTECT,
        related_name="cooperatives",
    )
    name = models.CharField(max_length=255)
    cooperative_type = models.CharField(max_length=64, blank=True)
    status = models.CharField(
        max_length=32,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVE,
    )
    description = models.TextField(blank=True)
    formed_on = models.DateField(null=True, blank=True)
    closed_on = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["community__name", "name"]

    def clean(self) -> None:
        super().clean()
        if self.formed_on and self.closed_on and self.closed_on < self.formed_on:
            raise ValidationError(
                {"closed_on": "Closed date cannot be before formed date."}
            )

    def __str__(self) -> str:
        return f"{self.name} ({self.community.name})"


class CooperativeMembership(CoreModel):
    cooperative = models.ForeignKey(
        Cooperative,
        on_delete=models.PROTECT,
        related_name="memberships",
    )
    member = models.ForeignKey(
        Member,
        on_delete=models.PROTECT,
        related_name="cooperative_memberships",
    )
    role_name = models.CharField(max_length=128, blank=True)
    status = models.CharField(
        max_length=32,
        choices=MembershipStatus.choices,
        default=MembershipStatus.ACTIVE,
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["cooperative__name", "member__last_name", "member__first_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["cooperative", "member"],
                condition=models.Q(
                    status=MembershipStatus.ACTIVE,
                    is_deleted=False,
                ),
                name="unique_active_cooperative_membership",
            )
        ]

    def clean(self) -> None:
        super().clean()
        errors = {}
        if self.cooperative_id and self.member_id:
            cooperative_community_id = getattr(self.cooperative, "community_id", None)
            member_community_id = getattr(self.member, "community_id", None)
            if cooperative_community_id != member_community_id:
                errors["member"] = (
                    "Cooperative membership member must belong to the same community."
                )
        if self.start_date and self.end_date and self.end_date < self.start_date:
            errors["end_date"] = "End date cannot be before start date."
        if (
            self.cooperative_id
            and self.member_id
            and self.status == MembershipStatus.ACTIVE
            and CooperativeMembership.objects.filter(
                cooperative_id=self.cooperative_id,
                member_id=self.member_id,
                status=MembershipStatus.ACTIVE,
                is_deleted=False,
            )
            .exclude(pk=self.pk)
            .exists()
        ):
            errors["status"] = (
                "An active membership for this member and cooperative already exists."
            )
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"{self.member} -> {self.cooperative}"
