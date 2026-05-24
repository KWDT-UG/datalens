from django.contrib import admin

from .models import Community


@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    list_display = ("name", "district_name", "region_name", "status")
    list_filter = ("status", "country", "region_name")
    search_fields = ("name", "district_name", "region_name")
