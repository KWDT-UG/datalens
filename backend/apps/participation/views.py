from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.common.viewsets import AuditFieldsMixin, SimpleFilterMixin, SoftDeleteMixin

from .models import (
    Committee,
    CommitteeMembership,
    Cooperative,
    CooperativeMembership,
)
from .serializers import (
    CommitteeMembershipSerializer,
    CommitteeSerializer,
    CooperativeMembershipSerializer,
    CooperativeSerializer,
)


class CommitteeViewSet(AuditFieldsMixin, SoftDeleteMixin, SimpleFilterMixin, ModelViewSet):
    queryset = Committee.objects.select_related("community").all()
    serializer_class = CommitteeSerializer
    filter_fields = ("community", "status", "committee_type")
    search_fields = ("name", "description", "community__name")
    ordering_fields = ("name", "committee_type", "formed_on", "created_at")

    @action(detail=True, methods=["get"])
    def memberships(self, request, pk=None):
        committee = self.get_object()
        serializer = CommitteeMembershipSerializer(
            committee.memberships.filter(is_deleted=False),
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(serializer.data)


class CommitteeMembershipViewSet(
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    queryset = CommitteeMembership.objects.select_related("committee", "member").all()
    serializer_class = CommitteeMembershipSerializer
    filter_fields = ("committee", "member", "status")
    search_fields = (
        "committee__name",
        "member__first_name",
        "member__last_name",
        "role_name",
    )
    ordering_fields = ("start_date", "end_date", "created_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        community = self.request.query_params.get("community")
        if community:
            queryset = queryset.filter(committee__community_id=community)
        return queryset


class CooperativeViewSet(
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    queryset = Cooperative.objects.select_related("community").all()
    serializer_class = CooperativeSerializer
    filter_fields = ("community", "status", "cooperative_type")
    search_fields = ("name", "description", "community__name")
    ordering_fields = ("name", "cooperative_type", "formed_on", "created_at")

    @action(detail=True, methods=["get"])
    def memberships(self, request, pk=None):
        cooperative = self.get_object()
        serializer = CooperativeMembershipSerializer(
            cooperative.memberships.filter(is_deleted=False),
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(serializer.data)


class CooperativeMembershipViewSet(
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    queryset = CooperativeMembership.objects.select_related(
        "cooperative",
        "member",
    ).all()
    serializer_class = CooperativeMembershipSerializer
    filter_fields = ("cooperative", "member", "status")
    search_fields = (
        "cooperative__name",
        "member__first_name",
        "member__last_name",
        "role_name",
    )
    ordering_fields = ("start_date", "end_date", "created_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        community = self.request.query_params.get("community")
        if community:
            queryset = queryset.filter(cooperative__community_id=community)
        return queryset
