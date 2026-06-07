from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.common.models import ApprovalActionType
from apps.common.viewsets import (
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SimpleFilterMixin,
    SoftDeleteMixin,
)
from apps.impacts.serializers import ImpactRecordSerializer

from .models import (
    Resource,
    ResourceBeneficiary,
    ResourceStatusEvent,
    ResourceThematicArea,
    ThematicArea,
)
from .serializers import (
    ResourceBeneficiarySerializer,
    ResourceSerializer,
    ResourceStatusEventSerializer,
    ResourceThematicAreaSerializer,
    ThematicAreaSerializer,
)


class ThematicAreaViewSet(
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    queryset = ThematicArea.objects.all()
    serializer_class = ThematicAreaSerializer
    filter_fields = ("status",)
    search_fields = ("code", "name", "description")
    ordering_fields = ("code", "name", "created_at")


class ResourceViewSet(
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    queryset = Resource.objects.select_related("community").prefetch_related(
        "beneficiaries",
        "status_events",
        "thematic_links__thematic_area",
    )
    serializer_class = ResourceSerializer
    filter_fields = ("community", "status", "resource_type", "owner_type")
    search_fields = ("name", "description", "serial_or_tag_number", "location_text")
    ordering_fields = ("name", "acquired_on", "created_at")

    @action(detail=True, methods=["get", "post"])
    def beneficiaries(self, request, pk=None):
        resource = self.get_object()
        if request.method.lower() == "get":
            serializer = ResourceBeneficiarySerializer(
                resource.beneficiaries.filter(is_deleted=False),
                many=True,
                context=self.get_serializer_context(),
            )
            return Response(serializer.data)

        serializer = ResourceBeneficiarySerializer(
            data={**request.data, "resource": resource.pk},
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        payload = {**request.data, "resource": resource.pk}
        queued_response = self._queue_if_required(
            serializer=serializer,
            action_type=ApprovalActionType.CREATE,
            entity_id=0,
            instance=None,
            entity_type="resource_beneficiary",
            payload=payload,
        )
        if queued_response is not None:
            return queued_response
        user_id = request.user.pk if request.user.is_authenticated else None
        serializer.save(created_by_user_id=user_id, updated_by_user_id=user_id)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="status-events")
    def status_events(self, request, pk=None):
        resource = self.get_object()
        if request.method.lower() == "get":
            serializer = ResourceStatusEventSerializer(
                resource.status_events.filter(is_deleted=False),
                many=True,
                context=self.get_serializer_context(),
            )
            return Response(serializer.data)

        serializer = ResourceStatusEventSerializer(
            data={**request.data, "resource": resource.pk},
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        payload = {**request.data, "resource": resource.pk}
        queued_response = self._queue_if_required(
            serializer=serializer,
            action_type=ApprovalActionType.CREATE,
            entity_id=0,
            instance=None,
            entity_type="resource_status_event",
            payload=payload,
        )
        if queued_response is not None:
            return queued_response
        user_id = request.user.pk if request.user.is_authenticated else None
        serializer.save(
            created_by_user_id=user_id,
            updated_by_user_id=user_id,
            recorded_by_user_id=user_id,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="detail", url_name="detail-view")
    def detail_view(self, request, pk=None):
        resource = self.get_object()
        return Response(
            {
                "resource": ResourceSerializer(
                    resource,
                    context=self.get_serializer_context(),
                ).data,
                "beneficiaries": ResourceBeneficiarySerializer(
                    resource.beneficiaries.filter(is_deleted=False),
                    many=True,
                    context=self.get_serializer_context(),
                ).data,
                "status_events": ResourceStatusEventSerializer(
                    resource.status_events.filter(is_deleted=False),
                    many=True,
                    context=self.get_serializer_context(),
                ).data,
                "impact_records": ImpactRecordSerializer(
                    resource.impact_records.filter(is_deleted=False),
                    many=True,
                    context=self.get_serializer_context(),
                ).data,
            }
        )

    @action(detail=True, methods=["get", "post"], url_path="impact-records")
    def impact_records(self, request, pk=None):
        resource = self.get_object()
        if request.method.lower() == "get":
            serializer = ImpactRecordSerializer(
                resource.impact_records.filter(is_deleted=False),
                many=True,
                context=self.get_serializer_context(),
            )
            return Response(serializer.data)

        serializer = ImpactRecordSerializer(
            data={**request.data, "resource": resource.pk},
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        payload = {**request.data, "resource": resource.pk}
        queued_response = self._queue_if_required(
            serializer=serializer,
            action_type=ApprovalActionType.CREATE,
            entity_id=0,
            instance=None,
            entity_type="impact_record",
            payload=payload,
        )
        if queued_response is not None:
            return queued_response
        user_id = request.user.pk if request.user.is_authenticated else None
        serializer.save(
            created_by_user_id=user_id,
            updated_by_user_id=user_id,
            recorded_by_user_id=user_id,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        queryset = super().get_queryset()
        thematic_area = self.request.query_params.get("thematic_area")
        if thematic_area:
            queryset = queryset.filter(
                thematic_links__thematic_area_id=thematic_area,
                thematic_links__is_deleted=False,
            ).distinct()
        return queryset


class ResourceBeneficiaryViewSet(
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    queryset = ResourceBeneficiary.objects.select_related("resource").all()
    serializer_class = ResourceBeneficiarySerializer
    filter_fields = ("resource", "beneficiary_type", "relationship_type")
    search_fields = ("resource__name", "notes")
    ordering_fields = ("created_at",)

    def get_queryset(self):
        queryset = super().get_queryset()
        community = self.request.query_params.get("community")
        if community:
            queryset = queryset.filter(resource__community_id=community)
        return queryset


class ResourceThematicAreaViewSet(
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    queryset = ResourceThematicArea.objects.select_related(
        "resource",
        "thematic_area",
    ).all()
    serializer_class = ResourceThematicAreaSerializer
    filter_fields = ("resource", "thematic_area", "is_primary")
    search_fields = ("resource__name", "thematic_area__code", "thematic_area__name")
    ordering_fields = ("created_at", "updated_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        community = self.request.query_params.get("community")
        if community:
            queryset = queryset.filter(resource__community_id=community)
        return queryset
