from django.db import models
from django.utils import timezone

from apps.common.models import (
    ApprovalActionType,
    ApprovalReviewScope,
    ApprovalStatus,
    ApprovalSubmissionSource,
    CoreModel,
)
from apps.communities.models import Community


class ApprovalRequest(CoreModel):
    community = models.ForeignKey(
        Community,
        on_delete=models.PROTECT,
        related_name="approval_requests",
    )
    entity_type = models.CharField(max_length=64)
    entity_id = models.PositiveBigIntegerField()
    action_type = models.CharField(
        max_length=32,
        choices=ApprovalActionType.choices,
        default=ApprovalActionType.CREATE,
    )
    submitted_payload = models.JSONField(default=dict)
    diff_summary = models.JSONField(null=True, blank=True)
    review_scope = models.CharField(
        max_length=32,
        choices=ApprovalReviewScope.choices,
        default=ApprovalReviewScope.STANDARD,
    )
    policy_reason = models.CharField(max_length=255, blank=True)
    submission_source = models.CharField(
        max_length=32,
        choices=ApprovalSubmissionSource.choices,
        default=ApprovalSubmissionSource.MANUAL,
    )
    base_sync_version = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=32,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.PENDING,
    )
    submitted_by_user_id = models.PositiveBigIntegerField(null=True, blank=True)
    submitted_at = models.DateTimeField(default=timezone.now)
    reviewed_by_user_id = models.PositiveBigIntegerField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-submitted_at", "-created_at"]

    def __str__(self) -> str:
        return f"{self.entity_type}:{self.entity_id} [{self.status}]"
