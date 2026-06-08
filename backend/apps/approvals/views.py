from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import (
    MethodNotAllowed,
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.common.models import (
    ApprovalReviewScope,
    ApprovalStatus,
    ApprovalSubmissionSource,
)
from apps.common.permissions import (
    REVIEW_APPROVALS,
    REVIEW_FINANCE_APPROVALS,
    REVIEW_IMPACT_APPROVALS,
    ApprovalReviewAccess,
    user_has_capability,
)
from apps.common.viewsets import (
    ActionPermissionMixin,
    AuditFieldsMixin,
    SimpleFilterMixin,
    SoftDeleteMixin,
)
from apps.common.scoping import enforce_change_scope

from .models import ApprovalRequest
from .policy import (
    approval_policy_for_change,
    approval_target,
    queue_approval_request,
    required_capability_for_entity,
)
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
    filter_fields = (
        "community",
        "action_type",
        "status",
        "entity_type",
        "entity_id",
        "review_scope",
        "submission_source",
    )
    search_fields = ("entity_type", "review_notes", "policy_reason")
    ordering_fields = ("submitted_at", "reviewed_at", "created_at")
    permission_classes_by_action = {
        "approve": [ApprovalReviewAccess],
        "reject": [ApprovalReviewAccess],
        "supersede": [ApprovalReviewAccess],
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        review_filter = Q()
        has_review_scope = False
        if user_has_capability(user, REVIEW_APPROVALS):
            review_filter |= Q(
                review_scope__in=[
                    ApprovalReviewScope.STANDARD,
                    ApprovalReviewScope.IMPACT,
                ]
            )
            has_review_scope = True
        if user_has_capability(user, REVIEW_FINANCE_APPROVALS):
            review_filter |= Q(review_scope=ApprovalReviewScope.FINANCE)
            has_review_scope = True
        if user_has_capability(user, REVIEW_IMPACT_APPROVALS):
            review_filter |= Q(review_scope=ApprovalReviewScope.IMPACT) | Q(
                entity_type="impact_record"
            )
            has_review_scope = True
        if has_review_scope:
            return queryset.filter(
                review_filter | Q(submitted_by_user_id=user.pk)
            ).distinct()
        if user.is_authenticated:
            return queryset.filter(submitted_by_user_id=user.pk)
        return queryset.none()

    def perform_create(self, serializer):
        user_id = self.request.user.pk if self.request.user.is_authenticated else None
        attrs = serializer.validated_data
        entity_type = attrs["entity_type"]
        entity_id = attrs.get("entity_id", 0)
        action_type = attrs["action_type"]
        payload = attrs.get("submitted_payload", {})
        if not user_has_capability(
            self.request.user,
            required_capability_for_entity(entity_type),
        ):
            raise PermissionDenied(
                "User cannot submit approval changes for this entity type."
            )
        target = approval_target(entity_type, entity_id)
        enforce_change_scope(
            user=self.request.user,
            entity_type=entity_type,
            payload=payload,
            instance=target,
        )
        decision = approval_policy_for_change(
            entity_type=entity_type,
            action_type=action_type,
            payload=payload,
            instance=target,
        )
        if not decision.required:
            decision = decision.__class__(
                True,
                ApprovalReviewScope.STANDARD,
                "Voluntary approval request for a normally direct operation.",
            )
        approval_request, _created = queue_approval_request(
            community_id=attrs["community"].pk,
            entity_type=entity_type,
            entity_id=entity_id,
            action_type=action_type,
            payload=payload,
            submitted_by_user_id=user_id,
            decision=decision,
            submission_source=ApprovalSubmissionSource.MANUAL,
            client_mutation_id=attrs.get("client_mutation_id", ""),
            instance=target,
            diff_summary=attrs.get("diff_summary"),
        )
        serializer.instance = approval_request

    def update(self, request, *args, **kwargs):
        raise MethodNotAllowed(
            request.method,
            detail="Submitted approval requests are immutable.",
        )

    def validate_reviewer(self, approval_request):
        user_id = self.request.user.pk if self.request.user.is_authenticated else None
        if user_id is not None and approval_request.submitted_by_user_id == user_id:
            raise ValidationError(
                {"reviewer": "Users cannot review their own approval requests."}
            )

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def approve(self, request, pk=None):
        approval_request = self.get_object()
        self.validate_reviewer(approval_request)
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
        approval_request.sync_version += 1
        approval_request.save(
            update_fields=[
                "entity_id",
                "status",
                "review_notes",
                "reviewed_by_user_id",
                "reviewed_at",
                "updated_by_user_id",
                "applied_at",
                "sync_version",
                "updated_at",
            ]
        )
        serializer = self.get_serializer(approval_request)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        approval_request = self.get_object()
        self.validate_reviewer(approval_request)
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
        approval_request.sync_version += 1
        approval_request.save(
            update_fields=[
                "status",
                "review_notes",
                "reviewed_by_user_id",
                "reviewed_at",
                "updated_by_user_id",
                "sync_version",
                "updated_at",
            ]
        )
        serializer = self.get_serializer(approval_request)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def supersede(self, request, pk=None):
        approval_request = self.get_object()
        self.validate_reviewer(approval_request)
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
        approval_request.sync_version += 1
        approval_request.save(
            update_fields=[
                "status",
                "review_notes",
                "reviewed_by_user_id",
                "reviewed_at",
                "updated_by_user_id",
                "sync_version",
                "updated_at",
            ]
        )
        serializer = self.get_serializer(approval_request)
        return Response(serializer.data)
