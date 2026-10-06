import re

from rest_framework import serializers


class ApprovalStateSerializerMixin(serializers.Serializer):
    approval_status = serializers.SerializerMethodField()
    pending_approval_request_id = serializers.SerializerMethodField()
    approval_history_count = serializers.SerializerMethodField()

    approval_entity_type = None

    def to_internal_value(self, data):
        attrs = super().to_internal_value(data)
        self._validate_active_fk_parents(attrs)
        return attrs

    def _validate_active_fk_parents(self, attrs):
        """Reject new/changed links to archived CoreModel parents.

        Unrelated partial updates intentionally skip existing relationships so
        legacy rows can be corrected without first rebuilding their hierarchy.
        """

        model = getattr(getattr(self, "Meta", None), "model", None)
        if model is None:
            return
        errors = {}
        for field in model._meta.concrete_fields:
            if not (field.many_to_one or field.one_to_one):
                continue
            if field.name not in attrs:
                continue
            parent = attrs[field.name]
            if parent is None or not hasattr(parent, "is_deleted"):
                continue
            if self.instance is not None:
                current_parent_id = getattr(self.instance, field.attname)
                if current_parent_id == parent.pk:
                    continue
            if parent.is_deleted:
                errors[field.name] = (
                    f"Selected {parent._meta.verbose_name} is archived. "
                    "Restore it before creating or changing this relationship."
                )
        if errors:
            raise serializers.ValidationError(errors)

    def _approval_summary(self, obj):
        from apps.approvals.models import ApprovalRequest
        from apps.common.models import ApprovalStatus

        entity_type = self.approval_entity_type or re.sub(
            r"(?<!^)(?=[A-Z])",
            "_",
            obj.__class__.__name__,
        ).lower()
        cache = getattr(self, "_approval_summary_cache", {})
        cache_key = (entity_type, obj.pk)
        if cache_key not in cache:
            rows = list(
                ApprovalRequest.objects.filter(
                    entity_type=entity_type,
                    entity_id=obj.pk,
                    is_deleted=False,
                )
                .order_by("-submitted_at", "-created_at")
                .values("id", "status")
            )
            pending_id = next(
                (
                    row["id"]
                    for row in rows
                    if row["status"] == ApprovalStatus.PENDING
                ),
                None,
            )
            cache[cache_key] = {
                "status": (
                    ApprovalStatus.PENDING
                    if pending_id is not None
                    else rows[0]["status"]
                    if rows
                    else None
                ),
                "pending_id": pending_id,
                "count": len(rows),
            }
            self._approval_summary_cache = cache
        return cache[cache_key]

    def get_approval_status(self, obj):
        return self._approval_summary(obj)["status"]

    def get_pending_approval_request_id(self, obj):
        return self._approval_summary(obj)["pending_id"]

    def get_approval_history_count(self, obj):
        return self._approval_summary(obj)["count"]

    def to_representation(self, instance):
        from apps.common.privacy import sanitize_model_representation

        data = super().to_representation(instance)
        request = self.context.get("request")
        if request is None:
            return data
        return sanitize_model_representation(instance, data, request.user)
