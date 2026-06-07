from rest_framework import serializers

from apps.common.models import ApprovalActionType

from .models import ApprovalRequest
from .policy import community_id_for_change
from .services import APPROVAL_ENTITY_REGISTRY, supported_entity_types


class ApprovalRequestSerializer(serializers.ModelSerializer):
    entity_id = serializers.IntegerField(required=False, min_value=0, default=0)
    community_name = serializers.CharField(source="community.name", read_only=True)
    target_display = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalRequest
        fields = [
            "id",
            "community",
            "community_name",
            "entity_type",
            "entity_id",
            "action_type",
            "submitted_payload",
            "diff_summary",
            "review_scope",
            "policy_reason",
            "submission_source",
            "base_sync_version",
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
            "target_display",
        ]
        read_only_fields = [
            "id",
            "status",
            "submitted_by_user_id",
            "submitted_at",
            "review_scope",
            "policy_reason",
            "submission_source",
            "base_sync_version",
            "reviewed_by_user_id",
            "reviewed_at",
            "review_notes",
            "applied_at",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "sync_version",
            "is_deleted",
            "target_display",
        ]

    def get_target_display(self, obj):
        if obj.entity_id:
            model, _serializer_class = APPROVAL_ENTITY_REGISTRY.get(
                obj.entity_type,
                (None, None),
            )
            target = model.objects.filter(pk=obj.entity_id).first() if model else None
            if target is not None:
                return str(target)
        for field in ("name", "first_name", "code"):
            value = (obj.submitted_payload or {}).get(field)
            if value:
                return str(value)
        return f"New {obj.entity_type.replace('_', ' ')}"

    def to_representation(self, instance):
        from apps.common.privacy import sanitize_approval_payload

        data = super().to_representation(instance)
        request = self.context.get("request")
        if request is None:
            return data
        data["submitted_payload"] = sanitize_approval_payload(
            instance.entity_type,
            data.get("submitted_payload"),
            request.user,
        )
        data["diff_summary"] = sanitize_approval_payload(
            instance.entity_type,
            data.get("diff_summary"),
            request.user,
        )
        return data

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
        if (
            action_type in {ApprovalActionType.UPDATE, ApprovalActionType.DELETE}
            and not entity_id
        ):
            raise serializers.ValidationError(
                {
                    "entity_id": (
                        "Existing entity_id is required for update/delete approvals."
                    )
                }
            )

        submitted_payload = attrs.get(
            "submitted_payload",
            self.instance.submitted_payload if self.instance is not None else {},
        )
        if not isinstance(submitted_payload, dict):
            raise serializers.ValidationError(
                {"submitted_payload": "Expected an object of proposed field values."}
            )

        model, serializer_class = APPROVAL_ENTITY_REGISTRY[entity_type]
        target = None
        if action_type == ApprovalActionType.CREATE:
            proposed_serializer = serializer_class(data=submitted_payload)
            if not proposed_serializer.is_valid():
                raise serializers.ValidationError(
                    {"submitted_payload": proposed_serializer.errors}
                )
        elif action_type in {
            ApprovalActionType.UPDATE,
            ApprovalActionType.DELETE,
        }:
            target = model.objects.filter(pk=entity_id).first()
            if target is None:
                raise serializers.ValidationError(
                    {"entity_id": "Approval target could not be found."}
                )
            if action_type == ApprovalActionType.UPDATE:
                proposed_serializer = serializer_class(
                    target,
                    data=submitted_payload,
                    partial=True,
                )
                if not proposed_serializer.is_valid():
                    raise serializers.ValidationError(
                        {"submitted_payload": proposed_serializer.errors}
                    )

        community = attrs.get(
            "community",
            self.instance.community if self.instance is not None else None,
        )
        derived_community_id = community_id_for_change(
            entity_type=entity_type,
            payload=submitted_payload,
            instance=target,
        )
        if (
            community is not None
            and derived_community_id is not None
            and community.pk != derived_community_id
        ):
            raise serializers.ValidationError(
                {"community": "Approval community must match the target record."}
            )
        return attrs
