from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import CoreModel, MemberStatus
from apps.communities.models import Community
from apps.groups.models import Group


class Member(CoreModel):
    community = models.ForeignKey(
        Community,
        on_delete=models.PROTECT,
        related_name="members",
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.PROTECT,
        related_name="members",
    )
    member_number = models.CharField(max_length=64, blank=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    middle_name = models.CharField(max_length=150, blank=True)
    preferred_name = models.CharField(max_length=150, blank=True)
    gender = models.CharField(max_length=64, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=64, blank=True)
    email = models.EmailField(blank=True)
    address_text = models.TextField(blank=True)
    status = models.CharField(
        max_length=32,
        choices=MemberStatus.choices,
        default=MemberStatus.ACTIVE,
    )
    joined_on = models.DateField(null=True, blank=True)
    left_on = models.DateField(null=True, blank=True)
    deceased_on = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["community__name", "last_name", "first_name"]

    def clean(self) -> None:
        super().clean()
        errors = {}
        if self.group_id and self.community_id:
            group_community_id = getattr(self.group, "community_id", None)
            if group_community_id != self.community_id:
                errors["group"] = "Member group must belong to the same community."
        if self.joined_on and self.left_on and self.left_on < self.joined_on:
            errors["left_on"] = "Left date cannot be before joined date."
        if self.deceased_on and self.status == MemberStatus.ACTIVE:
            errors["status"] = "Deceased members cannot have active status."
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"
