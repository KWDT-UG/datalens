# Generated for the KWDT Data Lens backend impact slice.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("resources", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ImpactRecord",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by_user_id",
                    models.PositiveBigIntegerField(blank=True, null=True),
                ),
                (
                    "updated_by_user_id",
                    models.PositiveBigIntegerField(blank=True, null=True),
                ),
                ("client_created_at", models.DateTimeField(blank=True, null=True)),
                ("client_updated_at", models.DateTimeField(blank=True, null=True)),
                ("client_mutation_id", models.CharField(blank=True, max_length=128)),
                ("sync_version", models.PositiveIntegerField(default=1)),
                ("is_deleted", models.BooleanField(default=False)),
                (
                    "beneficiary_type",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("community", "Community"),
                            ("group", "Group"),
                            ("cooperative", "Cooperative"),
                            ("member", "Member"),
                            ("institution", "Institution"),
                        ],
                        max_length=32,
                    ),
                ),
                ("beneficiary_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("period_type", models.CharField(blank=True, max_length=64)),
                ("period_start", models.DateField(blank=True, null=True)),
                ("period_end", models.DateField(blank=True, null=True)),
                ("as_of_date", models.DateField(blank=True, null=True)),
                ("beneficiary_count", models.PositiveIntegerField(default=0)),
                ("household_count", models.PositiveIntegerField(default=0)),
                ("member_count", models.PositiveIntegerField(default=0)),
                ("institution_count", models.PositiveIntegerField(default=0)),
                ("notes", models.TextField(blank=True)),
                (
                    "method",
                    models.CharField(
                        choices=[
                            ("observed", "Observed"),
                            ("estimated", "Estimated"),
                            ("derived", "Derived"),
                        ],
                        default="observed",
                        max_length=32,
                    ),
                ),
                ("recorded_by_user_id", models.PositiveBigIntegerField(blank=True, null=True)),
                (
                    "resource",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="impact_records",
                        to="resources.resource",
                    ),
                ),
            ],
            options={"ordering": ["-as_of_date", "-created_at"]},
        ),
    ]
