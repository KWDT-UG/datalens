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


class ActivityPartyType(models.TextChoices):
    GROUP = "group", "Group"
    COMMITTEE = "committee", "Committee"
    COOPERATIVE = "cooperative", "Cooperative"
    INSTITUTION = "institution", "Institution"


class ActivityPartyRole(models.TextChoices):
    SUBJECT = "subject", "For"
    ORGANIZER = "organizer", "Organizer"
    HOST = "host", "Host"
    PARTNER = "partner", "Partner"
    AUDIENCE = "audience", "Participating audience"


def resolve_activity_party(
    party_type: str,
    party_id: int | None,
    *,
    include_deleted: bool = True,
):
    if not party_id:
        return None
    if party_type == ActivityPartyType.GROUP:
        model = Group
    elif party_type == ActivityPartyType.COMMITTEE:
        from apps.participation.models import Committee

        model = Committee
    elif party_type == ActivityPartyType.COOPERATIVE:
        from apps.participation.models import Cooperative

        model = Cooperative
    elif party_type == ActivityPartyType.INSTITUTION:
        from apps.institutions.models import Institution

        model = Institution
    else:
        return None
    queryset = model.objects.filter(pk=party_id)
    if not include_deleted:
        queryset = queryset.filter(is_deleted=False)
    return queryset.first()


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
        null=True,
        blank=True,
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
        if self.ends_at and self.starts_at and self.ends_at < self.starts_at:
            errors["ends_at"] = "End date and time cannot be before the start."
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"{self.get_activity_type_display()}: {self.title}"


class ActivityParty(CoreModel):
    activity = models.ForeignKey(
        GroupActivity,
        on_delete=models.CASCADE,
        related_name="parties",
    )
    party_type = models.CharField(max_length=32, choices=ActivityPartyType.choices)
    party_id = models.PositiveBigIntegerField()
    role = models.CharField(max_length=32, choices=ActivityPartyRole.choices)

    class Meta:
        ordering = ["activity_id", "role", "party_type", "party_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["activity", "party_type", "party_id", "role"],
                condition=models.Q(is_deleted=False),
                name="unique_active_activity_party_role",
            ),
            models.UniqueConstraint(
                fields=["activity"],
                condition=models.Q(role=ActivityPartyRole.SUBJECT, is_deleted=False),
                name="unique_active_activity_subject",
            ),
        ]
        indexes = [
            models.Index(
                fields=["party_type", "party_id", "is_deleted"],
                name="activity_party_lookup_idx",
            ),
        ]

    @property
    def party(self):
        return resolve_activity_party(self.party_type, self.party_id)

    @property
    def party_name(self) -> str:
        party = self.party
        return getattr(party, "name", "") if party else ""

    def clean(self) -> None:
        super().clean()
        party = self.party
        if party is None:
            raise ValidationError(
                {"party_id": "Party could not be found for the selected party type."}
            )
        party_community_id = (
            party.pk
            if self.party_type == "community"
            else getattr(party, "community_id", None)
        )
        if self.activity_id and party_community_id != self.activity.community_id:
            raise ValidationError(
                {"party_id": "Activity party must belong to the same community."}
            )

    def __str__(self) -> str:
        return f"{self.activity} -> {self.get_role_display()}: {self.party_name}"
