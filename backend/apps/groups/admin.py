from django.contrib import admin

from .models import Group, GroupActivity


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "community",
        "sub_county",
        "status",
        "formed_on",
        "closed_on",
    )
    list_filter = ("status", "community", "sub_county")
    search_fields = ("code", "name", "sub_county", "community__name")


@admin.register(GroupActivity)
class GroupActivityAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "activity_type",
        "group",
        "starts_at",
        "status",
    )
    list_filter = ("activity_type", "status", "community")
    search_fields = ("title", "group__name", "facilitator_name", "location_text")
