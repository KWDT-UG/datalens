from datetime import date

from django.db.models import Count, Max, Sum
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.approvals.models import ApprovalRequest
from apps.common.models import ApprovalStatus, MemberStatus, ResourceStatus
from apps.common.permissions import (
    REVIEW_APPROVALS,
    REVIEW_IMPACT_APPROVALS,
    AuthenticatedAccess,
    user_has_capability,
)
from apps.communities.models import Community
from apps.groups.models import Group
from apps.impacts.models import ImpactRecord
from apps.institutions.models import Institution
from apps.members.models import Member
from apps.resources.models import Resource, ThematicArea
from apps.common.scoping import scope_queryset_for_user


def visible_approval_requests(user):
    queryset = scope_queryset_for_user(
        ApprovalRequest.objects.filter(is_deleted=False),
        user,
    )
    if user_has_capability(user, REVIEW_APPROVALS):
        return queryset
    if user_has_capability(user, REVIEW_IMPACT_APPROVALS):
        return queryset.filter(entity_type="impact_record")
    return queryset.filter(submitted_by_user_id=user.pk)


def recent_activity(user, community_id=None, resource_queryset=None):
    records = []
    community_queryset = scope_queryset_for_user(
        Community.objects.filter(is_deleted=False),
        user,
    )
    group_queryset = scope_queryset_for_user(
        Group.objects.filter(is_deleted=False),
        user,
    ).select_related("community")
    scoped_resource_queryset = (
        resource_queryset
        if resource_queryset is not None
        else scope_queryset_for_user(
            Resource.objects.filter(is_deleted=False),
            user,
        )
    )
    impact_queryset = scope_queryset_for_user(
        ImpactRecord.objects.filter(is_deleted=False),
        user,
    ).select_related("resource__community")

    if community_id:
        community_queryset = community_queryset.filter(pk=community_id)
        group_queryset = group_queryset.filter(community_id=community_id)
        scoped_resource_queryset = scoped_resource_queryset.filter(community_id=community_id)
        impact_queryset = impact_queryset.filter(resource__community_id=community_id)

    if resource_queryset is not None:
        impact_queryset = impact_queryset.filter(resource__in=resource_queryset)

    sources = [
        (
            "community",
            community_queryset.order_by("-updated_at")[:5],
            lambda item: item.name,
            lambda item: item.id,
            lambda item: item.name,
            lambda item: f"/communities/{item.id}/groups",
        ),
        (
            "group",
            group_queryset.order_by("-updated_at")[:5],
            lambda item: item.name,
            lambda item: item.community_id,
            lambda item: item.community.name,
            lambda item: f"/communities/{item.community_id}/groups",
        ),
        (
            "resource",
            scoped_resource_queryset.select_related("community").order_by("-updated_at")[:5],
            lambda item: item.name,
            lambda item: item.community_id,
            lambda item: item.community.name,
            lambda item: "/resources",
        ),
        (
            "impact_record",
            impact_queryset.order_by("-updated_at")[:5],
            lambda item: f"Impact for {item.resource.name}",
            lambda item: item.resource.community_id,
            lambda item: item.resource.community.name,
            lambda item: "/impact",
        ),
    ]
    if resource_queryset is not None:
        sources = [source for source in sources if source[0] in {"resource", "impact_record"}]

    for record_type, queryset, label, community_id, community_name, path in sources:
        records.extend(
            {
                "type": record_type,
                "id": item.id,
                "label": label(item),
                "community_id": community_id(item),
                "community_name": community_name(item),
                "updated_at": item.updated_at,
                "path": path(item),
            }
            for item in queryset
        )

    return sorted(records, key=lambda item: item["updated_at"], reverse=True)[:8]


def months_before(value, months):
    year = value.year
    month = value.month - months
    while month <= 0:
        year -= 1
        month += 12
    return date(year, month, 1)


def filter_impact_period(queryset, period):
    if period not in {"3", "6", "12"}:
        return queryset
    latest_date = queryset.aggregate(latest=Max("as_of_date"))["latest"]
    if latest_date is None:
        return queryset
    return queryset.filter(as_of_date__gte=months_before(latest_date, int(period) - 1))


class DashboardView(APIView):
    permission_classes = [AuthenticatedAccess]

    def get(self, request):
        community_id = request.query_params.get("community")
        thematic_area_code = request.query_params.get("thematic_area", "")
        period = request.query_params.get("period", "all")
        community_queryset = scope_queryset_for_user(
            Community.objects.filter(is_deleted=False),
            request.user,
        )
        group_queryset = scope_queryset_for_user(
            Group.objects.filter(is_deleted=False),
            request.user,
        )
        member_queryset = scope_queryset_for_user(
            Member.objects.filter(is_deleted=False),
            request.user,
        )
        resource_queryset = scope_queryset_for_user(
            Resource.objects.filter(is_deleted=False),
            request.user,
        )
        impact_queryset = scope_queryset_for_user(
            ImpactRecord.objects.filter(is_deleted=False),
            request.user,
        )
        approval_queryset = visible_approval_requests(request.user)

        if community_id:
            community_queryset = community_queryset.filter(pk=community_id)
            group_queryset = group_queryset.filter(community_id=community_id)
            member_queryset = member_queryset.filter(community_id=community_id)
            resource_queryset = resource_queryset.filter(community_id=community_id)
            impact_queryset = impact_queryset.filter(resource__community_id=community_id)
            approval_queryset = approval_queryset.filter(community_id=community_id)

        base_resource_queryset = resource_queryset
        if thematic_area_code:
            resource_queryset = resource_queryset.filter(
                thematic_links__thematic_area__code=thematic_area_code,
            )
            impact_queryset = impact_queryset.filter(resource__in=resource_queryset)

        impact_queryset = filter_impact_period(impact_queryset, period)
        impact_totals = impact_queryset.aggregate(
            beneficiary_count=Sum("beneficiary_count"),
            household_count=Sum("household_count"),
        )
        resource_status = list(
            resource_queryset
            .values("status")
            .annotate(count=Count("id"))
            .order_by("status")
        )
        programme_lenses = []
        for area in ThematicArea.objects.filter(is_deleted=False).order_by("name"):
            area_resources = base_resource_queryset.filter(thematic_links__thematic_area=area)
            area_impacts = impact_queryset.filter(resource__in=area_resources)
            programme_lenses.append(
                {
                    "code": area.code,
                    "name": area.name,
                    "resource_count": area_resources.count(),
                    "beneficiary_count": area_impacts.aggregate(
                        beneficiary_count=Sum("beneficiary_count"),
                    )["beneficiary_count"]
                    or 0,
                }
            )
        impact_trend = list(
            impact_queryset.exclude(as_of_date__isnull=True)
            .values("as_of_date")
            .annotate(beneficiary_count=Sum("beneficiary_count"))
            .order_by("as_of_date")
        )
        attention = [
            {
                "label": resource.name,
                "detail": f"Resource is {resource.status}.",
                "path": "/resources",
                "type": "resource",
            }
            for resource in resource_queryset.exclude(status=ResourceStatus.ACTIVE)
            .order_by("community__name", "name")[:3]
        ]
        pending_approvals = approval_queryset.filter(status=ApprovalStatus.PENDING).count()
        if pending_approvals:
            attention.append(
                {
                    "label": f"{pending_approvals} approval{'s' if pending_approvals != 1 else ''} awaiting review",
                    "detail": "Review proposed changes before they are applied.",
                    "path": "/approvals",
                    "type": "approval",
                }
            )

        return Response(
            {
                "data": {
                    "metrics": {
                        "community_count": community_queryset.count(),
                        "group_count": group_queryset.count(),
                        "active_member_count": member_queryset.filter(
                            status=MemberStatus.ACTIVE,
                        ).count(),
                        "institution_count": scope_queryset_for_user(
                            Institution.objects.filter(is_deleted=False),
                            request.user,
                        ).filter(
                            **({"community_id": community_id} if community_id else {}),
                        ).count(),
                        "resource_count": resource_queryset.count(),
                        "pending_approval_count": pending_approvals,
                        "beneficiary_count": impact_totals["beneficiary_count"] or 0,
                        "household_count": impact_totals["household_count"] or 0,
                    },
                    "resource_status": resource_status,
                    "programme_lenses": programme_lenses,
                    "selected_thematic_area": thematic_area_code,
                    "selected_period": period,
                    "impact_trend": impact_trend,
                    "attention": attention,
                    "recent_activity": recent_activity(
                        request.user,
                        community_id=community_id,
                        resource_queryset=resource_queryset if thematic_area_code else None,
                    ),
                },
                "meta": {},
                "errors": [],
            }
        )
