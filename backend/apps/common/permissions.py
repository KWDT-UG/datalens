from django.contrib.auth.models import Group
from django.db import transaction
from rest_framework.permissions import SAFE_METHODS, IsAuthenticated

from apps.common.models import UserRole


class AuthenticatedAccess(IsAuthenticated):
    """Default API permission; kept named so RBAC can replace it later."""


GROUP_NAME_BY_ROLE = {
    UserRole.FIELD_OFFICER: "field_officer",
    UserRole.PROGRAM_MANAGER: "program_manager",
    UserRole.ADMIN: "admin",
    UserRole.LEADERSHIP: "leadership",
}

ROLE_BY_GROUP_NAME = {value: key for key, value in GROUP_NAME_BY_ROLE.items()}

READ_ACTIONS = {
    "list",
    "retrieve",
    "summary",
    "groups",
    "institutions",
    "members",
    "memberships",
    "beneficiaries",
    "status_events",
    "impact_records",
    "detail_view",
}
WRITE_ACTIONS = {"create", "update", "partial_update"}
DELETE_ACTIONS = {"destroy"}
APPROVAL_REVIEW_ACTIONS = {"approve", "reject", "supersede"}


def ensure_role_groups():
    with transaction.atomic():
        for group_name in GROUP_NAME_BY_ROLE.values():
            Group.objects.get_or_create(name=group_name)


def assign_role(user, role):
    ensure_role_groups()
    user.groups.add(Group.objects.get(name=GROUP_NAME_BY_ROLE[role]))


def user_role_names(user):
    if not user or not user.is_authenticated:
        return set()
    if user.is_superuser or user.is_staff:
        return {UserRole.ADMIN}
    roles = {
        ROLE_BY_GROUP_NAME[group_name]
        for group_name in user.groups.values_list("name", flat=True)
        if group_name in ROLE_BY_GROUP_NAME
    }
    return roles or {UserRole.FIELD_OFFICER}


def user_has_any_role(user, allowed_roles):
    return bool(user_role_names(user).intersection(set(allowed_roles)))


class RoleActionAccess(IsAuthenticated):
    """
    Role-aware default API permission.

    Development settings intentionally override this with AllowAny until auth UX
    is implemented. In authenticated settings, users without an explicit role
    default to field-officer access so early Django auth accounts keep working.
    """

    read_roles = {
        UserRole.FIELD_OFFICER,
        UserRole.PROGRAM_MANAGER,
        UserRole.ADMIN,
        UserRole.LEADERSHIP,
    }
    write_roles = {UserRole.FIELD_OFFICER, UserRole.PROGRAM_MANAGER, UserRole.ADMIN}
    delete_roles = {UserRole.PROGRAM_MANAGER, UserRole.ADMIN}

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        action = getattr(view, "action", None)
        if request.method in SAFE_METHODS or action in READ_ACTIONS:
            return user_has_any_role(request.user, self.read_roles)
        if action in WRITE_ACTIONS:
            return user_has_any_role(request.user, self.write_roles)
        if action in DELETE_ACTIONS:
            return user_has_any_role(request.user, self.delete_roles)
        return user_has_any_role(request.user, self.write_roles)


class ApprovalReviewAccess(RoleActionAccess):
    """Program-manager/admin permission for approval review actions."""

    review_roles = {UserRole.PROGRAM_MANAGER, UserRole.ADMIN}

    def has_permission(self, request, view):
        if not IsAuthenticated.has_permission(self, request, view):
            return False
        return user_has_any_role(request.user, self.review_roles)
