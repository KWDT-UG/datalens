from django.db.models import Count, Sum
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.common.viewsets import (
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SimpleFilterMixin,
    SoftDeleteMixin,
)

from .models import ImpactRecord
from .serializers import ImpactRecordSerializer


class ImpactRecordViewSet(
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    queryset = ImpactRecord.objects.select_related("resource__community").all()
    serializer_class = ImpactRecordSerializer
    filter_fields = ("resource", "beneficiary_type", "period_type", "method")
    search_fields = ("resource__name", "notes", "period_type")
    ordering_fields = ("as_of_date", "period_start", "period_end", "created_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        community = self.request.query_params.get("community")
        if community:
            queryset = queryset.filter(resource__community_id=community)
        return queryset

    def perform_create(self, serializer):
        user_id = self.request.user.pk if self.request.user.is_authenticated else None
        serializer.save(
            created_by_user_id=user_id,
            updated_by_user_id=user_id,
            recorded_by_user_id=user_id,
        )

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.filter_report_queryset(self.get_queryset())
        totals = queryset.aggregate(
            record_count=Count("id"),
            beneficiary_count=Sum("beneficiary_count"),
            household_count=Sum("household_count"),
            member_count=Sum("member_count"),
            institution_count=Sum("institution_count"),
        )
        return Response(
            {
                "data": {key: value or 0 for key, value in totals.items()},
                "meta": {"group_by": None},
                "errors": [],
            }
        )

    @action(detail=False, methods=["get"], url_path="by-community")
    def by_community(self, request):
        queryset = self.filter_report_queryset(self.get_queryset())
        rows = (
            queryset.values(
                "resource__community_id",
                "resource__community__name",
            )
            .annotate(
                record_count=Count("id"),
                beneficiary_count=Sum("beneficiary_count"),
                household_count=Sum("household_count"),
                member_count=Sum("member_count"),
                institution_count=Sum("institution_count"),
            )
            .order_by("resource__community__name")
        )
        return Response(
            {
                "data": [
                    {
                        "community": row["resource__community_id"],
                        "community_name": row["resource__community__name"],
                        "record_count": row["record_count"] or 0,
                        "beneficiary_count": row["beneficiary_count"] or 0,
                        "household_count": row["household_count"] or 0,
                        "member_count": row["member_count"] or 0,
                        "institution_count": row["institution_count"] or 0,
                    }
                    for row in rows
                ],
                "meta": {"group_by": "community"},
                "errors": [],
            }
        )

    @action(detail=False, methods=["get"], url_path="by-resource")
    def by_resource(self, request):
        queryset = self.filter_report_queryset(self.get_queryset())
        rows = (
            queryset.values("resource_id", "resource__name")
            .annotate(
                record_count=Count("id"),
                beneficiary_count=Sum("beneficiary_count"),
                household_count=Sum("household_count"),
                member_count=Sum("member_count"),
                institution_count=Sum("institution_count"),
            )
            .order_by("resource__name")
        )
        return Response(
            {
                "data": [
                    {
                        "resource": row["resource_id"],
                        "resource_name": row["resource__name"],
                        "record_count": row["record_count"] or 0,
                        "beneficiary_count": row["beneficiary_count"] or 0,
                        "household_count": row["household_count"] or 0,
                        "member_count": row["member_count"] or 0,
                        "institution_count": row["institution_count"] or 0,
                    }
                    for row in rows
                ],
                "meta": {"group_by": "resource"},
                "errors": [],
            }
        )

    def filter_report_queryset(self, queryset):
        period_start = self.request.query_params.get("period_start")
        period_end = self.request.query_params.get("period_end")
        if period_start:
            queryset = queryset.filter(period_start__gte=period_start)
        if period_end:
            queryset = queryset.filter(period_end__lte=period_end)
        return queryset
