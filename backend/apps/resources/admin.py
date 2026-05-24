from django.contrib import admin

from .models import (
    Resource,
    ResourceBeneficiary,
    ResourceStatusEvent,
    ResourceThematicArea,
    ThematicArea,
)


@admin.register(ThematicArea)
class ThematicAreaAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "status")
    list_filter = ("status",)
    search_fields = ("code", "name", "description")


@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
    list_display = ("name", "community", "resource_type", "status", "owner_type")
    list_filter = ("community", "resource_type", "status", "owner_type")
    search_fields = ("name", "description", "serial_or_tag_number", "location_text")


@admin.register(ResourceBeneficiary)
class ResourceBeneficiaryAdmin(admin.ModelAdmin):
    list_display = (
        "resource",
        "beneficiary_type",
        "beneficiary_id",
        "relationship_type",
    )
    list_filter = ("beneficiary_type", "relationship_type")
    search_fields = ("resource__name", "notes")


@admin.register(ResourceThematicArea)
class ResourceThematicAreaAdmin(admin.ModelAdmin):
    list_display = ("resource", "thematic_area", "is_primary")
    list_filter = ("is_primary", "thematic_area")
    search_fields = ("resource__name", "thematic_area__name", "thematic_area__code")


@admin.register(ResourceStatusEvent)
class ResourceStatusEventAdmin(admin.ModelAdmin):
    list_display = ("resource", "event_type", "effective_at", "recorded_by_user_id")
    list_filter = ("event_type",)
    search_fields = ("resource__name", "notes")
