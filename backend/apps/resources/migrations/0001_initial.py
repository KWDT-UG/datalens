# Generated for the KWDT Data Lens backend resource slice.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("communities", "0001_initial"),
        ("groups", "0001_initial"),
        ("institutions", "0001_initial"),
        ("members", "0001_initial"),
        ("participation", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ThematicArea",
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
                ("code", models.CharField(max_length=64, unique=True)),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("active", "Active"),
                            ("inactive", "Inactive"),
                            ("archived", "Archived"),
                        ],
                        default="active",
                        max_length=32,
                    ),
                ),
            ],
            options={"ordering": ["name", "code"]},
        ),
        migrations.CreateModel(
            name="Resource",
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
                    "owner_type",
                    models.CharField(
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
                ("owner_id", models.PositiveBigIntegerField()),
                (
                    "resource_type",
                    models.CharField(
                        choices=[
                            ("livestock", "Livestock"),
                            ("tool", "Tool"),
                            ("machinery", "Machinery"),
                            ("land_plot", "Land Plot"),
                            ("grant", "Grant"),
                            ("cash_asset", "Cash Asset"),
                            ("building_material", "Building Material"),
                            ("other", "Other"),
                        ],
                        default="other",
                        max_length=64,
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                (
                    "quantity",
                    models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        max_digits=14,
                        null=True,
                    ),
                ),
                ("unit", models.CharField(blank=True, max_length=64)),
                (
                    "value_amount",
                    models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        max_digits=14,
                        null=True,
                    ),
                ),
                ("value_currency", models.CharField(default="UGX", max_length=3)),
                ("acquired_on", models.DateField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("planned", "Planned"),
                            ("active", "Active"),
                            ("inactive", "Inactive"),
                            ("transferred", "Transferred"),
                            ("disposed", "Disposed"),
                        ],
                        default="planned",
                        max_length=32,
                    ),
                ),
                ("location_text", models.TextField(blank=True)),
                ("serial_or_tag_number", models.CharField(blank=True, max_length=128)),
                ("source_notes", models.TextField(blank=True)),
                (
                    "community",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="resources",
                        to="communities.community",
                    ),
                ),
            ],
            options={"ordering": ["community__name", "name"]},
        ),
        migrations.CreateModel(
            name="ResourceBeneficiary",
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
                ("beneficiary_id", models.PositiveBigIntegerField()),
                (
                    "relationship_type",
                    models.CharField(
                        choices=[
                            ("primary", "Primary"),
                            ("secondary", "Secondary"),
                            ("indirect", "Indirect"),
                        ],
                        default="primary",
                        max_length=32,
                    ),
                ),
                ("notes", models.TextField(blank=True)),
                (
                    "resource",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="beneficiaries",
                        to="resources.resource",
                    ),
                ),
            ],
            options={"ordering": ["resource__name", "relationship_type", "beneficiary_type"]},
        ),
        migrations.CreateModel(
            name="ResourceStatusEvent",
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
                    "event_type",
                    models.CharField(
                        choices=[
                            ("created", "Created"),
                            ("application_submitted", "Application Submitted"),
                            ("approved", "Approved"),
                            ("procurement_started", "Procurement Started"),
                            ("delivered", "Delivered"),
                            ("in_use", "In Use"),
                            ("maintenance", "Maintenance"),
                            ("completed", "Completed"),
                            ("transferred", "Transferred"),
                            ("disposed", "Disposed"),
                            ("other", "Other"),
                        ],
                        default="created",
                        max_length=64,
                    ),
                ),
                ("effective_at", models.DateTimeField()),
                ("notes", models.TextField(blank=True)),
                ("recorded_by_user_id", models.PositiveBigIntegerField(blank=True, null=True)),
                (
                    "resource",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="status_events",
                        to="resources.resource",
                    ),
                ),
            ],
            options={"ordering": ["-effective_at", "-created_at"]},
        ),
        migrations.CreateModel(
            name="ResourceThematicArea",
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
                ("is_primary", models.BooleanField(default=False)),
                (
                    "resource",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="thematic_links",
                        to="resources.resource",
                    ),
                ),
                (
                    "thematic_area",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="resource_links",
                        to="resources.thematicarea",
                    ),
                ),
            ],
            options={"ordering": ["resource__name", "-is_primary", "thematic_area__name"]},
        ),
        migrations.AddConstraint(
            model_name="resourcethematicarea",
            constraint=models.UniqueConstraint(
                fields=("resource", "thematic_area"),
                name="unique_resource_thematic_area",
            ),
        ),
    ]
