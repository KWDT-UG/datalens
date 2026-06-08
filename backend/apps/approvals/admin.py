from django.contrib import admin

from .models import ApprovalRequest


@admin.register(ApprovalRequest)
class ApprovalRequestAdmin(admin.ModelAdmin):
    list_display = (
        "entity_type",
        "entity_id",
        "community",
        "action_type",
        "review_scope",
        "submission_source",
        "status",
    )
    list_filter = (
        "community",
        "action_type",
        "review_scope",
        "submission_source",
        "status",
    )
    search_fields = ("entity_type", "policy_reason", "review_notes")
