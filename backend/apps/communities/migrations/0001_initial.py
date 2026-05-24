# Generated for the KWDT Data Lens backend foundation.

from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Community",
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
                ("area_name", models.CharField(blank=True, max_length=255)),
                ("district_name", models.CharField(blank=True, max_length=255)),
                ("region_name", models.CharField(blank=True, max_length=255)),
                ("country", models.CharField(default="Uganda", max_length=128)),
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
                ("notes", models.TextField(blank=True)),
            ],
            options={
                "verbose_name_plural": "communities",
                "ordering": ["name", "code"],
            },
        ),
    ]
