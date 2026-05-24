from django.db.models import Count, Q
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.common.viewsets import AuditFieldsMixin, SimpleFilterMixin, SoftDeleteMixin
from apps.groups.serializers import GroupSerializer
from apps.institutions.serializers import InstitutionSerializer

from .models import Community
from .serializers import CommunitySerializer


class CommunityViewSet(
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    queryset = (
        Community.objects.annotate(
            member_count=Count(
                "members",
                filter=Q(members__is_deleted=False),
                distinct=True,
            ),
            group_count=Count(
                "groups",
                filter=Q(groups__is_deleted=False),
                distinct=True,
            ),
            committee_count=Count(
                "committees",
                filter=Q(committees__is_deleted=False),
                distinct=True,
            ),
            cooperative_count=Count(
                "cooperatives",
                filter=Q(cooperatives__is_deleted=False),
                distinct=True,
            ),
            resource_count=Count(
                "resources",
                filter=Q(resources__is_deleted=False),
                distinct=True,
            ),
            institution_count=Count(
                "institutions",
                filter=Q(institutions__is_deleted=False),
                distinct=True,
            ),
        )
        .order_by("name", "id")
    )
    serializer_class = CommunitySerializer
    filter_fields = ("status", "country", "region_name", "district_name")
    search_fields = ("name", "area_name", "district_name", "region_name")
    ordering_fields = (
        "name",
        "country",
        "member_count",
        "group_count",
        "committee_count",
        "cooperative_count",
        "resource_count",
        "created_at",
        "updated_at",
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        member_search = self.request.query_params.get("member_search")
        if member_search:
            queryset = queryset.filter(
                Q(members__first_name__icontains=member_search)
                | Q(members__last_name__icontains=member_search)
                | Q(members__preferred_name__icontains=member_search)
                | Q(members__member_number__icontains=member_search),
                members__is_deleted=False,
            ).distinct()
            if not self.request.query_params.get("ordering"):
                queryset = queryset.order_by("name", "id")
        return queryset

    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        community = self.get_object()
        groups = community.groups.filter(is_deleted=False)
        members = community.members.filter(is_deleted=False)
        institutions = community.institutions.filter(is_deleted=False)
        return Response(
            {
                "id": community.id,
                "name": community.name,
                "member_count": members.count(),
                "group_count": groups.count(),
                "committee_count": community.committees.filter(is_deleted=False).count(),
                "cooperative_count": community.cooperatives.filter(is_deleted=False).count(),
                "resource_count": community.resources.filter(is_deleted=False).count(),
                "institution_count": institutions.count(),
            }
        )

    @action(detail=True, methods=["get"])
    def groups(self, request, pk=None):
        community = self.get_object()
        serializer = GroupSerializer(
            community.groups.filter(is_deleted=False),
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def institutions(self, request, pk=None):
        community = self.get_object()
        serializer = InstitutionSerializer(
            community.institutions.filter(is_deleted=False),
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(serializer.data)
