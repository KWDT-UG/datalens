from django.contrib import admin

from .models import (
    Committee,
    CommitteeMembership,
    Cooperative,
    CooperativeMembership,
)


@admin.register(Committee)
class CommitteeAdmin(admin.ModelAdmin):
    list_display = ("name", "community", "committee_type", "status")
    list_filter = ("community", "status", "committee_type")
    search_fields = ("name", "description", "community__name")


@admin.register(CommitteeMembership)
class CommitteeMembershipAdmin(admin.ModelAdmin):
    list_display = ("committee", "member", "role_name", "status", "start_date")
    list_filter = ("committee", "status")
    search_fields = (
        "committee__name",
        "member__first_name",
        "member__last_name",
        "role_name",
    )


@admin.register(Cooperative)
class CooperativeAdmin(admin.ModelAdmin):
    list_display = ("name", "community", "cooperative_type", "status")
    list_filter = ("community", "status", "cooperative_type")
    search_fields = ("name", "description", "community__name")


@admin.register(CooperativeMembership)
class CooperativeMembershipAdmin(admin.ModelAdmin):
    list_display = ("cooperative", "member", "role_name", "status", "start_date")
    list_filter = ("cooperative", "status")
    search_fields = (
        "cooperative__name",
        "member__first_name",
        "member__last_name",
        "role_name",
    )
