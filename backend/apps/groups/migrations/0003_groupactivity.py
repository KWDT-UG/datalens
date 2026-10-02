import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("groups", "0002_group_sub_county"),
        ("participation", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="GroupActivity",
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
                ("created_by_user_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("updated_by_user_id", models.PositiveBigIntegerField(blank=True, null=True)),
                ("client_created_at", models.DateTimeField(blank=True, null=True)),
                ("client_updated_at", models.DateTimeField(blank=True, null=True)),
                ("client_mutation_id", models.CharField(blank=True, max_length=128)),
                ("sync_version", models.PositiveIntegerField(default=1)),
                ("is_deleted", models.BooleanField(default=False)),
                (
                    "activity_type",
                    models.CharField(
                        choices=[("meeting", "Meeting"), ("training", "Training")],
                        max_length=16,
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                ("starts_at", models.DateTimeField()),
                ("ends_at", models.DateTimeField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("planned", "Planned"),
                            ("completed", "Completed"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="planned",
                        max_length=16,
                    ),
                ),
                ("location_text", models.CharField(blank=True, max_length=255)),
                ("facilitator_name", models.CharField(blank=True, max_length=255)),
                ("expected_participant_count", models.PositiveIntegerField(blank=True, null=True)),
                ("women_attendance_count", models.PositiveIntegerField(blank=True, null=True)),
                ("men_attendance_count", models.PositiveIntegerField(blank=True, null=True)),
                ("agenda", models.TextField(blank=True)),
                ("minutes", models.TextField(blank=True)),
                ("decisions_actions", models.TextField(blank=True)),
                ("training_topic", models.CharField(blank=True, max_length=255)),
                ("objectives", models.TextField(blank=True)),
                ("report_notes", models.TextField(blank=True)),
                ("notes", models.TextField(blank=True)),
                (
                    "committee",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="group_activities",
                        to="participation.committee",
                    ),
                ),
                (
                    "community",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="group_activities",
                        to="communities.community",
                    ),
                ),
                (
                    "group",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="activities",
                        to="groups.group",
                    ),
                ),
            ],
            options={"ordering": ["starts_at", "title", "id"]},
        ),
    ]
