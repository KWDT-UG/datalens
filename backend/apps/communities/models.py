from django.db import models

from apps.common.models import CoreModel, RecordStatus


class Community(CoreModel):
    name = models.CharField(max_length=255)
    area_name = models.CharField(max_length=255, blank=True)
    district_name = models.CharField(max_length=255, blank=True)
    region_name = models.CharField(max_length=255, blank=True)
    country = models.CharField(max_length=128, default="Uganda")
    status = models.CharField(
        max_length=32,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVE,
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "id"]
        verbose_name_plural = "communities"

    def __str__(self) -> str:
        return self.name
