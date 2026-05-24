from rest_framework import serializers

from apps.common.models import ApprovalActionType

from .models import ApprovalRequest
from .services import supported_entity_types


class ApprovalRequestSerializer(serializers.ModelSerializer):
    entity_id = serializers.IntegerField(required=False, min_value=0, default=0)

    class Meta:
        model = ApprovalRequest
        fields = [
            "id",
            "community",
            "entity_type",
            "entity_id",
            "action_type",
            "submitted_payload",
            "diff_summary",
            "status",
            "submitted_by_user_id",
            "submitted_at",
            "reviewed_by_user_id",
            "reviewed_at",
            "review_notes",
            "applied_at",
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

    def validate(self, attrs):
        entity_type = attrs.get(
            "entity_type",
            self.instance.entity_type if self.instance is not None else None,
        )
        action_type = attrs.get(
            "action_type",
            self.instance.action_type if self.instance is not None else None,
        )
        entity_id = attrs.get(
            "entity_id",
            self.instance.entity_id if self.instance is not None else 0,
        )

        if entity_type not in supported_entity_types():
            raise serializers.ValidationError(
                {"entity_type": "Unsupported approval entity type."}
            )
        if action_type in {ApprovalActionType.UPDATE, ApprovalActionType.DELETE} and not entity_id:
            raise serializers.ValidationError(
                {"entity_id": "Existing entity_id is required for update/delete approvals."}
            )
        return attrs
        read_only_fields = [
            "id",
            "status",
            "submitted_by_user_id",
            "submitted_at",
            "reviewed_by_user_id",
            "reviewed_at",
            "applied_at",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "sync_version",
            "is_deleted",
        ]
