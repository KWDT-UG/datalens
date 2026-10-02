from django.db.models import Count, Q
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.common.viewsets import (
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SimpleFilterMixin,
    SoftDeleteMixin,
)
from apps.members.serializers import MemberSerializer

from .models import Group, GroupActivity
from .serializers import GroupActivitySerializer, GroupSerializer


class GroupViewSet(
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    queryset = (
        Group.objects.select_related("community")
        .annotate(
            member_count=Count(
                "members",
                filter=Q(members__is_deleted=False),
                distinct=True,
            ),
            female_count=Count(
                "members",
                filter=Q(
                    members__is_deleted=False,
                    members__gender__iexact="female",
                ),
                distinct=True,
            ),
            male_count=Count(
                "members",
                filter=Q(
                    members__is_deleted=False,
                    members__gender__iexact="male",
                ),
                distinct=True,
            ),
        )
        .order_by("community__name", "name", "id")
    )
    serializer_class = GroupSerializer
    filter_fields = ("community", "status", "sub_county")
    search_fields = ("code", "name", "sub_county", "community__name")
    ordering_fields = (
        "code",
        "name",
        "sub_county",
        "formed_on",
        "closed_on",
        "created_at",
    )

    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        group = self.get_object()
        serializer = MemberSerializer(
            group.members.filter(is_deleted=False),
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def activities(self, request, pk=None):
        group = self.get_object()
        queryset = group.activities.filter(is_deleted=False).select_related(
            "community", "group", "committee"
        )
        serializer = GroupActivitySerializer(
            queryset,
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(serializer.data)


class GroupActivityViewSet(
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    queryset = GroupActivity.objects.select_related(
        "community", "group", "committee"
    ).all()
    serializer_class = GroupActivitySerializer
    filter_fields = ("community", "group", "committee", "activity_type", "status")
    search_fields = (
        "title",
        "location_text",
        "facilitator_name",
        "training_topic",
        "agenda",
        "group__name",
        "committee__name",
    )
    ordering_fields = ("starts_at", "ends_at", "title", "status", "created_at")
