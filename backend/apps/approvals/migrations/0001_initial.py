# Generated for the KWDT Data Lens backend approval slice.

import django.db.models.deletion
from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("communities", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ApprovalRequest",
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
                ("entity_type", models.CharField(max_length=64)),
                ("entity_id", models.PositiveBigIntegerField()),
                (
                    "action_type",
                    models.CharField(
                        choices=[
                            ("create", "Create"),
                            ("update", "Update"),
                            ("delete", "Delete"),
                        ],
                        default="create",
                        max_length=32,
                    ),
                ),
                ("submitted_payload", models.JSONField(default=dict)),
                ("diff_summary", models.JSONField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("approved", "Approved"),
                            ("rejected", "Rejected"),
                            ("superseded", "Superseded"),
                        ],
                        default="pending",
                        max_length=32,
                    ),
                ),
                ("submitted_by_user_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("submitted_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("reviewed_by_user_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("review_notes", models.TextField(blank=True)),
                ("applied_at", models.DateTimeField(blank=True, null=True)),
                (
                    "community",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="approval_requests",
                        to="communities.community",
                    ),
                ),
            ],
            options={"ordering": ["-submitted_at", "-created_at"]},
        ),
    ]
