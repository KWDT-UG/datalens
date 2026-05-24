from django.contrib import admin

from .models import Group


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "community", "status", "formed_on", "closed_on")
    list_filter = ("status", "community")
    search_fields = ("code", "name", "community__name")
