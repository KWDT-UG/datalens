from django.contrib.auth.models import Group
from django.db import transaction
from rest_framework.permissions import SAFE_METHODS, IsAuthenticated

from apps.common.models import UserRole


class AuthenticatedAccess(IsAuthenticated):
    """Default API permission; kept named so RBAC can replace it later."""


GROUP_NAME_BY_ROLE = {role: role for role in UserRole.values}

ROLE_BY_GROUP_NAME = {value: key for key, value in GROUP_NAME_BY_ROLE.items()}

READ = "read"
MANAGE_OPERATIONS = "manage_operations"
MANAGE_RESOURCES = "manage_resources"
MANAGE_IMPACT = "manage_impact"
ARCHIVE_OPERATIONS = "archive_operations"
ARCHIVE_RESOURCES = "archive_resources"
ARCHIVE_IMPACT = "archive_impact"
RESTORE_OPERATIONS = "restore_operations"
RESTORE_RESOURCES = "restore_resources"
RESTORE_IMPACT = "restore_impact"
SUBMIT_FOR_APPROVAL = "submit_for_approval"
REVIEW_APPROVALS = "review_approvals"
REVIEW_IMPACT_APPROVALS = "review_impact_approvals"
REVIEW_FINANCE_APPROVALS = "review_finance_approvals"
EXPORT = "export"
VIEW_PERSONAL_DATA = "view_personal_data"
VIEW_RESOURCE_FINANCIALS = "view_resource_financials"
MANAGE_RESOURCE_FINANCIALS = "manage_resource_financials"
MANAGE_USERS = "manage_users"
MANAGE_ROLES = "manage_roles"
MANAGE_SETTINGS = "manage_settings"

ROLE_CAPABILITIES = {
    UserRole.FIELD_OFFICER: {
        READ,
        MANAGE_OPERATIONS,
        MANAGE_RESOURCES,
        MANAGE_IMPACT,
        SUBMIT_FOR_APPROVAL,
        VIEW_PERSONAL_DATA,
    },
    UserRole.PROGRAMME_MANAGER: {
        READ,
        MANAGE_OPERATIONS,
        MANAGE_RESOURCES,
        MANAGE_IMPACT,
        ARCHIVE_OPERATIONS,
        ARCHIVE_RESOURCES,
        ARCHIVE_IMPACT,
        RESTORE_OPERATIONS,
        RESTORE_RESOURCES,
        RESTORE_IMPACT,
        SUBMIT_FOR_APPROVAL,
        REVIEW_APPROVALS,
        EXPORT,
        VIEW_PERSONAL_DATA,
    },
    UserRole.EXECUTIVE_LEADERSHIP: {
        READ,
        ARCHIVE_OPERATIONS,
        ARCHIVE_RESOURCES,
        ARCHIVE_IMPACT,
        RESTORE_OPERATIONS,
        RESTORE_RESOURCES,
        RESTORE_IMPACT,
        REVIEW_APPROVALS,
        REVIEW_FINANCE_APPROVALS,
        EXPORT,
        VIEW_PERSONAL_DATA,
        VIEW_RESOURCE_FINANCIALS,
    },
    UserRole.FINANCE_ADMINISTRATOR: {
        READ,
        MANAGE_RESOURCES,
        ARCHIVE_RESOURCES,
        RESTORE_RESOURCES,
        SUBMIT_FOR_APPROVAL,
        REVIEW_FINANCE_APPROVALS,
        EXPORT,
        VIEW_RESOURCE_FINANCIALS,
        MANAGE_RESOURCE_FINANCIALS,
    },
    UserRole.MONITORING_EVALUATION_MANAGER: {
        READ,
        MANAGE_IMPACT,
        ARCHIVE_IMPACT,
        RESTORE_IMPACT,
        SUBMIT_FOR_APPROVAL,
        REVIEW_IMPACT_APPROVALS,
        EXPORT,
        VIEW_PERSONAL_DATA,
    },
    UserRole.COMMUNICATIONS_VIEWER: {READ},
    UserRole.RESOURCE_PROCUREMENT_OFFICER: {
        READ,
        MANAGE_RESOURCES,
        ARCHIVE_RESOURCES,
        RESTORE_RESOURCES,
        SUBMIT_FOR_APPROVAL,
        VIEW_RESOURCE_FINANCIALS,
        MANAGE_RESOURCE_FINANCIALS,
    },
    UserRole.SYSTEM_ADMINISTRATOR: {
        READ,
        MANAGE_USERS,
        MANAGE_ROLES,
        MANAGE_SETTINGS,
    },
}

ALL_CAPABILITIES = set().union(*ROLE_CAPABILITIES.values())

RESOURCE_BASENAMES = {
    "resource",
    "resource-beneficiary",
    "resource-thematic-area",
    "thematic-area",
}
IMPACT_BASENAMES = {"impact-record"}
APPROVAL_BASENAMES = {"approval-request"}

LEGACY_ROLE_GROUPS = {"program_manager", "admin", "leadership"}
COMMUNICATIONS_READ_BASENAMES = {
    "community",
    "group",
    "committee",
    "cooperative",
    "resource",
    "thematic-area",
    "impact-record",
}
COMMUNICATIONS_BLOCKED_ACTIONS = {"institutions", "members", "memberships"}


def user_is_mvp_staff_admin(user):
    """Temporary MVP rule: Django staff users can exercise all product actions."""

    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


def ensure_role_groups():
    with transaction.atomic():
        for group_name in GROUP_NAME_BY_ROLE.values():
            Group.objects.get_or_create(name=group_name)


def assign_role(user, role):
    if role not in UserRole.values:
        raise ValueError(f"Unsupported Data Lens role: {role}")
    ensure_role_groups()
    user.groups.remove(
        *Group.objects.filter(
            name__in=set(GROUP_NAME_BY_ROLE.values()).union(LEGACY_ROLE_GROUPS)
        )
    )
    user.groups.add(Group.objects.get(name=GROUP_NAME_BY_ROLE[role]))


def user_role_names(user):
    if not user or not user.is_authenticated:
        return set()
    if user.is_superuser:
        return {UserRole.SYSTEM_ADMINISTRATOR}
    roles = {
        ROLE_BY_GROUP_NAME[group_name]
        for group_name in user.groups.values_list("name", flat=True)
        if group_name in ROLE_BY_GROUP_NAME
    }
    return roles


def user_capabilities(user):
    if not user or not user.is_authenticated:
        return set()
    if user_is_mvp_staff_admin(user):
        return ALL_CAPABILITIES
    return set().union(
        *(ROLE_CAPABILITIES.get(role, set()) for role in user_role_names(user))
    )


def user_has_capability(user, capability):
    return capability in user_capabilities(user)


def user_has_any_role(user, allowed_roles):
    return bool(user_role_names(user).intersection(set(allowed_roles)))


def required_write_capability(view):
    basename = getattr(view, "basename", "")
    action = getattr(view, "action", "")
    if basename in APPROVAL_BASENAMES:
        return SUBMIT_FOR_APPROVAL
    if basename in IMPACT_BASENAMES or action == "impact_records":
        return MANAGE_IMPACT
    if basename in RESOURCE_BASENAMES or action in {"beneficiaries", "status_events"}:
        return MANAGE_RESOURCES
    return MANAGE_OPERATIONS


def required_archive_capability(view):
    basename = getattr(view, "basename", "")
    if basename in IMPACT_BASENAMES:
        return ARCHIVE_IMPACT
    if basename in RESOURCE_BASENAMES:
        return ARCHIVE_RESOURCES
    return ARCHIVE_OPERATIONS


def required_restore_capability(view):
    basename = getattr(view, "basename", "")
    if basename in IMPACT_BASENAMES:
        return RESTORE_IMPACT
    if basename in RESOURCE_BASENAMES:
        return RESTORE_RESOURCES
    return RESTORE_OPERATIONS


class RoleActionAccess(IsAuthenticated):
    """Enforce the MVP capability matrix for API actions."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        if request.method in SAFE_METHODS:
            if user_role_names(request.user) == {UserRole.COMMUNICATIONS_VIEWER}:
                return (
                    getattr(view, "basename", "") in COMMUNICATIONS_READ_BASENAMES
                    and getattr(view, "action", "") not in COMMUNICATIONS_BLOCKED_ACTIONS
                )
            return user_has_capability(request.user, READ)
        if getattr(view, "action", "") == "restore":
            return user_has_capability(
                request.user,
                required_restore_capability(view),
            )
        if request.method == "DELETE":
            return (
                user_has_capability(
                    request.user,
                    required_archive_capability(view),
                )
                or (
                    user_has_capability(request.user, SUBMIT_FOR_APPROVAL)
                    and user_has_capability(
                        request.user,
                        required_write_capability(view),
                    )
                )
            )
        return user_has_capability(request.user, required_write_capability(view))

    def has_object_permission(self, request, view, obj):
        from apps.common.scoping import scope_queryset_for_user

        model = obj.__class__
        return scope_queryset_for_user(
            model.objects.filter(pk=obj.pk),
            request.user,
        ).exists()


class ApprovalReviewAccess(RoleActionAccess):
    """Review access, with M&E reviewers limited to impact approvals."""

    def has_permission(self, request, view):
        if not IsAuthenticated.has_permission(self, request, view):
            return False
        capabilities = user_capabilities(request.user)
        return bool(
            capabilities.intersection(
                {
                    REVIEW_APPROVALS,
                    REVIEW_IMPACT_APPROVALS,
                    REVIEW_FINANCE_APPROVALS,
                }
            )
        )

    def has_object_permission(self, request, view, obj):
        from apps.common.models import ApprovalReviewScope

        if obj.review_scope == ApprovalReviewScope.FINANCE:
            return user_has_capability(request.user, REVIEW_FINANCE_APPROVALS)
        if (
            obj.review_scope == ApprovalReviewScope.IMPACT
            or obj.entity_type == "impact_record"
        ):
            return user_has_capability(
                request.user, REVIEW_APPROVALS
            ) or user_has_capability(request.user, REVIEW_IMPACT_APPROVALS)
        return user_has_capability(request.user, REVIEW_APPROVALS)


class AdminUserAccess(IsAuthenticated):
    """Restrict product user administration to system administrators."""

    def has_permission(self, request, view):
        return (
            super().has_permission(request, view)
            and user_has_capability(request.user, MANAGE_USERS)
        )
