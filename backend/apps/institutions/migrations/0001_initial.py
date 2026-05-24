# Generated for the KWDT Data Lens backend foundation.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("communities", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Institution",
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
                ("code", models.CharField(blank=True, max_length=64)),
                ("name", models.CharField(max_length=255)),
                (
                    "institution_type",
                    models.CharField(
                        choices=[
                            ("school", "School"),
                            ("church", "Church"),
                            ("clinic", "Clinic"),
                            ("community_center", "Community Center"),
                            ("cooperative_partner", "Cooperative Partner"),
                            ("other", "Other"),
                        ],
                        default="other",
                        max_length=64,
                    ),
                ),
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
                ("contact_name", models.CharField(blank=True, max_length=255)),
                ("phone", models.CharField(blank=True, max_length=64)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("location_text", models.TextField(blank=True)),
                ("notes", models.TextField(blank=True)),
                (
                    "community",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="institutions",
                        to="communities.community",
                    ),
                ),
            ],
            options={
                "ordering": ["community__name", "name"],
            },
        ),
        migrations.AddConstraint(
            model_name="institution",
            constraint=models.UniqueConstraint(
                fields=("community", "name"),
                name="unique_institution_name_per_community",
            ),
        ),
        migrations.AddConstraint(
            model_name="institution",
            constraint=models.UniqueConstraint(
                condition=~models.Q(code=""),
                fields=("community", "code"),
                name="unique_institution_code_per_community_when_set",
            ),
        ),
    ]
