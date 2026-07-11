from django.db.models import Q
from rest_framework.exceptions import PermissionDenied

from apps.common.models import UserRole
from apps.common.permissions import user_is_mvp_staff_admin


COMMUNITY_LOOKUPS = {
    "communities.community": "pk",
    "groups.group": "community_id",
    "members.member": "community_id",
    "institutions.institution": "community_id",
    "participation.committee": "community_id",
    "participation.committeemembership": "committee__community_id",
    "participation.cooperative": "community_id",
    "participation.cooperativemembership": "cooperative__community_id",
    "resources.resource": "community_id",
    "resources.resourcebeneficiary": "resource__community_id",
    "resources.resourcestatusevent": "resource__community_id",
    "resources.resourcethematicarea": "resource__community_id",
    "impacts.impactrecord": "resource__community_id",
    "approvals.approvalrequest": "community_id",
}


def _profile(user):
    if not user or not user.is_authenticated:
        return None
    return getattr(user, "datalens_profile", None)


def _scoped_roles(user):
    if not user or not user.is_authenticated or user_is_mvp_staff_admin(user):
        return set()
    role_names = set(user.groups.values_list("name", flat=True))
    return role_names.intersection(
        {UserRole.FIELD_OFFICER, UserRole.PROGRAMME_MANAGER}
    )


def assignment_scope_is_active(user):
    profile = _profile(user)
    if profile is None or not _scoped_roles(user):
        return False
    return bool(
        profile.assigned_districts
        or profile.assigned_communities.exists()
        or profile.assigned_thematic_areas.exists()
    )


def accessible_community_ids(user):
    if not assignment_scope_is_active(user):
        return None

    from apps.communities.models import Community

    profile = _profile(user)
    query = Q(pk__in=profile.assigned_communities.values("pk"))
    districts = [
        district.strip()
        for district in profile.assigned_districts
        if isinstance(district, str) and district.strip()
    ]
    if districts:
        query |= Q(district_name__in=districts)
    if UserRole.PROGRAMME_MANAGER in _scoped_roles(user):
        query |= Q(
            resources__thematic_links__thematic_area__in=(
                profile.assigned_thematic_areas.all()
            ),
            resources__is_deleted=False,
            resources__thematic_links__is_deleted=False,
        )
    return Community.objects.filter(query).values_list("pk", flat=True).distinct()


def scope_queryset_for_user(queryset, user):
    if not user or not user.is_authenticated:
        return queryset.none()

    label = queryset.model._meta.label_lower
    if label == "resources.thematicarea":
        profile = _profile(user)
        if (
            assignment_scope_is_active(user)
            and UserRole.PROGRAMME_MANAGER in _scoped_roles(user)
            and profile.assigned_thematic_areas.exists()
        ):
            return queryset.filter(pk__in=profile.assigned_thematic_areas.values("pk"))
        return queryset

    lookup = COMMUNITY_LOOKUPS.get(label)
    community_ids = accessible_community_ids(user)
    if lookup and community_ids is not None:
        return queryset.filter(**{f"{lookup}__in": community_ids})
    return queryset


def user_can_access_community(user, community_id):
    if community_id is None:
        return not assignment_scope_is_active(user)
    community_ids = accessible_community_ids(user)
    return community_ids is None or community_ids.filter(pk=community_id).exists()


def enforce_change_scope(*, user, entity_type, payload, instance=None):
    from apps.approvals.policy import community_id_for_change

    if not assignment_scope_is_active(user):
        return
    community_id = community_id_for_change(
        entity_type=entity_type,
        payload=payload,
        instance=instance,
    )
    if not user_can_access_community(user, community_id):
        raise PermissionDenied("The proposed change is outside your assigned scope.")

    if entity_type == "thematic_area":
        thematic_id = instance.pk if instance is not None else payload.get("id")
        profile = _profile(user)
        if (
            thematic_id
            and profile.assigned_thematic_areas.exists()
            and not profile.assigned_thematic_areas.filter(pk=thematic_id).exists()
        ):
            raise PermissionDenied(
                "The proposed change is outside your thematic assignment."
            )
