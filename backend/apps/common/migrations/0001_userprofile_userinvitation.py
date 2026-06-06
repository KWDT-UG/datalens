from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserProfile",
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
                    "workforce_type",
                    models.CharField(
                        choices=[
                            ("staff", "Staff"),
                            ("intern", "Intern"),
                            ("volunteer", "Volunteer"),
                            ("contractor", "Contractor"),
                            ("other", "Other"),
                        ],
                        default="staff",
                        max_length=32,
                    ),
                ),
                ("position_title", models.CharField(blank=True, max_length=160)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="datalens_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="UserInvitation",
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
                ("email", models.EmailField(max_length=254)),
                ("first_name", models.CharField(blank=True, max_length=150)),
                ("last_name", models.CharField(blank=True, max_length=150)),
                (
                    "workforce_type",
                    models.CharField(
                        choices=[
                            ("staff", "Staff"),
                            ("intern", "Intern"),
                            ("volunteer", "Volunteer"),
                            ("contractor", "Contractor"),
                            ("other", "Other"),
                        ],
                        default="staff",
                        max_length=32,
                    ),
                ),
                ("position_title", models.CharField(blank=True, max_length=160)),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("field_officer", "Field Officer"),
                            ("programme_manager", "Programme Manager"),
                            ("executive_leadership", "Executive Leadership"),
                            ("finance_administrator", "Finance Administrator"),
                            (
                                "monitoring_evaluation_manager",
                                "Monitoring & Evaluation Manager",
                            ),
                            ("communications_viewer", "Communications Viewer"),
                            (
                                "resource_procurement_officer",
                                "Resource & Procurement Officer",
                            ),
                            ("system_administrator", "System Administrator"),
                        ],
                        max_length=64,
                    ),
                ),
                ("token_hash", models.CharField(max_length=64, unique=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("accepted", "Accepted"),
                            ("revoked", "Revoked"),
                        ],
                        default="pending",
                        max_length=32,
                    ),
                ),
                ("invited_by_user_id", models.PositiveBigIntegerField()),
                ("invited_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
                ("accepted_at", models.DateTimeField(blank=True, null=True)),
                (
                    "accepted_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="accepted_datalens_invitations",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-invited_at"]},
        ),
    ]
