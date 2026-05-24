from django.db import models

from apps.common.models import CoreModel, InstitutionType, RecordStatus
from apps.communities.models import Community


class Institution(CoreModel):
    community = models.ForeignKey(
        Community,
        on_delete=models.PROTECT,
        related_name="institutions",
    )
    code = models.CharField(max_length=64, blank=True)
    name = models.CharField(max_length=255)
    institution_type = models.CharField(
        max_length=64,
        choices=InstitutionType.choices,
        default=InstitutionType.OTHER,
    )
    status = models.CharField(
        max_length=32,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVE,
    )
    contact_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=64, blank=True)
    email = models.EmailField(blank=True)
    location_text = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["community__name", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["community", "name"],
                name="unique_institution_name_per_community",
            ),
            models.UniqueConstraint(
                fields=["community", "code"],
                condition=~models.Q(code=""),
                name="unique_institution_code_per_community_when_set",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.community.name})"
