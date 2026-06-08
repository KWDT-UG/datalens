from django.db import transaction
from rest_framework.exceptions import APIException, ValidationError

from apps.common.models import ApprovalActionType
from apps.communities.models import Community
from apps.communities.serializers import CommunitySerializer
from apps.groups.models import Group
from apps.groups.serializers import GroupSerializer
from apps.impacts.models import ImpactRecord
from apps.impacts.serializers import ImpactRecordSerializer
from apps.institutions.models import Institution
from apps.institutions.serializers import InstitutionSerializer
from apps.members.models import Member
from apps.members.serializers import MemberSerializer
from apps.participation.models import (
    Committee,
    CommitteeMembership,
    Cooperative,
    CooperativeMembership,
)
from apps.participation.serializers import (
    CommitteeMembershipSerializer,
    CommitteeSerializer,
    CooperativeMembershipSerializer,
    CooperativeSerializer,
)
from apps.resources.models import (
    Resource,
    ResourceBeneficiary,
    ResourceStatusEvent,
    ResourceThematicArea,
    ThematicArea,
)
from apps.resources.serializers import (
    ResourceBeneficiarySerializer,
    ResourceSerializer,
    ResourceStatusEventSerializer,
    ResourceThematicAreaSerializer,
    ThematicAreaSerializer,
)

APPROVAL_ENTITY_REGISTRY = {
    "community": (Community, CommunitySerializer),
    "group": (Group, GroupSerializer),
    "member": (Member, MemberSerializer),
    "institution": (Institution, InstitutionSerializer),
    "committee": (Committee, CommitteeSerializer),
    "committee_membership": (CommitteeMembership, CommitteeMembershipSerializer),
    "cooperative": (Cooperative, CooperativeSerializer),
    "cooperative_membership": (CooperativeMembership, CooperativeMembershipSerializer),
    "thematic_area": (ThematicArea, ThematicAreaSerializer),
    "resource": (Resource, ResourceSerializer),
    "resource_beneficiary": (ResourceBeneficiary, ResourceBeneficiarySerializer),
    "resource_thematic_area": (ResourceThematicArea, ResourceThematicAreaSerializer),
    "resource_status_event": (ResourceStatusEvent, ResourceStatusEventSerializer),
    "impact_record": (ImpactRecord, ImpactRecordSerializer),
}


class ApprovalConflict(APIException):
    status_code = 409
    default_detail = "The target changed after this approval request was submitted."
    default_code = "approval_conflict"


def supported_entity_types():
    return tuple(APPROVAL_ENTITY_REGISTRY.keys())


def get_approval_target(approval_request):
    model, _serializer_class = APPROVAL_ENTITY_REGISTRY[approval_request.entity_type]
    return model.objects.filter(pk=approval_request.entity_id).first()


@transaction.atomic
def apply_approval_request(approval_request, user_id=None):
    try:
        model, serializer_class = APPROVAL_ENTITY_REGISTRY[approval_request.entity_type]
    except KeyError as exc:
        raise ValidationError(
            {"entity_type": "Unsupported approval entity type."}
        ) from exc

    payload = approval_request.submitted_payload or {}
    save_kwargs = {}
    if user_id is not None:
        save_kwargs["updated_by_user_id"] = user_id

    if approval_request.action_type == ApprovalActionType.CREATE:
        serializer = serializer_class(data=payload)
        serializer.is_valid(raise_exception=True)
        submitter_id = approval_request.submitted_by_user_id
        if submitter_id is not None:
            save_kwargs["created_by_user_id"] = submitter_id
            if any(
                field.name == "recorded_by_user_id"
                for field in model._meta.fields
            ):
                save_kwargs["recorded_by_user_id"] = submitter_id
        instance = serializer.save(**save_kwargs)
        approval_request.entity_id = instance.pk
        return instance

    instance = model.objects.select_for_update().filter(
        pk=approval_request.entity_id
    ).first()
    if instance is None:
        raise ValidationError({"entity_id": "Approval target could not be found."})

    if (
        approval_request.base_sync_version is not None
        and hasattr(instance, "sync_version")
        and approval_request.base_sync_version != instance.sync_version
    ):
        raise ApprovalConflict(
            {
                "sync_version": (
                    "The target changed after submission. Supersede this request "
                    "and submit a new change."
                )
            }
        )

    if approval_request.action_type == ApprovalActionType.UPDATE:
        serializer = serializer_class(instance, data=payload, partial=True)
        serializer.is_valid(raise_exception=True)
        if hasattr(instance, "sync_version"):
            save_kwargs["sync_version"] = instance.sync_version + 1
        return serializer.save(**save_kwargs)

    if approval_request.action_type == ApprovalActionType.DELETE:
        instance.is_deleted = True
        update_fields = ["is_deleted", "updated_at"]
        if user_id is not None:
            instance.updated_by_user_id = user_id
            update_fields.append("updated_by_user_id")
        if hasattr(instance, "sync_version"):
            instance.sync_version += 1
            update_fields.append("sync_version")
        instance.save(update_fields=update_fields)
        return instance

    raise ValidationError({"action_type": "Unsupported approval action type."})
