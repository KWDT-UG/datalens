# Generated for the KWDT Data Lens backend foundation.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("communities", "0001_initial"),
        ("groups", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Member",
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
                ("member_number", models.CharField(blank=True, max_length=64)),
                ("first_name", models.CharField(max_length=150)),
                ("last_name", models.CharField(max_length=150)),
                ("middle_name", models.CharField(blank=True, max_length=150)),
                ("preferred_name", models.CharField(blank=True, max_length=150)),
                ("gender", models.CharField(blank=True, max_length=64)),
                ("date_of_birth", models.DateField(blank=True, null=True)),
                ("phone", models.CharField(blank=True, max_length=64)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("address_text", models.TextField(blank=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("active", "Active"),
                            ("inactive", "Inactive"),
                            ("deceased", "Deceased"),
                            ("exited", "Exited"),
                        ],
                        default="active",
                        max_length=32,
                    ),
                ),
                ("joined_on", models.DateField(blank=True, null=True)),
                ("left_on", models.DateField(blank=True, null=True)),
                ("deceased_on", models.DateField(blank=True, null=True)),
                ("notes", models.TextField(blank=True)),
                (
                    "community",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="members",
                        to="communities.community",
                    ),
                ),
                (
                    "group",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="members",
                        to="groups.group",
                    ),
                ),
            ],
            options={
                "ordering": ["community__name", "last_name", "first_name"],
            },
        ),
    ]
