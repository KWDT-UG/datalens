from django.contrib import admin

from .models import ImpactRecord


@admin.register(ImpactRecord)
class ImpactRecordAdmin(admin.ModelAdmin):
    list_display = (
        "resource",
        "beneficiary_type",
        "beneficiary_id",
        "period_type",
        "as_of_date",
        "method",
    )
    list_filter = ("method", "beneficiary_type", "period_type")
    search_fields = ("resource__name", "notes", "period_type")
