from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import (
    BeneficiaryRelationshipType,
    CoreModel,
    RecordStatus,
    ResourceEventType,
    ResourcePartyType,
    ResourceStatus,
    ResourceType,
)
from apps.communities.models import Community


def resolve_resource_party(party_type: str, party_id: int | None):
    if not party_id:
        return None

    if party_type == ResourcePartyType.COMMUNITY:
        model = Community
    elif party_type == ResourcePartyType.GROUP:
        from apps.groups.models import Group

        model = Group
    elif party_type == ResourcePartyType.COOPERATIVE:
        from apps.participation.models import Cooperative

        model = Cooperative
    elif party_type == ResourcePartyType.MEMBER:
        from apps.members.models import Member

        model = Member
    elif party_type == ResourcePartyType.INSTITUTION:
        from apps.institutions.models import Institution

        model = Institution
    else:
        return None

    try:
        return model.objects.get(pk=party_id)
    except model.DoesNotExist:
        return None


def resource_party_community_id(party_type: str, party) -> int | None:
    if party is None:
        return None
    if party_type == ResourcePartyType.COMMUNITY:
        return party.pk
    return getattr(party, "community_id", None)


class ThematicArea(CoreModel):
    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=32,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVE,
    )

    class Meta:
        ordering = ["name", "code"]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class Resource(CoreModel):
    community = models.ForeignKey(
        Community,
        on_delete=models.PROTECT,
        related_name="resources",
    )
    owner_type = models.CharField(max_length=32, choices=ResourcePartyType.choices)
    owner_id = models.PositiveBigIntegerField()
    resource_type = models.CharField(
        max_length=64,
        choices=ResourceType.choices,
        default=ResourceType.OTHER,
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    quantity = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    unit = models.CharField(max_length=64, blank=True)
    value_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    value_currency = models.CharField(max_length=3, default="UGX")
    acquired_on = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=32,
        choices=ResourceStatus.choices,
        default=ResourceStatus.PLANNED,
    )
    location_text = models.TextField(blank=True)
    serial_or_tag_number = models.CharField(max_length=128, blank=True)
    source_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["community__name", "name"]

    def clean(self) -> None:
        super().clean()
        errors = {}
        owner = resolve_resource_party(self.owner_type, self.owner_id)
        if owner is None:
            errors["owner_id"] = "Owner could not be found for the selected owner type."
        else:
            owner_community_id = resource_party_community_id(self.owner_type, owner)
            if owner_community_id != self.community_id:
                errors["owner_id"] = "Resource owner must belong to the same community."
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"{self.name} ({self.community.name})"


class ResourceBeneficiary(CoreModel):
    resource = models.ForeignKey(
        Resource,
        on_delete=models.PROTECT,
        related_name="beneficiaries",
    )
    beneficiary_type = models.CharField(
        max_length=32,
        choices=ResourcePartyType.choices,
    )
    beneficiary_id = models.PositiveBigIntegerField()
    relationship_type = models.CharField(
        max_length=32,
        choices=BeneficiaryRelationshipType.choices,
        default=BeneficiaryRelationshipType.PRIMARY,
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["resource__name", "relationship_type", "beneficiary_type"]

    def clean(self) -> None:
        super().clean()
        errors = {}
        beneficiary = resolve_resource_party(self.beneficiary_type, self.beneficiary_id)
        if beneficiary is None:
            errors["beneficiary_id"] = (
                "Beneficiary could not be found for the selected beneficiary type."
            )
        else:
            beneficiary_community_id = resource_party_community_id(
                self.beneficiary_type,
                beneficiary,
            )
            if beneficiary_community_id != self.resource.community_id:
                errors["beneficiary_id"] = (
                    "Resource beneficiary must belong to the same community."
                )
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"{self.resource} -> {self.beneficiary_type}:{self.beneficiary_id}"


class ResourceThematicArea(CoreModel):
    resource = models.ForeignKey(
        Resource,
        on_delete=models.CASCADE,
        related_name="thematic_links",
    )
    thematic_area = models.ForeignKey(
        ThematicArea,
        on_delete=models.PROTECT,
        related_name="resource_links",
    )
    is_primary = models.BooleanField(default=False)

    class Meta:
        ordering = ["resource__name", "-is_primary", "thematic_area__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["resource", "thematic_area"],
                name="unique_resource_thematic_area",
            )
        ]

    def __str__(self) -> str:
        return f"{self.resource} -> {self.thematic_area}"


class ResourceStatusEvent(CoreModel):
    resource = models.ForeignKey(
        Resource,
        on_delete=models.PROTECT,
        related_name="status_events",
    )
    event_type = models.CharField(
        max_length=64,
        choices=ResourceEventType.choices,
        default=ResourceEventType.CREATED,
    )
    effective_at = models.DateTimeField()
    notes = models.TextField(blank=True)
    recorded_by_user_id = models.PositiveBigIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-effective_at", "-created_at"]

    def __str__(self) -> str:
        return f"{self.resource} [{self.event_type}]"
