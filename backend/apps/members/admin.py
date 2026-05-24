from django.contrib import admin

from .models import Member


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = (
        "member_number",
        "first_name",
        "last_name",
        "community",
        "group",
        "status",
    )
    list_filter = ("status", "community", "group")
    search_fields = (
        "member_number",
        "first_name",
        "last_name",
        "preferred_name",
        "phone",
        "email",
    )
