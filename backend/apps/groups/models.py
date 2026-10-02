from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import CoreModel, RecordStatus
from apps.communities.models import Community


class Group(CoreModel):
    community = models.ForeignKey(
        Community,
        on_delete=models.PROTECT,
        related_name="groups",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    status = models.CharField(
        max_length=32,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVE,
    )
    formed_on = models.DateField(null=True, blank=True)
    closed_on = models.DateField(null=True, blank=True)
    meeting_day = models.CharField(max_length=32, blank=True)
    sub_county = models.CharField(max_length=128, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["community__name", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["community", "name"],
                name="unique_group_name_per_community",
            ),
            models.UniqueConstraint(
                fields=["community", "code"],
                name="unique_group_code_per_community",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        if self.formed_on and self.closed_on and self.closed_on < self.formed_on:
            raise ValidationError(
                {"closed_on": "Closed date cannot be before formed date."}
            )

    def __str__(self) -> str:
        return f"{self.name} ({self.community.name})"


class GroupActivityType(models.TextChoices):
    MEETING = "meeting", "Meeting"
    TRAINING = "training", "Training"


class GroupActivityStatus(models.TextChoices):
    PLANNED = "planned", "Planned"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class GroupActivity(CoreModel):
    community = models.ForeignKey(
        Community,
        on_delete=models.PROTECT,
        related_name="group_activities",
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.PROTECT,
        related_name="activities",
    )
    committee = models.ForeignKey(
        "participation.Committee",
        on_delete=models.PROTECT,
        related_name="group_activities",
        null=True,
        blank=True,
    )
    activity_type = models.CharField(max_length=16, choices=GroupActivityType.choices)
    title = models.CharField(max_length=255)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=16,
        choices=GroupActivityStatus.choices,
        default=GroupActivityStatus.PLANNED,
    )
    location_text = models.CharField(max_length=255, blank=True)
    facilitator_name = models.CharField(max_length=255, blank=True)
    expected_participant_count = models.PositiveIntegerField(null=True, blank=True)
    women_attendance_count = models.PositiveIntegerField(null=True, blank=True)
    men_attendance_count = models.PositiveIntegerField(null=True, blank=True)
    agenda = models.TextField(blank=True)
    minutes = models.TextField(blank=True)
    decisions_actions = models.TextField(blank=True)
    training_topic = models.CharField(max_length=255, blank=True)
    objectives = models.TextField(blank=True)
    report_notes = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["starts_at", "title", "id"]

    def clean(self) -> None:
        super().clean()
        errors = {}
        if self.group_id and self.community_id:
            group_community_id = getattr(self.group, "community_id", None)
            if group_community_id != self.community_id:
                errors["group"] = "Activity group must belong to the same community."
        if self.committee_id:
            committee_community_id = getattr(self.committee, "community_id", None)
            if committee_community_id != self.community_id:
                errors["committee"] = (
                    "Activity committee must belong to the same community."
                )
            if self.activity_type != GroupActivityType.MEETING:
                errors["committee"] = "Only meetings can be linked to a committee."
        if self.ends_at and self.starts_at and self.ends_at < self.starts_at:
            errors["ends_at"] = "End date and time cannot be before the start."
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"{self.get_activity_type_display()}: {self.title}"
