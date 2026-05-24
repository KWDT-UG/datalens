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
