from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import CoreModel, ImpactMethod, ResourcePartyType
from apps.resources.models import Resource, resource_party_community_id, resolve_resource_party


class ImpactRecord(CoreModel):
    resource = models.ForeignKey(
        Resource,
        on_delete=models.PROTECT,
        related_name="impact_records",
    )
    beneficiary_type = models.CharField(
        max_length=32,
        choices=ResourcePartyType.choices,
        blank=True,
    )
    beneficiary_id = models.PositiveBigIntegerField(null=True, blank=True)
    period_type = models.CharField(max_length=64, blank=True)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    as_of_date = models.DateField(null=True, blank=True)
    beneficiary_count = models.PositiveIntegerField(default=0)
    household_count = models.PositiveIntegerField(default=0)
    member_count = models.PositiveIntegerField(default=0)
    institution_count = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    method = models.CharField(
        max_length=32,
        choices=ImpactMethod.choices,
        default=ImpactMethod.OBSERVED,
    )
    recorded_by_user_id = models.PositiveBigIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-as_of_date", "-created_at"]

    def clean(self) -> None:
        super().clean()
        errors = {}
        has_beneficiary_type = bool(self.beneficiary_type)
        has_beneficiary_id = self.beneficiary_id is not None
        if has_beneficiary_type != has_beneficiary_id:
            errors["beneficiary_id"] = (
                "beneficiary_type and beneficiary_id must be provided together."
            )

        if has_beneficiary_type and has_beneficiary_id:
            beneficiary = resolve_resource_party(
                self.beneficiary_type,
                self.beneficiary_id,
            )
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
                        "Impact record beneficiary must belong to the same community."
                    )

        if self.period_start and self.period_end and self.period_end < self.period_start:
            errors["period_end"] = "Period end cannot be before period start."

        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"{self.resource} impact"
