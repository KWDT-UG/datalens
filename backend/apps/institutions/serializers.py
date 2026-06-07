from rest_framework import serializers

from apps.common.serializers import ApprovalStateSerializerMixin

from .models import Institution


class InstitutionSerializer(ApprovalStateSerializerMixin, serializers.ModelSerializer):
    community_name = serializers.CharField(source="community.name", read_only=True)

    class Meta:
        model = Institution
        fields = [
            "id",
            "community",
            "community_name",
            "code",
            "name",
            "institution_type",
            "status",
            "contact_name",
            "phone",
            "email",
            "location_text",
            "notes",
            "approval_status",
            "pending_approval_request_id",
            "approval_history_count",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "client_created_at",
            "client_updated_at",
            "client_mutation_id",
            "sync_version",
            "is_deleted",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "sync_version",
            "is_deleted",
        ]
