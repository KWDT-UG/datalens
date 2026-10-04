from django.db.models import Q
from rest_framework.exceptions import PermissionDenied

from apps.common.models import UserRole
from apps.common.permissions import user_is_mvp_staff_admin

COMMUNITY_LOOKUPS = {
    "communities.community": "pk",
    "groups.group": "community_id",
    "groups.groupactivity": "community_id",
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
    "resources.resourcepaymentobligation": "resource__community_id",
    "resources.resourcepaymenttransaction": "obligation__resource__community_id",
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
            Q(
                resources__program__thematic_area__in=(
                    profile.assigned_thematic_areas.all()
                ),
                resources__is_deleted=False,
            )
            | Q(
                resources__thematic_links__thematic_area__in=(
                    profile.assigned_thematic_areas.all()
                ),
                resources__is_deleted=False,
                resources__thematic_links__is_deleted=False,
            )
        )
    return Community.objects.filter(query).values_list("pk", flat=True).distinct()


def scope_queryset_for_user(queryset, user):
    if not user or not user.is_authenticated:
        return queryset.none()

    label = queryset.model._meta.label_lower
    if label in {
        "resources.thematicarea",
        "resources.program",
        "resources.resourcecategory",
    }:
        profile = _profile(user)
        if (
            assignment_scope_is_active(user)
            and UserRole.PROGRAMME_MANAGER in _scoped_roles(user)
            and profile.assigned_thematic_areas.exists()
        ):
            assigned_areas = profile.assigned_thematic_areas.all()
            if label == "resources.thematicarea":
                return queryset.filter(pk__in=assigned_areas.values("pk"))
            if label == "resources.program":
                return queryset.filter(thematic_area__in=assigned_areas)
            return queryset.filter(program__thematic_area__in=assigned_areas)
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
    if entity_type in {"thematic_area", "program", "resource_category"}:
        from apps.resources.models import Program, ResourceCategory

        profile = _profile(user)
        if not profile.assigned_thematic_areas.exists():
            return
        thematic_id = None
        if entity_type == "thematic_area":
            thematic_id = instance.pk if instance is not None else payload.get("id")
        elif entity_type == "program":
            thematic_id = (
                instance.thematic_area_id
                if instance is not None
                else payload.get("thematic_area")
            )
        elif instance is not None:
            thematic_id = instance.program.thematic_area_id
        elif payload.get("program"):
            thematic_id = Program.objects.filter(
                pk=payload["program"]
            ).values_list("thematic_area_id", flat=True).first()
        elif payload.get("id"):
            thematic_id = ResourceCategory.objects.filter(
                pk=payload["id"]
            ).values_list("program__thematic_area_id", flat=True).first()

        if not thematic_id or not profile.assigned_thematic_areas.filter(
            pk=thematic_id
        ).exists():
            raise PermissionDenied(
                "The proposed change is outside your thematic assignment."
            )
        return
    community_id = community_id_for_change(
        entity_type=entity_type,
        payload=payload,
        instance=instance,
    )
    if not user_can_access_community(user, community_id):
        raise PermissionDenied("The proposed change is outside your assigned scope.")
