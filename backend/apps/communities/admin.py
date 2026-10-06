from django.contrib import admin

from apps.common.admin import CoreModelAdminMixin

from .models import Community


@admin.register(Community)
class CommunityAdmin(CoreModelAdminMixin, admin.ModelAdmin):
    list_display = (
        "name",
        "subcounty_name",
        "district_name",
        "resident_count",
        "status",
    )
    list_filter = ("status", "country", "region_name", "district_name")
    search_fields = ("name", "subcounty_name", "district_name", "region_name")
