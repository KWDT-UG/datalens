from copy import deepcopy

from apps.common.models import UserRole


PII_FIELDS = {
    "members.member": {
        "date_of_birth",
        "phone",
        "email",
        "address_text",
        "notes",
    },
    "institutions.institution": {
        "contact_name",
        "phone",
        "email",
        "location_text",
        "notes",
    },
}
INTERNAL_FIELDS = {
    "created_by_user_id",
    "updated_by_user_id",
    "client_created_at",
    "client_updated_at",
    "client_mutation_id",
    "sync_version",
    "is_deleted",
    "approval_status",
    "pending_approval_request_id",
    "approval_history_count",
}
PUBLICATION_SENSITIVE_FIELDS = {
    "notes",
    "source_notes",
    "serial_or_tag_number",
    "location_text",
    "recorded_by_user_id",
}
FINANCIAL_FIELDS = {"value_amount", "value_currency"}


def _communications_only(user):
    if not user or not user.is_authenticated or user.is_superuser:
        return False
    roles = set(user.groups.values_list("name", flat=True))
    return roles == {UserRole.COMMUNICATIONS_VIEWER}


def sanitize_model_representation(instance, data, user):
    from apps.common.permissions import (
        VIEW_PERSONAL_DATA,
        VIEW_RESOURCE_FINANCIALS,
        user_has_capability,
    )

    result = dict(data)
    label = instance._meta.label_lower
    if not user_has_capability(user, VIEW_PERSONAL_DATA):
        for field in PII_FIELDS.get(label, set()):
            if field in result:
                result[field] = None
    if label == "resources.resource" and not user_has_capability(
        user, VIEW_RESOURCE_FINANCIALS
    ):
        for field in FINANCIAL_FIELDS:
            if field in result:
                result[field] = None
    if _communications_only(user):
        for field in INTERNAL_FIELDS | PUBLICATION_SENSITIVE_FIELDS:
            result.pop(field, None)
        if label == "resources.resource":
            result.pop("owner_id", None)
        if label == "impacts.impactrecord":
            result.pop("beneficiary_id", None)
    return result


def sanitize_approval_payload(entity_type, payload, user):
    from apps.common.permissions import (
        VIEW_PERSONAL_DATA,
        VIEW_RESOURCE_FINANCIALS,
        user_has_capability,
    )

    result = deepcopy(payload or {})
    label_by_entity = {
        "member": "members.member",
        "institution": "institutions.institution",
    }
    if not user_has_capability(user, VIEW_PERSONAL_DATA):
        for field in PII_FIELDS.get(label_by_entity.get(entity_type), set()):
            if field in result:
                result[field] = None
    if entity_type == "resource" and not user_has_capability(
        user, VIEW_RESOURCE_FINANCIALS
    ):
        for field in FINANCIAL_FIELDS:
            if field in result:
                result[field] = None
    return result
