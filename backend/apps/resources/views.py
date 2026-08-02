from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from rest_framework import mixins
from rest_framework.exceptions import ValidationError
from rest_framework.viewsets import GenericViewSet, ModelViewSet

from apps.common.models import ApprovalActionType
from apps.common.models import PaymentEntryType
from apps.common.permissions import (
    ResourceFinancialAccess,
    VIEW_RESOURCE_FINANCIALS,
    user_has_capability,
)
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
    ResourcePaymentObligation,
    ResourcePaymentTransaction,
    ThematicArea,
)
from .serializers import (
    ResourceBeneficiarySerializer,
    ResourceSerializer,
    ResourceStatusEventSerializer,
    ResourceThematicAreaSerializer,
    ResourcePaymentObligationSerializer,
    ResourcePaymentTransactionSerializer,
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
        "payment_obligations__transactions",
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
        can_view_financials = user_has_capability(
            request.user,
            VIEW_RESOURCE_FINANCIALS,
        )
        obligations = resource.payment_obligations.filter(is_deleted=False)
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
                "payment_obligations": (
                    ResourcePaymentObligationSerializer(
                        obligations,
                        many=True,
                        context=self.get_serializer_context(),
                    ).data
                    if can_view_financials
                    else []
                ),
                "payment_transactions": (
                    ResourcePaymentTransactionSerializer(
                        ResourcePaymentTransaction.objects.filter(
                            obligation__resource=resource,
                            is_deleted=False,
                        ),
                        many=True,
                        context=self.get_serializer_context(),
                    ).data
                    if can_view_financials
                    else []
                ),
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
        linked_group = self.request.query_params.get("linked_group")
        if linked_group:
            queryset = queryset.filter(
                Q(owner_type="group", owner_id=linked_group)
                | Q(
                    beneficiaries__beneficiary_type="group",
                    beneficiaries__beneficiary_id=linked_group,
                    beneficiaries__is_deleted=False,
                )
                | Q(
                    owner_type="member",
                    owner_id__in=self._group_member_ids(linked_group),
                )
                | Q(
                    beneficiaries__beneficiary_type="member",
                    beneficiaries__beneficiary_id__in=self._group_member_ids(linked_group),
                    beneficiaries__is_deleted=False,
                )
            ).distinct()
        linked_member = self.request.query_params.get("linked_member")
        if linked_member:
            queryset = queryset.filter(
                Q(owner_type="member", owner_id=linked_member)
                | Q(
                    beneficiaries__beneficiary_type="member",
                    beneficiaries__beneficiary_id=linked_member,
                    beneficiaries__is_deleted=False,
                )
            ).distinct()
        return queryset

    @staticmethod
    def _group_member_ids(group_id):
        from apps.members.models import Member

        return Member.objects.filter(group_id=group_id, is_deleted=False).values("id")


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


class ResourcePaymentObligationViewSet(
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    permission_classes = [ResourceFinancialAccess]
    queryset = ResourcePaymentObligation.objects.select_related(
        "resource",
        "resource_beneficiary",
    ).prefetch_related("transactions")
    serializer_class = ResourcePaymentObligationSerializer
    filter_fields = ("resource", "resource_beneficiary", "status", "obligation_type")
    search_fields = ("resource__name", "terms_notes")
    ordering_fields = ("starts_on", "due_on", "created_at")


class ResourcePaymentTransactionViewSet(
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SimpleFilterMixin,
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    permission_classes = [ResourceFinancialAccess]
    queryset = ResourcePaymentTransaction.objects.select_related(
        "obligation__resource",
        "reverses",
    )
    serializer_class = ResourcePaymentTransactionSerializer
    filter_fields = ("obligation", "entry_type", "effective_on")
    search_fields = ("reference", "voucher_number", "notes", "obligation__resource__name")
    ordering_fields = ("effective_on", "created_at")

    def create(self, request, *args, **kwargs):
        if request.data.get("entry_type") == PaymentEntryType.REVERSAL:
            raise ValidationError({"entry_type": "Use the reverse action."})
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        user_id = self.request.user.pk
        serializer.save(
            created_by_user_id=user_id,
            updated_by_user_id=user_id,
            recorded_by_user_id=user_id,
        )

    @action(detail=True, methods=["post"])
    def reverse(self, request, pk=None):
        original = self.get_object()
        if hasattr(original, "reversal") and not original.reversal.is_deleted:
            raise ValidationError({"reverses": "Transaction has already been reversed."})
        payload = {
            "obligation": original.obligation_id,
            "entry_type": PaymentEntryType.REVERSAL,
            "amount": str(original.amount),
            "effective_on": request.data.get("effective_on"),
            "reference": request.data.get("reference", ""),
            "voucher_number": request.data.get("voucher_number", ""),
            "notes": request.data.get("notes", ""),
            "reverses": original.pk,
        }
        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        queued = self._queue_if_required(
            serializer=serializer,
            action_type=ApprovalActionType.CREATE,
            entity_id=0,
            instance=None,
            payload=payload,
        )
        if queued is not None:
            return queued
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


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
