from django.contrib import admin

from .models import Group


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "community", "sub_county", "status", "formed_on", "closed_on")
    list_filter = ("status", "community", "sub_county")
    search_fields = ("code", "name", "sub_county", "community__name")
