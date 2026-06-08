import re

from rest_framework import serializers


class ApprovalStateSerializerMixin(serializers.Serializer):
    approval_status = serializers.SerializerMethodField()
    pending_approval_request_id = serializers.SerializerMethodField()
    approval_history_count = serializers.SerializerMethodField()

    approval_entity_type = None

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
