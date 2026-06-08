from django.db.models import Count, Sum
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.approvals.models import ApprovalRequest
from apps.common.models import ApprovalStatus, MemberStatus
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
from apps.resources.models import Resource
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


def recent_activity(user):
    records = []
    sources = [
        (
            "community",
            scope_queryset_for_user(
                Community.objects.filter(is_deleted=False),
                user,
            ).order_by("-updated_at")[:5],
            lambda item: item.name,
            lambda item: item.id,
            lambda item: item.name,
            lambda item: f"/communities/{item.id}/groups",
        ),
        (
            "group",
            scope_queryset_for_user(Group.objects.filter(is_deleted=False), user)
            .select_related("community")
            .order_by("-updated_at")[:5],
            lambda item: item.name,
            lambda item: item.community_id,
            lambda item: item.community.name,
            lambda item: f"/communities/{item.community_id}/groups",
        ),
        (
            "resource",
            scope_queryset_for_user(Resource.objects.filter(is_deleted=False), user)
            .select_related("community")
            .order_by("-updated_at")[:5],
            lambda item: item.name,
            lambda item: item.community_id,
            lambda item: item.community.name,
            lambda item: "/resources",
        ),
        (
            "impact_record",
            scope_queryset_for_user(
                ImpactRecord.objects.filter(is_deleted=False),
                user,
            )
            .select_related("resource__community")
            .order_by("-updated_at")[:5],
            lambda item: f"Impact for {item.resource.name}",
            lambda item: item.resource.community_id,
            lambda item: item.resource.community.name,
            lambda item: "/impact",
        ),
    ]

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


class DashboardView(APIView):
    permission_classes = [AuthenticatedAccess]

    def get(self, request):
        impact_queryset = scope_queryset_for_user(
            ImpactRecord.objects.filter(is_deleted=False),
            request.user,
        )
        resource_queryset = scope_queryset_for_user(
            Resource.objects.filter(is_deleted=False),
            request.user,
        )
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

        return Response(
            {
                "data": {
                    "metrics": {
                        "community_count": scope_queryset_for_user(
                            Community.objects.filter(is_deleted=False),
                            request.user,
                        ).count(),
                        "group_count": scope_queryset_for_user(
                            Group.objects.filter(is_deleted=False),
                            request.user,
                        ).count(),
                        "active_member_count": scope_queryset_for_user(
                            Member.objects.filter(
                                is_deleted=False,
                                status=MemberStatus.ACTIVE,
                            ),
                            request.user,
                        ).count(),
                        "institution_count": scope_queryset_for_user(
                            Institution.objects.filter(is_deleted=False),
                            request.user,
                        ).count(),
                        "resource_count": resource_queryset.count(),
                        "pending_approval_count": visible_approval_requests(
                            request.user
                        )
                        .filter(status=ApprovalStatus.PENDING)
                        .count(),
                        "beneficiary_count": impact_totals["beneficiary_count"] or 0,
                        "household_count": impact_totals["household_count"] or 0,
                    },
                    "resource_status": resource_status,
                    "recent_activity": recent_activity(request.user),
                },
                "meta": {},
                "errors": [],
            }
        )
