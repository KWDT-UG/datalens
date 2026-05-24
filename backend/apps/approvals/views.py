from rest_framework.exceptions import ValidationError
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.common.models import ApprovalStatus
from apps.common.permissions import ApprovalReviewAccess
from apps.common.viewsets import (
    ActionPermissionMixin,
    AuditFieldsMixin,
    SimpleFilterMixin,
    SoftDeleteMixin,
)

from .models import ApprovalRequest
from .serializers import ApprovalRequestSerializer
from .services import apply_approval_request


class ApprovalRequestViewSet(
    ActionPermissionMixin,
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    queryset = ApprovalRequest.objects.select_related("community").all()
    serializer_class = ApprovalRequestSerializer
    filter_fields = ("community", "action_type", "status", "entity_type")
    search_fields = ("entity_type", "review_notes")
    ordering_fields = ("submitted_at", "reviewed_at", "created_at")
    permission_classes_by_action = {
        "approve": [ApprovalReviewAccess],
        "reject": [ApprovalReviewAccess],
        "supersede": [ApprovalReviewAccess],
    }

    def perform_create(self, serializer):
        user_id = self.request.user.pk if self.request.user.is_authenticated else None
        serializer.save(
            created_by_user_id=user_id,
            updated_by_user_id=user_id,
            submitted_by_user_id=user_id,
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        approval_request = self.get_object()
        if approval_request.status != ApprovalStatus.PENDING:
            raise ValidationError(
                {"status": "Only pending approval requests can be approved."}
            )
        user_id = request.user.pk if request.user.is_authenticated else None
        apply_approval_request(approval_request, user_id=user_id)
        approval_request.status = ApprovalStatus.APPROVED
        approval_request.review_notes = request.data.get("review_notes", "")
        approval_request.reviewed_by_user_id = user_id
        approval_request.reviewed_at = timezone.now()
        approval_request.updated_by_user_id = user_id
        approval_request.applied_at = timezone.now()
        approval_request.save(
            update_fields=[
                "entity_id",
                "status",
                "review_notes",
                "reviewed_by_user_id",
                "reviewed_at",
                "updated_by_user_id",
                "applied_at",
                "updated_at",
            ]
        )
        serializer = self.get_serializer(approval_request)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        approval_request = self.get_object()
        if approval_request.status != ApprovalStatus.PENDING:
            raise ValidationError(
                {"status": "Only pending approval requests can be rejected."}
            )
        user_id = request.user.pk if request.user.is_authenticated else None
        approval_request.status = ApprovalStatus.REJECTED
        approval_request.review_notes = request.data.get("review_notes", "")
        approval_request.reviewed_by_user_id = user_id
        approval_request.reviewed_at = timezone.now()
        approval_request.updated_by_user_id = user_id
        approval_request.save(
            update_fields=[
                "status",
                "review_notes",
                "reviewed_by_user_id",
                "reviewed_at",
                "updated_by_user_id",
                "updated_at",
            ]
        )
        serializer = self.get_serializer(approval_request)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def supersede(self, request, pk=None):
        approval_request = self.get_object()
        if approval_request.status != ApprovalStatus.PENDING:
            raise ValidationError(
                {"status": "Only pending approval requests can be superseded."}
            )
        user_id = request.user.pk if request.user.is_authenticated else None
        approval_request.status = ApprovalStatus.SUPERSEDED
        approval_request.review_notes = request.data.get("review_notes", "")
        approval_request.reviewed_by_user_id = user_id
        approval_request.reviewed_at = timezone.now()
        approval_request.updated_by_user_id = user_id
        approval_request.save(
            update_fields=[
                "status",
                "review_notes",
                "reviewed_by_user_id",
                "reviewed_at",
                "updated_by_user_id",
                "updated_at",
            ]
        )
        serializer = self.get_serializer(approval_request)
        return Response(serializer.data)
