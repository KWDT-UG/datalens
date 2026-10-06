from django.contrib import admin

from apps.common.admin import CoreModelAdminMixin

from .models import (
    Program,
    Resource,
    ResourceBeneficiary,
    ResourceCategory,
    ResourcePaymentObligation,
    ResourcePaymentTransaction,
    ResourceStatusEvent,
    ResourceThematicArea,
    ThematicArea,
)


@admin.register(ThematicArea)
class ThematicAreaAdmin(CoreModelAdminMixin, admin.ModelAdmin):
    list_display = ("code", "name", "status")
    list_filter = ("status",)
    search_fields = ("code", "name", "description")


@admin.register(Program)
class ProgramAdmin(CoreModelAdminMixin, admin.ModelAdmin):
    list_display = ("code", "name", "thematic_area", "status", "display_order")
    list_filter = ("status", "thematic_area")
    search_fields = ("code", "name", "description", "thematic_area__name")


@admin.register(ResourceCategory)
class ResourceCategoryAdmin(CoreModelAdminMixin, admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "program",
        "status",
        "default_resource_type",
        "display_order",
    )
    list_filter = ("status", "program__thematic_area", "program")
    search_fields = ("code", "name", "description", "program__name")


@admin.register(Resource)
class ResourceAdmin(CoreModelAdminMixin, admin.ModelAdmin):
    list_display = (
        "name",
        "community",
        "program",
        "resource_category",
        "resource_type",
        "status",
        "owner_type",
    )
    list_filter = (
        "community",
        "program__thematic_area",
        "program",
        "resource_category",
        "resource_type",
        "status",
        "owner_type",
    )
    search_fields = ("name", "description", "serial_or_tag_number", "location_text")


@admin.register(ResourceBeneficiary)
class ResourceBeneficiaryAdmin(CoreModelAdminMixin, admin.ModelAdmin):
    list_display = (
        "resource",
        "beneficiary_type",
        "beneficiary_id",
        "relationship_type",
    )
    list_filter = ("beneficiary_type", "relationship_type")
    search_fields = ("resource__name", "notes")


@admin.register(ResourceThematicArea)
class ResourceThematicAreaAdmin(CoreModelAdminMixin, admin.ModelAdmin):
    list_display = ("resource", "thematic_area", "is_primary")
    list_filter = ("is_primary", "thematic_area")
    search_fields = ("resource__name", "thematic_area__name", "thematic_area__code")


@admin.register(ResourceStatusEvent)
class ResourceStatusEventAdmin(CoreModelAdminMixin, admin.ModelAdmin):
    list_display = ("resource", "event_type", "effective_at", "recorded_by_user_id")
    list_filter = ("event_type",)
    search_fields = ("resource__name", "notes")


@admin.register(ResourcePaymentObligation)
class ResourcePaymentObligationAdmin(CoreModelAdminMixin, admin.ModelAdmin):
    list_display = ("resource", "obligation_type", "principal_amount", "currency", "status")
    list_filter = ("obligation_type", "status", "currency")
    search_fields = ("resource__name", "terms_notes")


@admin.register(ResourcePaymentTransaction)
class ResourcePaymentTransactionAdmin(CoreModelAdminMixin, admin.ModelAdmin):
    list_display = ("obligation", "entry_type", "amount", "effective_on")
    list_filter = ("entry_type", "effective_on")
    search_fields = ("obligation__resource__name", "reference", "voucher_number")
