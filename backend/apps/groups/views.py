from django.db.models import Count, Prefetch, Q
from rest_framework.exceptions import ValidationError
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

from .models import (
    ActivityParty,
    ActivityPartyRole,
    ActivityPartyType,
    Group,
    GroupActivity,
)
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
        "status",
        "member_count",
        "female_count",
        "male_count",
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
        queryset = (
            GroupActivity.objects.filter(is_deleted=False)
            .filter(
                Q(group=group)
                | Q(
                    parties__party_type="group",
                    parties__party_id=group.pk,
                    parties__is_deleted=False,
                )
            )
            .select_related("community", "group", "committee")
            .prefetch_related(
                Prefetch(
                    "parties",
                    queryset=ActivityParty.objects.filter(is_deleted=False),
                    to_attr="active_parties",
                )
            )
            .distinct()
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
    ).prefetch_related(
        Prefetch(
            "parties",
            queryset=ActivityParty.objects.filter(is_deleted=False),
            to_attr="active_parties",
        )
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

    def get_queryset(self):
        queryset = super().get_queryset()
        party_type = self.request.query_params.get("party_type")
        party_id = self.request.query_params.get("party_id")
        party_role = self.request.query_params.get("party_role")
        if bool(party_type) != bool(party_id):
            raise ValidationError(
                {"party_type": "party_type and party_id must be provided together."}
            )
        filters = {"parties__is_deleted": False}
        if party_type:
            if party_type not in ActivityPartyType.values:
                raise ValidationError({"party_type": "Unsupported activity party type."})
            try:
                filters["parties__party_id"] = int(party_id)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"party_id": "party_id must be an integer."}) from exc
            filters["parties__party_type"] = party_type
        if party_role:
            if party_role not in ActivityPartyRole.values:
                raise ValidationError({"party_role": "Unsupported activity party role."})
            filters["parties__role"] = party_role
        if party_type or party_role:
            queryset = queryset.filter(**filters)
        return queryset.distinct()
