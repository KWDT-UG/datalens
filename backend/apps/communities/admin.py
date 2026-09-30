from django.contrib import admin

from .models import Community


@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "subcounty_name",
        "district_name",
        "resident_count",
        "status",
    )
    list_filter = ("status", "country", "region_name", "district_name")
    search_fields = ("name", "subcounty_name", "district_name", "region_name")
