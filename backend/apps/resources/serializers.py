from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from apps.common.serializers import ApprovalStateSerializerMixin
from apps.common.models import PaymentEntryType, ResourcePartyType
from apps.common.permissions import (
    VIEW_PERSONAL_DATA,
    VIEW_RESOURCE_FINANCIALS,
    user_has_capability,
)

from .models import (
    Resource,
    ResourceBeneficiary,
    ResourceStatusEvent,
    ResourceThematicArea,
    ResourcePaymentObligation,
    ResourcePaymentTransaction,
    ThematicArea,
    resolve_resource_party,
)


def party_display(context, party_type, party_id):
    party = resolve_resource_party(party_type, party_id)
    if party is None:
        return None
    request = context.get("request")
    if (
        party_type == ResourcePartyType.MEMBER
        and request is not None
        and not user_has_capability(request.user, VIEW_PERSONAL_DATA)
    ):
        return "Member beneficiary"
    return str(party)


class ThematicAreaSerializer(ApprovalStateSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = ThematicArea
        fields = [
            "id",
            "code",
            "name",
            "description",
            "status",
            "approval_status",
            "pending_approval_request_id",
            "approval_history_count",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "client_created_at",
            "client_updated_at",
            "client_mutation_id",
            "sync_version",
            "is_deleted",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "sync_version",
            "is_deleted",
        ]


class ResourceThematicAreaReadSerializer(serializers.ModelSerializer):
    thematic_area_id = serializers.IntegerField(
        source="thematic_area.id", read_only=True
    )
    code = serializers.CharField(source="thematic_area.code", read_only=True)
    name = serializers.CharField(source="thematic_area.name", read_only=True)

    class Meta:
        model = ResourceThematicArea
        fields = ["id", "thematic_area_id", "code", "name", "is_primary"]


class ResourceThematicAreaSerializer(
    ApprovalStateSerializerMixin,
    serializers.ModelSerializer,
):
    code = serializers.CharField(source="thematic_area.code", read_only=True)
    name = serializers.CharField(source="thematic_area.name", read_only=True)

    class Meta:
        model = ResourceThematicArea
        validators = []
        fields = [
            "id",
            "resource",
            "thematic_area",
            "code",
            "name",
            "is_primary",
            "approval_status",
            "pending_approval_request_id",
            "approval_history_count",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "client_created_at",
            "client_updated_at",
            "client_mutation_id",
            "sync_version",
            "is_deleted",
        ]
        read_only_fields = [
            "id",
            "code",
            "name",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "sync_version",
            "is_deleted",
        ]

    def validate(self, attrs):
        resource = attrs.get(
            "resource", self.instance.resource if self.instance else None
        )
        thematic_area = attrs.get(
            "thematic_area",
            self.instance.thematic_area if self.instance else None,
        )
        if resource is not None and thematic_area is not None:
            queryset = ResourceThematicArea.objects.filter(
                resource=resource,
                thematic_area=thematic_area,
            )
            if self.instance is not None:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "thematic_area": (
                            "This thematic area is already linked to the resource."
                        )
                    }
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        instance = super().create(validated_data)
        self._ensure_single_primary(instance)
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self._ensure_single_primary(instance)
        return instance

    def _ensure_single_primary(self, instance):
        if instance.is_primary:
            ResourceThematicArea.objects.filter(resource=instance.resource).exclude(
                pk=instance.pk
            ).update(is_primary=False)


class ResourceSerializer(ApprovalStateSerializerMixin, serializers.ModelSerializer):
    community_name = serializers.CharField(source="community.name", read_only=True)
    owner_display = serializers.SerializerMethodField()
    beneficiary_summary = serializers.SerializerMethodField()
    payment_summary = serializers.SerializerMethodField()
    thematic_areas = ResourceThematicAreaReadSerializer(
        source="thematic_links",
        many=True,
        read_only=True,
    )
    thematic_area_ids = serializers.PrimaryKeyRelatedField(
        queryset=ThematicArea.objects.filter(is_deleted=False),
        many=True,
        write_only=True,
        required=False,
    )
    primary_thematic_area_id = serializers.PrimaryKeyRelatedField(
        queryset=ThematicArea.objects.filter(is_deleted=False),
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Resource
        fields = [
            "id",
            "community",
            "community_name",
            "owner_type",
            "owner_id",
            "owner_display",
            "resource_type",
            "name",
            "description",
            "quantity",
            "unit",
            "value_amount",
            "value_currency",
            "acquired_on",
            "status",
            "location_text",
            "serial_or_tag_number",
            "source_notes",
            "thematic_areas",
            "beneficiary_summary",
            "payment_summary",
            "thematic_area_ids",
            "primary_thematic_area_id",
            "approval_status",
            "pending_approval_request_id",
            "approval_history_count",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "client_created_at",
            "client_updated_at",
            "client_mutation_id",
            "sync_version",
            "is_deleted",
        ]

        read_only_fields = [
            "id",
            "owner_display",
            "beneficiary_summary",
            "payment_summary",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "sync_version",
            "is_deleted",
        ]

    def get_owner_display(self, obj):
        return party_display(self.context, obj.owner_type, obj.owner_id)

    def get_beneficiary_summary(self, obj):
        beneficiaries = obj.beneficiaries.filter(is_deleted=False)
        return {
            "count": beneficiaries.count(),
            "items": ResourceBeneficiarySerializer(
                beneficiaries[:3],
                many=True,
                context=self.context,
            ).data,
        }

    def get_payment_summary(self, obj):
        request = self.context.get("request")
        if request is not None and not user_has_capability(
            request.user,
            VIEW_RESOURCE_FINANCIALS,
        ):
            return None
        obligations = list(obj.payment_obligations.filter(is_deleted=False))
        if not obligations:
            return None
        summaries = [obligation.financial_summary() for obligation in obligations]
        currencies = {summary["currency"] for summary in summaries}
        currency = currencies.pop() if len(currencies) == 1 else None
        principal = sum(
            (summary["principal_amount"] for summary in summaries),
            Decimal("0"),
        )
        charges = sum(
            (summary["additional_charges"] for summary in summaries),
            Decimal("0"),
        )
        paid = sum((summary["total_paid"] for summary in summaries), Decimal("0"))
        credited = sum(
            (summary["total_credited"] for summary in summaries),
            Decimal("0"),
        )
        remaining = sum(
            (summary["remaining_amount"] for summary in summaries),
            Decimal("0"),
        )
        amount_due = principal + charges
        states = {summary["repayment_state"] for summary in summaries}
        state = (
            "overdue"
            if "overdue" in states
            else "paid"
            if remaining == 0
            else "on_track"
            if paid > 0
            else "not_started"
        )
        next_due_dates = [
            summary["next_due_on"]
            for summary in summaries
            if summary["next_due_on"] is not None
        ]
        return {
            "obligation_count": len(summaries),
            "principal_amount": principal,
            "additional_charges": charges,
            "total_paid": paid,
            "total_credited": credited,
            "remaining_amount": remaining,
            "percent_paid": (
                min(Decimal("100"), paid / amount_due * 100).quantize(
                    Decimal("0.01")
                )
                if amount_due > 0
                else Decimal("0")
            ),
            "repayment_state": state,
            "next_due_on": min(next_due_dates) if next_due_dates else None,
            "currency": currency,
        }

    def validate(self, attrs):
        data = {}
        if self.instance is not None:
            data.update(
                {
                    field.name: getattr(self.instance, field.name)
                    for field in self.instance._meta.fields
                }
            )
        data.update(
            {
                key: value
                for key, value in attrs.items()
                if key not in {"thematic_area_ids", "primary_thematic_area_id"}
            }
        )
        instance = Resource(**data)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc

        thematic_areas = attrs.get("thematic_area_ids")
        primary_area = attrs.get("primary_thematic_area_id")
        if thematic_areas is not None:
            thematic_area_ids = {area.id for area in thematic_areas}
            if primary_area is not None and primary_area.id not in thematic_area_ids:
                raise serializers.ValidationError(
                    {
                        "primary_thematic_area_id": (
                            "Primary thematic area must be included in "
                            "thematic_area_ids."
                        )
                    }
                )
        elif primary_area is not None:
            if self.instance is None:
                raise serializers.ValidationError(
                    {
                        "primary_thematic_area_id": (
                            "thematic_area_ids are required when creating a "
                            "primary thematic area."
                        )
                    }
                )
            current_ids = set(
                self.instance.thematic_links.filter(is_deleted=False).values_list(
                    "thematic_area_id",
                    flat=True,
                )
            )
            if primary_area.id not in current_ids:
                raise serializers.ValidationError(
                    {
                        "primary_thematic_area_id": (
                            "Primary thematic area must already be linked to "
                            "the resource."
                        )
                    }
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        thematic_areas = validated_data.pop("thematic_area_ids", None)
        primary_area = validated_data.pop("primary_thematic_area_id", None)
        instance = super().create(validated_data)
        if thematic_areas is not None or primary_area is not None:
            self._sync_thematic_areas(instance, thematic_areas, primary_area)
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        thematic_areas = validated_data.pop("thematic_area_ids", None)
        primary_area = validated_data.pop("primary_thematic_area_id", serializers.empty)
        instance = super().update(instance, validated_data)
        if thematic_areas is not None or primary_area is not serializers.empty:
            actual_primary = None if primary_area is serializers.empty else primary_area
            self._sync_thematic_areas(instance, thematic_areas, actual_primary)
        return instance

    def _sync_thematic_areas(self, instance, thematic_areas, primary_area):
        if thematic_areas is None:
            thematic_areas = [
                link.thematic_area
                for link in instance.thematic_links.filter(
                    is_deleted=False
                ).select_related("thematic_area")
            ]

        instance.thematic_links.all().delete()
        for thematic_area in thematic_areas:
            ResourceThematicArea.objects.create(
                resource=instance,
                thematic_area=thematic_area,
                is_primary=primary_area is not None
                and thematic_area.id == primary_area.id,
            )


class ResourceBeneficiarySerializer(
    ApprovalStateSerializerMixin,
    serializers.ModelSerializer,
):
    beneficiary_display = serializers.SerializerMethodField()

    class Meta:
        model = ResourceBeneficiary
        fields = [
            "id",
            "resource",
            "beneficiary_type",
            "beneficiary_id",
            "beneficiary_display",
            "relationship_type",
            "benefit_scope",
            "notes",
            "approval_status",
            "pending_approval_request_id",
            "approval_history_count",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "client_created_at",
            "client_updated_at",
            "client_mutation_id",
            "sync_version",
            "is_deleted",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "sync_version",
            "is_deleted",
        ]

    def validate(self, attrs):
        data = {}
        if self.instance is not None:
            data.update(
                {
                    field.name: getattr(self.instance, field.name)
                    for field in self.instance._meta.fields
                }
            )
        data.update(attrs)
        instance = ResourceBeneficiary(**data)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        queryset = ResourceBeneficiary.objects.filter(
            resource=instance.resource,
            beneficiary_type=instance.beneficiary_type,
            beneficiary_id=instance.beneficiary_id,
            is_deleted=False,
        )
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                {"beneficiary_id": "This beneficiary is already active for the resource."}
            )
        return attrs

    def get_beneficiary_display(self, obj):
        display = party_display(self.context, obj.beneficiary_type, obj.beneficiary_id)
        if display and obj.benefit_scope == "household":
            return f"Household represented by {display}"
        return display


class ResourceStatusEventSerializer(
    ApprovalStateSerializerMixin,
    serializers.ModelSerializer,
):
    class Meta:
        model = ResourceStatusEvent
        fields = [
            "id",
            "resource",
            "event_type",
            "effective_at",
            "notes",
            "recorded_by_user_id",
            "approval_status",
            "pending_approval_request_id",
            "approval_history_count",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "client_created_at",
            "client_updated_at",
            "client_mutation_id",
            "sync_version",
            "is_deleted",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "sync_version",
            "is_deleted",
            "recorded_by_user_id",
        ]


class ResourcePaymentObligationSerializer(
    ApprovalStateSerializerMixin,
    serializers.ModelSerializer,
):
    responsible_party_display = serializers.SerializerMethodField()
    financial_summary = serializers.SerializerMethodField()

    class Meta:
        model = ResourcePaymentObligation
        fields = [
            "id",
            "resource",
            "resource_beneficiary",
            "responsible_party_type",
            "responsible_party_id",
            "responsible_party_display",
            "obligation_type",
            "principal_amount",
            "currency",
            "deposit_required_amount",
            "payment_frequency",
            "installment_amount",
            "starts_on",
            "due_on",
            "status",
            "terms_notes",
            "financial_summary",
            "approval_status",
            "pending_approval_request_id",
            "approval_history_count",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "client_created_at",
            "client_updated_at",
            "client_mutation_id",
            "sync_version",
            "is_deleted",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "sync_version",
            "is_deleted",
        ]

    def get_responsible_party_display(self, obj):
        return party_display(
            self.context,
            obj.responsible_party_type,
            obj.responsible_party_id,
        )

    def get_financial_summary(self, obj):
        request = self.context.get("request")
        if request is not None and not user_has_capability(
            request.user,
            VIEW_RESOURCE_FINANCIALS,
        ):
            return None
        return obj.financial_summary()

    def validate(self, attrs):
        data = {}
        if self.instance is not None:
            data.update(
                {
                    field.name: getattr(self.instance, field.name)
                    for field in self.instance._meta.fields
                }
            )
        data.update(attrs)
        instance = ResourcePaymentObligation(**data)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        if "currency" in attrs:
            attrs["currency"] = instance.currency

        open_statuses = {"draft", "active", "suspended"}
        if instance.status in open_statuses:
            duplicate = ResourcePaymentObligation.objects.filter(
                resource_beneficiary=instance.resource_beneficiary,
                obligation_type=instance.obligation_type,
                status__in=open_statuses,
                is_deleted=False,
            )
            if self.instance is not None:
                duplicate = duplicate.exclude(pk=self.instance.pk)
            if duplicate.exists():
                raise serializers.ValidationError(
                    {
                        "resource_beneficiary": (
                            "This beneficiary already has an open obligation "
                            "of the selected type."
                        )
                    }
                )

        if self.instance is not None and self.instance.transactions.filter(
            is_deleted=False,
            entry_type__in=[PaymentEntryType.DEPOSIT, PaymentEntryType.INSTALLMENT],
        ).exists():
            immutable_terms = {
                "resource",
                "resource_beneficiary",
                "responsible_party_type",
                "responsible_party_id",
                "obligation_type",
                "principal_amount",
                "currency",
                "deposit_required_amount",
                "payment_frequency",
                "installment_amount",
                "starts_on",
                "due_on",
            }
            changed = [
                field
                for field in {"resource", "resource_beneficiary"}.intersection(attrs)
                if getattr(self.instance, f"{field}_id") != attrs[field].pk
            ]
            changed.extend(
                field
                for field in immutable_terms.intersection(attrs)
                if field not in {"resource", "resource_beneficiary"}
                and getattr(self.instance, field) != attrs[field]
            )
            if changed:
                raise serializers.ValidationError(
                    {field: "Financial terms cannot change after the first approved payment." for field in changed}
                )
        return attrs


class ResourcePaymentTransactionSerializer(
    ApprovalStateSerializerMixin,
    serializers.ModelSerializer,
):
    class Meta:
        model = ResourcePaymentTransaction
        validators = []
        fields = [
            "id",
            "obligation",
            "entry_type",
            "amount",
            "effective_on",
            "reference",
            "voucher_number",
            "notes",
            "received_from_type",
            "received_from_id",
            "reverses",
            "recorded_by_user_id",
            "approval_status",
            "pending_approval_request_id",
            "approval_history_count",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "client_created_at",
            "client_updated_at",
            "client_mutation_id",
            "sync_version",
            "is_deleted",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "recorded_by_user_id",
            "sync_version",
            "is_deleted",
        ]

    def validate(self, attrs):
        if self.instance is not None:
            raise serializers.ValidationError(
                {"detail": "Payment transactions are append-only; create a reversal."}
            )
        instance = ResourcePaymentTransaction(**attrs)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        credit_types = {
            PaymentEntryType.DEPOSIT,
            PaymentEntryType.INSTALLMENT,
            PaymentEntryType.WAIVER,
            PaymentEntryType.ADJUSTMENT_CREDIT,
        }
        if instance.entry_type in credit_types:
            remaining = instance.obligation.financial_summary()["remaining_amount"]
            if instance.amount > remaining:
                raise serializers.ValidationError(
                    {"amount": "Payment or credit cannot exceed the confirmed amount due."}
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        obligation = ResourcePaymentObligation.objects.select_for_update().get(
            pk=validated_data["obligation"].pk
        )
        validated_data["obligation"] = obligation
        # Re-run validation while holding the obligation lock so concurrent
        # approved payments cannot overpay the balance.
        self.validate(validated_data)
        return super().create(validated_data)
