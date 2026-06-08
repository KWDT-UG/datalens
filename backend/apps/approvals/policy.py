from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.common.models import (
    ApprovalActionType,
    ApprovalReviewScope,
    ApprovalStatus,
    ApprovalSubmissionSource,
)

from .models import ApprovalRequest
from .services import APPROVAL_ENTITY_REGISTRY

RESOURCE_APPROVAL_ENTITIES = {
    "resource",
    "resource_beneficiary",
    "resource_thematic_area",
    "resource_status_event",
}
FINANCIAL_RESOURCE_FIELDS = {"value_amount", "value_currency"}


@dataclass(frozen=True)
class ApprovalPolicyDecision:
    required: bool
    review_scope: str
    reason: str


def required_capability_for_entity(entity_type):
    from apps.common.permissions import (
        MANAGE_IMPACT,
        MANAGE_OPERATIONS,
        MANAGE_RESOURCES,
    )

    if entity_type == "impact_record":
        return MANAGE_IMPACT
    if entity_type in RESOURCE_APPROVAL_ENTITIES | {"thematic_area"}:
        return MANAGE_RESOURCES
    return MANAGE_OPERATIONS


def approval_policy_for_change(
    *,
    entity_type,
    action_type,
    payload,
    instance=None,
):
    if entity_type == "impact_record":
        return ApprovalPolicyDecision(
            True,
            ApprovalReviewScope.IMPACT,
            "Impact records require monitoring and evaluation review.",
        )

    if entity_type in RESOURCE_APPROVAL_ENTITIES:
        if entity_type == "resource" and resource_change_is_financial(
            action_type=action_type,
            payload=payload,
            instance=instance,
        ):
            return ApprovalPolicyDecision(
                True,
                ApprovalReviewScope.FINANCE,
                "Resource financial value changes require finance review.",
            )
        return ApprovalPolicyDecision(
            True,
            ApprovalReviewScope.STANDARD,
            "Resource changes require programme review.",
        )

    if action_type == ApprovalActionType.DELETE:
        return ApprovalPolicyDecision(
            True,
            ApprovalReviewScope.STANDARD,
            "Archive operations require programme review.",
        )

    return ApprovalPolicyDecision(
        False,
        ApprovalReviewScope.STANDARD,
        "Routine operational creates and updates may be applied directly.",
    )


def resource_change_is_financial(*, action_type, payload, instance=None):
    if action_type == ApprovalActionType.CREATE:
        return payload.get("value_amount") not in {None, ""}

    if action_type == ApprovalActionType.DELETE:
        return instance is not None and instance.value_amount is not None

    if action_type != ApprovalActionType.UPDATE or instance is None:
        return False

    for field in FINANCIAL_RESOURCE_FIELDS.intersection(payload):
        proposed = payload[field]
        current = getattr(instance, field)
        if field == "value_amount":
            if _decimal_value(proposed) != _decimal_value(current):
                return True
        elif str(proposed) != str(current):
            return True
    return False


def _decimal_value(value):
    if value in {None, ""}:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return value


def approval_target(entity_type, entity_id):
    if not entity_id:
        return None
    model, _serializer_class = APPROVAL_ENTITY_REGISTRY[entity_type]
    return model.objects.filter(pk=entity_id).first()


def community_id_for_change(*, entity_type, payload, instance=None):
    if instance is not None:
        return community_id_for_instance(entity_type, instance)

    if entity_type == "community":
        return payload.get("id")
    if entity_type in {
        "group",
        "member",
        "institution",
        "committee",
        "cooperative",
        "resource",
    }:
        return payload.get("community")
    if entity_type == "committee_membership":
        from apps.participation.models import Committee

        return _related_community_id(Committee, payload.get("committee"))
    if entity_type == "cooperative_membership":
        from apps.participation.models import Cooperative

        return _related_community_id(Cooperative, payload.get("cooperative"))
    if entity_type in {
        "resource_beneficiary",
        "resource_status_event",
        "resource_thematic_area",
    }:
        from apps.resources.models import Resource

        return _related_community_id(Resource, payload.get("resource"))
    if entity_type == "impact_record":
        from apps.resources.models import Resource

        return _related_community_id(Resource, payload.get("resource"))
    return None


def community_id_for_instance(entity_type, instance):
    if entity_type == "community":
        return instance.pk
    if hasattr(instance, "community_id"):
        return instance.community_id
    if entity_type in {"committee_membership", "cooperative_membership"}:
        parent = getattr(instance, "committee", None) or getattr(
            instance, "cooperative", None
        )
        return parent.community_id
    resource = getattr(instance, "resource", None)
    if resource is not None:
        return resource.community_id
    return None


def _related_community_id(model, object_id):
    if not object_id:
        return None
    return model.objects.filter(pk=object_id).values_list(
        "community_id", flat=True
    ).first()


def build_diff_summary(*, payload, instance=None):
    if instance is None:
        return {field: [None, value] for field, value in payload.items()}

    summary = {}
    for field, value in payload.items():
        if not hasattr(instance, field):
            continue
        current = getattr(instance, field)
        if hasattr(current, "pk"):
            current = current.pk
        if isinstance(current, Decimal):
            current = str(current)
        elif isinstance(current, (date, datetime)):
            current = current.isoformat()
        if str(current) != str(value):
            summary[field] = [current, value]
    return summary


@transaction.atomic
def queue_approval_request(
    *,
    community_id,
    entity_type,
    entity_id,
    action_type,
    payload,
    submitted_by_user_id,
    decision,
    submission_source=ApprovalSubmissionSource.API,
    client_mutation_id="",
    instance=None,
    diff_summary=None,
):
    if client_mutation_id:
        existing = ApprovalRequest.objects.filter(
            submitted_by_user_id=submitted_by_user_id,
            client_mutation_id=client_mutation_id,
        ).first()
        if existing is not None:
            return existing, False

    if action_type != ApprovalActionType.CREATE:
        ApprovalRequest.objects.filter(
            entity_type=entity_type,
            entity_id=entity_id,
            submitted_by_user_id=submitted_by_user_id,
            status=ApprovalStatus.PENDING,
        ).update(
            status=ApprovalStatus.SUPERSEDED,
            reviewed_at=timezone.now(),
            review_notes="Superseded by a newer submission from the same user.",
            sync_version=F("sync_version") + 1,
            updated_at=timezone.now(),
        )

    approval_request = ApprovalRequest.objects.create(
        community_id=community_id,
        entity_type=entity_type,
        entity_id=entity_id or 0,
        action_type=action_type,
        submitted_payload=payload,
        diff_summary=diff_summary
        if diff_summary is not None
        else build_diff_summary(payload=payload, instance=instance),
        review_scope=decision.review_scope,
        policy_reason=decision.reason,
        submission_source=submission_source,
        base_sync_version=getattr(instance, "sync_version", None),
        submitted_by_user_id=submitted_by_user_id,
        created_by_user_id=submitted_by_user_id,
        updated_by_user_id=submitted_by_user_id,
        client_mutation_id=client_mutation_id,
    )
    return approval_request, True
