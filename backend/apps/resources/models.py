from django.core.exceptions import ValidationError
from datetime import date
from decimal import Decimal

from django.db import models
from django.db.models import Q

from apps.common.models import (
    BeneficiaryRelationshipType,
    BeneficiaryScope,
    CoreModel,
    PaymentEntryType,
    PaymentFrequency,
    PaymentObligationStatus,
    PaymentObligationType,
    RecordStatus,
    ResourceEventType,
    ResourcePartyType,
    ResourceStatus,
    ResourceType,
)
from apps.communities.models import Community


def resolve_resource_party(party_type: str, party_id: int | None):
    if not party_id:
        return None

    if party_type == ResourcePartyType.COMMUNITY:
        model = Community
    elif party_type == ResourcePartyType.GROUP:
        from apps.groups.models import Group

        model = Group
    elif party_type == ResourcePartyType.COOPERATIVE:
        from apps.participation.models import Cooperative

        model = Cooperative
    elif party_type == ResourcePartyType.MEMBER:
        from apps.members.models import Member

        model = Member
    elif party_type == ResourcePartyType.INSTITUTION:
        from apps.institutions.models import Institution

        model = Institution
    else:
        return None

    try:
        return model.objects.get(pk=party_id)
    except model.DoesNotExist:
        return None


def resource_party_community_id(party_type: str, party) -> int | None:
    if party is None:
        return None
    if party_type == ResourcePartyType.COMMUNITY:
        return party.pk
    return getattr(party, "community_id", None)


class ThematicArea(CoreModel):
    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=32,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVE,
    )

    class Meta:
        ordering = ["name", "code"]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class Resource(CoreModel):
    community = models.ForeignKey(
        Community,
        on_delete=models.PROTECT,
        related_name="resources",
    )
    owner_type = models.CharField(max_length=32, choices=ResourcePartyType.choices)
    owner_id = models.PositiveBigIntegerField()
    resource_type = models.CharField(
        max_length=64,
        choices=ResourceType.choices,
        default=ResourceType.OTHER,
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    quantity = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    unit = models.CharField(max_length=64, blank=True)
    value_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    value_currency = models.CharField(max_length=3, default="UGX")
    acquired_on = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=32,
        choices=ResourceStatus.choices,
        default=ResourceStatus.PLANNED,
    )
    location_text = models.TextField(blank=True)
    serial_or_tag_number = models.CharField(max_length=128, blank=True)
    source_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["community__name", "name"]

    def clean(self) -> None:
        super().clean()
        errors = {}
        owner = resolve_resource_party(self.owner_type, self.owner_id)
        if owner is None:
            errors["owner_id"] = "Owner could not be found for the selected owner type."
        else:
            owner_community_id = resource_party_community_id(self.owner_type, owner)
            if owner_community_id != self.community_id:
                errors["owner_id"] = "Resource owner must belong to the same community."
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"{self.name} ({self.community.name})"


class ResourceBeneficiary(CoreModel):
    resource = models.ForeignKey(
        Resource,
        on_delete=models.PROTECT,
        related_name="beneficiaries",
    )
    beneficiary_type = models.CharField(
        max_length=32,
        choices=ResourcePartyType.choices,
    )
    beneficiary_id = models.PositiveBigIntegerField()
    relationship_type = models.CharField(
        max_length=32,
        choices=BeneficiaryRelationshipType.choices,
        default=BeneficiaryRelationshipType.PRIMARY,
    )
    benefit_scope = models.CharField(
        max_length=32,
        choices=BeneficiaryScope.choices,
        default=BeneficiaryScope.COLLECTIVE,
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["resource__name", "relationship_type", "beneficiary_type"]
        constraints = [
            models.UniqueConstraint(
                fields=["resource", "beneficiary_type", "beneficiary_id"],
                condition=Q(is_deleted=False),
                name="unique_active_resource_beneficiary",
            )
        ]

    def clean(self) -> None:
        super().clean()
        errors = {}
        beneficiary = resolve_resource_party(self.beneficiary_type, self.beneficiary_id)
        if beneficiary is None:
            errors["beneficiary_id"] = (
                "Beneficiary could not be found for the selected beneficiary type."
            )
        else:
            beneficiary_community_id = resource_party_community_id(
                self.beneficiary_type,
                beneficiary,
            )
            if beneficiary_community_id != self.resource.community_id:
                errors["beneficiary_id"] = (
                    "Resource beneficiary must belong to the same community."
                )
        member_scopes = {BeneficiaryScope.INDIVIDUAL, BeneficiaryScope.HOUSEHOLD}
        if self.benefit_scope in member_scopes and self.beneficiary_type != ResourcePartyType.MEMBER:
            errors["benefit_scope"] = (
                "Individual and household scope require a member beneficiary."
            )
        if (
            self.benefit_scope == BeneficiaryScope.COLLECTIVE
            and self.beneficiary_type == ResourcePartyType.MEMBER
        ):
            errors["benefit_scope"] = (
                "Member beneficiaries must use individual or household scope."
            )
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"{self.resource} -> {self.beneficiary_type}:{self.beneficiary_id}"


class ResourceThematicArea(CoreModel):
    resource = models.ForeignKey(
        Resource,
        on_delete=models.CASCADE,
        related_name="thematic_links",
    )
    thematic_area = models.ForeignKey(
        ThematicArea,
        on_delete=models.PROTECT,
        related_name="resource_links",
    )
    is_primary = models.BooleanField(default=False)

    class Meta:
        ordering = ["resource__name", "-is_primary", "thematic_area__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["resource", "thematic_area"],
                name="unique_resource_thematic_area",
            )
        ]

    def __str__(self) -> str:
        return f"{self.resource} -> {self.thematic_area}"


class ResourceStatusEvent(CoreModel):
    resource = models.ForeignKey(
        Resource,
        on_delete=models.PROTECT,
        related_name="status_events",
    )
    event_type = models.CharField(
        max_length=64,
        choices=ResourceEventType.choices,
        default=ResourceEventType.CREATED,
    )
    effective_at = models.DateTimeField()
    notes = models.TextField(blank=True)
    recorded_by_user_id = models.PositiveBigIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-effective_at", "-created_at"]

    def __str__(self) -> str:
        return f"{self.resource} [{self.event_type}]"


class ResourcePaymentObligation(CoreModel):
    resource = models.ForeignKey(
        Resource,
        on_delete=models.PROTECT,
        related_name="payment_obligations",
    )
    resource_beneficiary = models.ForeignKey(
        ResourceBeneficiary,
        on_delete=models.PROTECT,
        related_name="payment_obligations",
    )
    responsible_party_type = models.CharField(
        max_length=32,
        choices=ResourcePartyType.choices,
    )
    responsible_party_id = models.PositiveBigIntegerField()
    obligation_type = models.CharField(
        max_length=32,
        choices=PaymentObligationType.choices,
        default=PaymentObligationType.ACQUISITION,
    )
    principal_amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="UGX")
    deposit_required_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    payment_frequency = models.CharField(
        max_length=32,
        choices=PaymentFrequency.choices,
        default=PaymentFrequency.MONTHLY,
    )
    installment_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    starts_on = models.DateField(null=True, blank=True)
    due_on = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=32,
        choices=PaymentObligationStatus.choices,
        default=PaymentObligationStatus.DRAFT,
    )
    terms_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["resource__name", "starts_on", "id"]
        indexes = [
            models.Index(fields=["resource", "status"], name="res_pay_ob_resource_status"),
            models.Index(
                fields=["resource_beneficiary", "status"],
                name="res_pay_ob_benef_status",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["resource_beneficiary", "obligation_type"],
                condition=Q(
                    is_deleted=False,
                    status__in=[
                        PaymentObligationStatus.DRAFT,
                        PaymentObligationStatus.ACTIVE,
                        PaymentObligationStatus.SUSPENDED,
                    ],
                ),
                name="unique_open_beneficiary_obligation_type",
            )
        ]

    def clean(self) -> None:
        super().clean()
        errors = {}
        self.currency = (self.currency or "").strip().upper()
        if self.resource_beneficiary_id and self.resource_id:
            if self.resource_beneficiary.resource_id != self.resource_id:
                errors["resource_beneficiary"] = (
                    "Payment beneficiary must belong to the selected resource."
                )
        responsible_party = resolve_resource_party(
            self.responsible_party_type,
            self.responsible_party_id,
        )
        if responsible_party is None:
            errors["responsible_party_id"] = "Responsible party could not be found."
        elif (
            resource_party_community_id(self.responsible_party_type, responsible_party)
            != self.resource.community_id
        ):
            errors["responsible_party_id"] = (
                "Responsible party must belong to the resource community."
            )
        if self.principal_amount is None or self.principal_amount <= 0:
            errors["principal_amount"] = "Principal amount must be greater than zero."
        if self.deposit_required_amount is not None and (
            self.deposit_required_amount < 0
            or (
                self.principal_amount is not None
                and self.deposit_required_amount > self.principal_amount
            )
        ):
            errors["deposit_required_amount"] = (
                "Deposit must be non-negative and no greater than principal."
            )
        if self.installment_amount is not None and self.installment_amount <= 0:
            errors["installment_amount"] = "Installment amount must be greater than zero."
        if len(self.currency) != 3 or not self.currency.isalpha():
            errors["currency"] = "Currency must be a three-letter ISO code."
        if self.due_on and self.starts_on and self.due_on < self.starts_on:
            errors["due_on"] = "Due date cannot be before the start date."
        if errors:
            raise ValidationError(errors)

    def financial_summary(self, *, as_of=None):
        as_of = as_of or date.today()
        principal = self.principal_amount or Decimal("0")
        total_paid = Decimal("0")
        total_credited = Decimal("0")
        additional_charges = Decimal("0")
        net_effect = Decimal("0")
        transactions = list(self.transactions.filter(is_deleted=False).select_related("reverses"))
        for entry in transactions:
            if entry.entry_type == PaymentEntryType.REVERSAL:
                effect = -self._ledger_effect(entry.reverses)
            elif entry.entry_type in {
                PaymentEntryType.PENALTY,
                PaymentEntryType.FEE,
                PaymentEntryType.REFUND,
                PaymentEntryType.ADJUSTMENT_DEBIT,
            }:
                effect = entry.amount
            else:
                effect = -entry.amount
            net_effect += effect

            if entry.entry_type in {PaymentEntryType.DEPOSIT, PaymentEntryType.INSTALLMENT}:
                total_paid += entry.amount
            elif entry.entry_type == PaymentEntryType.REFUND:
                total_paid -= entry.amount
            elif entry.entry_type in {PaymentEntryType.WAIVER, PaymentEntryType.ADJUSTMENT_CREDIT}:
                total_credited += entry.amount
            elif entry.entry_type in {
                PaymentEntryType.PENALTY,
                PaymentEntryType.FEE,
                PaymentEntryType.ADJUSTMENT_DEBIT,
            }:
                additional_charges += entry.amount
            elif entry.entry_type == PaymentEntryType.REVERSAL and entry.reverses_id:
                reversed_entry = entry.reverses
                if reversed_entry.entry_type in {PaymentEntryType.DEPOSIT, PaymentEntryType.INSTALLMENT}:
                    total_paid -= reversed_entry.amount
                elif reversed_entry.entry_type == PaymentEntryType.REFUND:
                    total_paid += reversed_entry.amount
                elif reversed_entry.entry_type in {PaymentEntryType.WAIVER, PaymentEntryType.ADJUSTMENT_CREDIT}:
                    total_credited -= reversed_entry.amount
                elif reversed_entry.entry_type in {
                    PaymentEntryType.PENALTY,
                    PaymentEntryType.FEE,
                    PaymentEntryType.ADJUSTMENT_DEBIT,
                }:
                    additional_charges -= reversed_entry.amount

        remaining = max(Decimal("0"), principal + net_effect)
        deposit_paid = sum(
            (entry.amount for entry in transactions if entry.entry_type == PaymentEntryType.DEPOSIT),
            Decimal("0"),
        )
        deposit_paid -= sum(
            (
                entry.reverses.amount
                for entry in transactions
                if entry.entry_type == PaymentEntryType.REVERSAL
                and entry.reverses
                and entry.reverses.entry_type == PaymentEntryType.DEPOSIT
            ),
            Decimal("0"),
        )
        repayment_state = (
            "paid"
            if remaining == 0
            else "overdue"
            if self.due_on and self.due_on < as_of
            else "not_started"
            if total_paid <= 0
            else "on_track"
        )
        percent_paid = (
            min(Decimal("100"), max(Decimal("0"), total_paid / principal * 100))
            if principal
            else Decimal("0")
        )
        return {
            "principal_amount": principal,
            "additional_charges": additional_charges,
            "total_paid": total_paid,
            "total_credited": total_credited,
            "remaining_amount": remaining,
            "percent_paid": percent_paid.quantize(Decimal("0.01")),
            "deposit_required_amount": self.deposit_required_amount or Decimal("0"),
            "deposit_paid_amount": deposit_paid,
            "repayment_state": repayment_state,
            "next_due_on": self.due_on,
            "currency": self.currency,
        }

    @staticmethod
    def _ledger_effect(entry):
        if entry.entry_type in {
            PaymentEntryType.PENALTY,
            PaymentEntryType.FEE,
            PaymentEntryType.REFUND,
            PaymentEntryType.ADJUSTMENT_DEBIT,
        }:
            return entry.amount
        return -entry.amount

    def __str__(self):
        return f"{self.resource} obligation #{self.pk or 'new'}"


class ResourcePaymentTransaction(CoreModel):
    obligation = models.ForeignKey(
        ResourcePaymentObligation,
        on_delete=models.PROTECT,
        related_name="transactions",
    )
    entry_type = models.CharField(max_length=32, choices=PaymentEntryType.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    effective_on = models.DateField()
    reference = models.CharField(max_length=160, blank=True)
    voucher_number = models.CharField(max_length=160, blank=True)
    notes = models.TextField(blank=True)
    received_from_type = models.CharField(
        max_length=32,
        choices=ResourcePartyType.choices,
        blank=True,
    )
    received_from_id = models.PositiveBigIntegerField(null=True, blank=True)
    reverses = models.OneToOneField(
        "self",
        on_delete=models.PROTECT,
        related_name="reversal",
        null=True,
        blank=True,
    )
    recorded_by_user_id = models.PositiveBigIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-effective_on", "-created_at", "-id"]
        indexes = [models.Index(fields=["obligation", "effective_on"], name="res_pay_tx_obligation_date")]
        constraints = [
            models.UniqueConstraint(
                fields=["created_by_user_id", "client_mutation_id"],
                condition=~Q(client_mutation_id=""),
                name="unique_financial_client_mutation",
            )
        ]

    def clean(self) -> None:
        super().clean()
        errors = {}
        if self.amount is None or self.amount <= 0:
            errors["amount"] = "Transaction amount must be greater than zero."
        if bool(self.received_from_type) != bool(self.received_from_id):
            errors["received_from_id"] = "Received-from type and id must be supplied together."
        if self.received_from_type and self.received_from_id:
            party = resolve_resource_party(self.received_from_type, self.received_from_id)
            if party is None:
                errors["received_from_id"] = "Received-from party could not be found."
            elif resource_party_community_id(self.received_from_type, party) != self.obligation.resource.community_id:
                errors["received_from_id"] = "Received-from party must belong to the resource community."
        if self.entry_type == PaymentEntryType.REVERSAL:
            if not self.reverses_id:
                errors["reverses"] = "A reversal must reference the original transaction."
            elif self.reverses.entry_type == PaymentEntryType.REVERSAL:
                errors["reverses"] = "A reversal cannot reverse another reversal."
            elif self.reverses.obligation_id != self.obligation_id:
                errors["reverses"] = "Reversal must use the original obligation."
            elif self.amount != self.reverses.amount:
                errors["amount"] = "Only full transaction reversals are allowed."
        elif self.reverses_id:
            errors["reverses"] = "Only reversal entries may reference another transaction."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.obligation} {self.entry_type} {self.amount}"
