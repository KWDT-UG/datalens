"""Read-only impact summaries for the API's soft-archive operation."""

import re

from django.apps import apps
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models.deletion import ProtectedError, RestrictedError
from rest_framework.exceptions import APIException

# These models refer to domain records through a type/id pair rather than a
# database foreign key, so Django's reverse-relation metadata cannot find them.
GENERIC_REFERENCES = (
    ("resources.Resource", "owner_type", "owner_id", "resources owned"),
    (
        "resources.ResourceBeneficiary",
        "beneficiary_type",
        "beneficiary_id",
        "resource beneficiary links",
    ),
    (
        "resources.ResourcePaymentObligation",
        "responsible_party_type",
        "responsible_party_id",
        "payment obligations",
    ),
    (
        "resources.ResourcePaymentTransaction",
        "received_from_type",
        "received_from_id",
        "payment transactions",
    ),
    ("impacts.ImpactRecord", "beneficiary_type", "beneficiary_id", "impact records"),
    ("groups.ActivityParty", "party_type", "party_id", "activity links"),
)

# Approval requests are audit/workflow history rather than child records. They
# are deliberately omitted from confirmation counts, but remain in the DB.
IGNORED_REVERSE_MODELS = {"approvals.approvalrequest"}

# These are evidence/history owned by an aggregate. Archiving the parent hides
# it from normal product views but deliberately retains the evidence. Other
# active references are blockers because they would point at an archived record
# that users still interact with.
NON_BLOCKING_REVERSE_RELATIONS = {
    ("communities.community", "common.userprofile", "assigned_user_profiles"),
    ("communities.community", "groups.groupactivity", "group_activities"),
    ("groups.group", "groups.groupactivity", "activities"),
    ("groups.groupactivity", "groups.activityparty", "parties"),
    ("participation.committee", "groups.groupactivity", "group_activities"),
    ("resources.resource", "impacts.impactrecord", "impact_records"),
    ("resources.resource", "resources.resourcestatusevent", "status_events"),
    ("resources.resource", "resources.resourcethematicarea", "thematic_links"),
    (
        "resources.resourcepaymentobligation",
        "resources.resourcepaymenttransaction",
        "transactions",
    ),
    ("resources.thematicarea", "common.userprofile", "assigned_user_profiles"),
}

NON_BLOCKING_GENERIC_MODELS = {
    "groups.activityparty",
    "impacts.impactrecord",
    "resources.resourcepaymenttransaction",
}


class ArchiveConflict(APIException):
    status_code = 409
    default_code = "archive_blocked"
    default_detail = "Record has active dependencies and cannot be archived."

    def __init__(self, detail=None, code=None):
        # APIException normally converts every nested primitive to ErrorDetail,
        # which would turn preview booleans/counts into strings. Preserve this
        # machine-readable conflict document for clients.
        payload = detail or {
            "detail": self.default_detail,
            "code": self.default_code,
        }
        super().__init__(payload.get("detail", self.default_detail), code=code)
        self.detail = payload


class RestoreConflict(ArchiveConflict):
    default_code = "restore_blocked"
    default_detail = "Record depends on archived records and cannot be restored."


class PermanentDeleteConflict(ArchiveConflict):
    default_code = "delete_blocked"
    default_detail = "Record has related data and cannot be permanently deleted."


def _active_queryset(model):
    queryset = model._default_manager.all()
    if any(field.name == "is_deleted" for field in model._meta.concrete_fields):
        queryset = queryset.filter(is_deleted=False)
    return queryset


def _party_type_for(instance):
    model_name = instance._meta.model_name
    return {
        "community": "community",
        "group": "group",
        "member": "member",
        "institution": "institution",
        "cooperative": "cooperative",
        "committee": "committee",
    }.get(model_name)


def archive_dependencies(instance):
    """Return active records that reference ``instance``.

    The operation is a soft archive, so none of these records are recursively
    changed. The response exists to make that consequence explicit before a UI
    asks the user to confirm.
    """

    dependencies = []
    for relation in instance._meta.related_objects:
        related_model = relation.related_model
        if related_model._meta.label_lower in IGNORED_REVERSE_MODELS:
            continue
        accessor = relation.get_accessor_name()
        if not accessor or not hasattr(instance, accessor):
            continue
        manager = getattr(instance, accessor)
        try:
            queryset = manager.all()
        except AttributeError:
            continue
        if any(
            field.name == "is_deleted" for field in related_model._meta.concrete_fields
        ):
            queryset = queryset.filter(is_deleted=False)
        count = queryset.count()
        if not count:
            continue
        relation_key = (
            instance._meta.label_lower,
            related_model._meta.label_lower,
            accessor,
        )
        blocking = relation_key not in NON_BLOCKING_REVERSE_RELATIONS
        dependencies.append(
            {
                "type": related_model._meta.model_name,
                "label": str(related_model._meta.verbose_name_plural),
                "relationship": accessor,
                "count": count,
                "consequence": "blocks_archive" if blocking else "retained",
                "blocking": blocking,
            }
        )

    party_type = _party_type_for(instance)
    if party_type:
        for model_label, type_field, id_field, label in GENERIC_REFERENCES:
            model = apps.get_model(model_label)
            if party_type not in dict(model._meta.get_field(type_field).choices):
                continue
            queryset = _active_queryset(model).filter(
                **{type_field: party_type, id_field: instance.pk}
            )
            count = queryset.count()
            if count:
                blocking = model._meta.label_lower not in NON_BLOCKING_GENERIC_MODELS
                dependencies.append(
                    {
                        "type": model._meta.model_name,
                        "label": label,
                        "relationship": f"{type_field}/{id_field}",
                        "count": count,
                        "consequence": "blocks_archive" if blocking else "retained",
                        "blocking": blocking,
                    }
                )

    dependencies.sort(key=lambda item: (item["label"], item["relationship"]))
    return dependencies


def archive_preview(instance):
    dependencies = archive_dependencies(instance)
    related_count = sum(item["count"] for item in dependencies)
    blockers = [item for item in dependencies if item["blocking"]]
    warnings = [item for item in dependencies if not item["blocking"]]
    blocker_count = sum(item["count"] for item in blockers)
    warning_count = sum(item["count"] for item in warnings)
    noun = str(instance._meta.verbose_name)
    return {
        "action": "archive",
        "record": {
            "id": instance.pk,
            "type": instance._meta.model_name,
            "label": str(instance),
        },
        "requires_confirmation": True,
        "is_reversible": True,
        "will_cascade": False,
        "can_archive": blocker_count == 0,
        "related_record_count": related_count,
        "related_records": dependencies,
        "blocker_count": blocker_count,
        "blockers": blockers,
        "warning_count": warning_count,
        "warnings": warnings,
        "confirmation_message": (
            f"This {noun} cannot be archived while {blocker_count} active related "
            "record(s) still depend on it. Archive or reassign those records first."
            if blocker_count
            else f"Archive this {noun}? {warning_count} historical/reference "
            "record(s) will be retained and will not be archived automatically."
            if warning_count
            else f"Archive this {noun}? You can restore it later."
        ),
    }


def permanent_delete_dependencies(instance):
    """Return every stored relationship that makes hard deletion unsafe."""

    dependencies = []
    for relation in instance._meta.related_objects:
        related_model = relation.related_model
        accessor = relation.get_accessor_name()
        if not accessor or not hasattr(instance, accessor):
            continue
        try:
            related = getattr(instance, accessor)
        except ObjectDoesNotExist:
            # Reverse one-to-one descriptors raise when no related row exists.
            continue
        try:
            count = related.all().count()
        except AttributeError:
            count = 1 if related is not None else 0
        if count:
            dependencies.append(
                {
                    "type": related_model._meta.model_name,
                    "label": str(related_model._meta.verbose_name_plural),
                    "relationship": accessor,
                    "count": count,
                    "consequence": "blocks_delete",
                    "blocking": True,
                }
            )

    party_type = _party_type_for(instance)
    if party_type:
        for model_label, type_field, id_field, label in GENERIC_REFERENCES:
            model = apps.get_model(model_label)
            choices = dict(model._meta.get_field(type_field).choices)
            if choices and party_type not in choices:
                continue
            count = model._default_manager.filter(
                **{type_field: party_type, id_field: instance.pk}
            ).count()
            if count:
                dependencies.append(
                    {
                        "type": model._meta.model_name,
                        "label": label,
                        "relationship": f"{type_field}/{id_field}",
                        "count": count,
                        "consequence": "blocks_delete",
                        "blocking": True,
                    }
                )

    approval_entity_type = re.sub(
        r"(?<!^)(?=[A-Z])",
        "_",
        instance.__class__.__name__,
    ).lower()
    approval_model = apps.get_model("approvals.ApprovalRequest")
    approval_count = approval_model._default_manager.filter(
        entity_type=approval_entity_type,
        entity_id=instance.pk,
    ).count()
    if approval_count and not any(
        item["type"] == approval_model._meta.model_name for item in dependencies
    ):
        dependencies.append(
            {
                "type": approval_model._meta.model_name,
                "label": "approval requests",
                "relationship": "entity_type/entity_id",
                "count": approval_count,
                "consequence": "blocks_delete",
                "blocking": True,
            }
        )

    dependencies.sort(key=lambda item: (item["label"], item["relationship"]))
    return dependencies


def permanent_delete_preview(instance):
    dependencies = permanent_delete_dependencies(instance)
    related_count = sum(item["count"] for item in dependencies)
    noun = str(instance._meta.verbose_name)
    return {
        "action": "delete_permanently",
        "record": {
            "id": instance.pk,
            "type": instance._meta.model_name,
            "label": str(instance),
        },
        "requires_confirmation": True,
        "confirmation_token": "DELETE",
        "is_reversible": False,
        "will_cascade": False,
        "can_delete": related_count == 0,
        "related_record_count": related_count,
        "related_records": dependencies,
        "blocker_count": related_count,
        "blockers": dependencies,
        "confirmation_message": (
            f"This {noun} cannot be permanently deleted while {related_count} "
            "stored related record(s) still depend on it. Remove or reassign "
            "those records first."
            if related_count
            else f"Permanently delete this {noun}? This cannot be undone."
        ),
    }


def ensure_permanent_delete_allowed(instance):
    preview = permanent_delete_preview(instance)
    if not preview["can_delete"]:
        raise PermanentDeleteConflict(
            {
                "detail": preview["confirmation_message"],
                "code": "delete_blocked",
                "delete_preview": preview,
            }
        )
    return preview


@transaction.atomic
def permanently_delete_instance(instance):
    locked = instance.__class__._default_manager.select_for_update().get(pk=instance.pk)
    ensure_permanent_delete_allowed(locked)
    try:
        deleted_count, _deleted_by_model = locked.delete()
    except (ProtectedError, RestrictedError) as exc:
        raise PermanentDeleteConflict(
            {
                "detail": (
                    "Permanent deletion was cancelled because related data "
                    "still depends on this record. Refresh the preview and retry."
                ),
                "code": "delete_blocked",
            }
        ) from exc
    if deleted_count != 1:
        # Defense in depth: if a newly introduced CASCADE relation ever escapes
        # preview discovery, rolling this transaction back is safer than
        # silently deleting more than the selected row.
        raise PermanentDeleteConflict(
            {
                "detail": (
                    "Permanent deletion was cancelled because it would remove "
                    "related data. Nothing was deleted."
                ),
                "code": "delete_blocked",
            }
        )


def ensure_archive_allowed(instance):
    preview = archive_preview(instance)
    if not preview["can_archive"]:
        raise ArchiveConflict(
            {
                "detail": preview["confirmation_message"],
                "code": "archive_blocked",
                "archive_preview": preview,
            }
        )
    return preview


def _party_model(party_type):
    label = {
        "community": "communities.Community",
        "group": "groups.Group",
        "member": "members.Member",
        "institution": "institutions.Institution",
        "committee": "participation.Committee",
        "cooperative": "participation.Cooperative",
    }.get(party_type)
    return apps.get_model(label) if label else None


def restore_blockers(instance, *, lock=False):
    """Return archived parents that would make a restored record invalid."""

    blockers = []
    for field in instance._meta.concrete_fields:
        if not (field.many_to_one or field.one_to_one):
            continue
        parent_id = getattr(instance, field.attname)
        model = field.remote_field.model
        if parent_id is None or not any(
            item.name == "is_deleted" for item in model._meta.concrete_fields
        ):
            continue
        queryset = model._default_manager.filter(pk=parent_id)
        if lock:
            queryset = queryset.select_for_update()
        parent = queryset.first()
        if parent is not None and parent.is_deleted:
            blockers.append(
                {
                    "field": field.name,
                    "type": model._meta.model_name,
                    "id": parent_id,
                    "label": str(parent),
                }
            )

    generic_fields = {
        "groups.activityparty": ("party_type", "party_id"),
        "impacts.impactrecord": ("beneficiary_type", "beneficiary_id"),
        "resources.resource": ("owner_type", "owner_id"),
        "resources.resourcebeneficiary": ("beneficiary_type", "beneficiary_id"),
        "resources.resourcepaymentobligation": (
            "responsible_party_type",
            "responsible_party_id",
        ),
        "resources.resourcepaymenttransaction": (
            "received_from_type",
            "received_from_id",
        ),
    }.get(instance._meta.label_lower)
    if generic_fields:
        type_field, id_field = generic_fields
        party_type = getattr(instance, type_field)
        party_id = getattr(instance, id_field)
        model = _party_model(party_type)
        if model is not None and party_id is not None:
            queryset = model._default_manager.filter(pk=party_id)
            if lock:
                queryset = queryset.select_for_update()
            parent = queryset.first()
            if parent is not None and parent.is_deleted:
                blockers.append(
                    {
                        "field": f"{type_field}/{id_field}",
                        "type": model._meta.model_name,
                        "id": party_id,
                        "label": str(parent),
                    }
                )
    return blockers


@transaction.atomic
def restore_instance(instance, *, user_id=None):
    """Restore only when all structural and polymorphic parents are active."""

    locked = instance.__class__._default_manager.select_for_update().get(pk=instance.pk)
    if not locked.is_deleted:
        return locked
    blockers = restore_blockers(locked, lock=True)
    if blockers:
        raise RestoreConflict(
            {
                "detail": (
                    "Restore the archived parent record(s) first, then retry this "
                    "restore."
                ),
                "code": "restore_blocked",
                "restore_blockers": blockers,
            }
        )
    locked.is_deleted = False
    locked.updated_by_user_id = user_id
    update_fields = ["is_deleted", "updated_by_user_id", "updated_at"]
    if hasattr(locked, "sync_version"):
        locked.sync_version += 1
        update_fields.append("sync_version")
    locked.save(update_fields=update_fields)
    return locked


@transaction.atomic
def archive_instance(instance, *, user_id=None, client_mutation_id=""):
    """Lock, re-check dependencies, and soft archive in one transaction."""

    locked = instance.__class__._default_manager.select_for_update().get(pk=instance.pk)
    if locked.is_deleted:
        return locked
    ensure_archive_allowed(locked)
    locked.is_deleted = True
    locked.updated_by_user_id = user_id
    update_fields = ["is_deleted", "updated_by_user_id", "updated_at"]
    if hasattr(locked, "sync_version"):
        locked.sync_version += 1
        update_fields.append("sync_version")
    if client_mutation_id:
        locked.client_mutation_id = client_mutation_id
        update_fields.append("client_mutation_id")
    locked.save(update_fields=update_fields)
    return locked
