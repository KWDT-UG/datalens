import django.db.models.deletion
from django.db import migrations, models
from django.db.models import Q


def set_beneficiary_scope(apps, schema_editor):
    ResourceBeneficiary = apps.get_model("resources", "ResourceBeneficiary")
    ResourceBeneficiary.objects.filter(beneficiary_type="member").update(
        benefit_scope="individual"
    )


class Migration(migrations.Migration):
    dependencies = [("resources", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="resourcebeneficiary",
            name="benefit_scope",
            field=models.CharField(
                choices=[
                    ("individual", "Individual"),
                    ("household", "Household"),
                    ("collective", "Collective"),
                ],
                default="collective",
                max_length=32,
            ),
        ),
        migrations.RunPython(set_beneficiary_scope, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="resourcebeneficiary",
            constraint=models.UniqueConstraint(
                condition=Q(is_deleted=False),
                fields=("resource", "beneficiary_type", "beneficiary_id"),
                name="unique_active_resource_beneficiary",
            ),
        ),
        migrations.CreateModel(
            name="ResourcePaymentObligation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by_user_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("updated_by_user_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("client_created_at", models.DateTimeField(blank=True, null=True)),
                ("client_updated_at", models.DateTimeField(blank=True, null=True)),
                ("client_mutation_id", models.CharField(blank=True, max_length=128)),
                ("sync_version", models.PositiveIntegerField(default=1)),
                ("is_deleted", models.BooleanField(default=False)),
                ("responsible_party_type", models.CharField(choices=[("community", "Community"), ("group", "Group"), ("cooperative", "Cooperative"), ("member", "Member"), ("institution", "Institution")], max_length=32)),
                ("responsible_party_id", models.PositiveBigIntegerField()),
                ("obligation_type", models.CharField(choices=[("acquisition", "Acquisition"), ("maintenance", "Maintenance"), ("other", "Other")], default="acquisition", max_length=32)),
                ("principal_amount", models.DecimalField(decimal_places=2, max_digits=14)),
                ("currency", models.CharField(default="UGX", max_length=3)),
                ("deposit_required_amount", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("payment_frequency", models.CharField(choices=[("one_time", "One time"), ("weekly", "Weekly"), ("monthly", "Monthly"), ("custom", "Custom")], default="monthly", max_length=32)),
                ("installment_amount", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("starts_on", models.DateField(blank=True, null=True)),
                ("due_on", models.DateField(blank=True, null=True)),
                ("status", models.CharField(choices=[("draft", "Draft"), ("active", "Active"), ("suspended", "Suspended"), ("cancelled", "Cancelled")], default="draft", max_length=32)),
                ("terms_notes", models.TextField(blank=True)),
                ("resource", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="payment_obligations", to="resources.resource")),
                ("resource_beneficiary", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="payment_obligations", to="resources.resourcebeneficiary")),
            ],
            options={"ordering": ["resource__name", "starts_on", "id"]},
        ),
        migrations.CreateModel(
            name="ResourcePaymentTransaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by_user_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("updated_by_user_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("client_created_at", models.DateTimeField(blank=True, null=True)),
                ("client_updated_at", models.DateTimeField(blank=True, null=True)),
                ("client_mutation_id", models.CharField(blank=True, max_length=128)),
                ("sync_version", models.PositiveIntegerField(default=1)),
                ("is_deleted", models.BooleanField(default=False)),
                ("entry_type", models.CharField(choices=[("deposit", "Deposit"), ("installment", "Installment"), ("penalty", "Penalty"), ("fee", "Fee"), ("waiver", "Waiver"), ("refund", "Refund"), ("adjustment_debit", "Debit adjustment"), ("adjustment_credit", "Credit adjustment"), ("reversal", "Reversal")], max_length=32)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=14)),
                ("effective_on", models.DateField()),
                ("reference", models.CharField(blank=True, max_length=160)),
                ("voucher_number", models.CharField(blank=True, max_length=160)),
                ("notes", models.TextField(blank=True)),
                ("received_from_type", models.CharField(blank=True, choices=[("community", "Community"), ("group", "Group"), ("cooperative", "Cooperative"), ("member", "Member"), ("institution", "Institution")], max_length=32)),
                ("received_from_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("recorded_by_user_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("obligation", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="transactions", to="resources.resourcepaymentobligation")),
                ("reverses", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="reversal", to="resources.resourcepaymenttransaction")),
            ],
            options={"ordering": ["-effective_on", "-created_at", "-id"]},
        ),
        migrations.AddIndex(model_name="resourcepaymentobligation", index=models.Index(fields=["resource", "status"], name="res_pay_ob_resource_status")),
        migrations.AddIndex(model_name="resourcepaymentobligation", index=models.Index(fields=["resource_beneficiary", "status"], name="res_pay_ob_benef_status")),
        migrations.AddConstraint(
            model_name="resourcepaymentobligation",
            constraint=models.UniqueConstraint(
                condition=Q(
                    is_deleted=False,
                    status__in=["draft", "active", "suspended"],
                ),
                fields=("resource_beneficiary", "obligation_type"),
                name="unique_open_beneficiary_obligation_type",
            ),
        ),
        migrations.AddIndex(model_name="resourcepaymenttransaction", index=models.Index(fields=["obligation", "effective_on"], name="res_pay_tx_obligation_date")),
        migrations.AddConstraint(
            model_name="resourcepaymenttransaction",
            constraint=models.UniqueConstraint(
                condition=~Q(client_mutation_id=""),
                fields=("created_by_user_id", "client_mutation_id"),
                name="unique_financial_client_mutation",
            ),
        ),
    ]
