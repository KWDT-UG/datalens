# Generated for the KWDT Data Lens backend participation slice.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("communities", "0001_initial"),
        ("members", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Committee",
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
                ("name", models.CharField(max_length=255)),
                ("committee_type", models.CharField(blank=True, max_length=64)),
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
                ("description", models.TextField(blank=True)),
                ("formed_on", models.DateField(blank=True, null=True)),
                ("closed_on", models.DateField(blank=True, null=True)),
                (
                    "community",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="committees",
                        to="communities.community",
                    ),
                ),
            ],
            options={"ordering": ["community__name", "name"]},
        ),
        migrations.CreateModel(
            name="Cooperative",
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
                ("name", models.CharField(max_length=255)),
                ("cooperative_type", models.CharField(blank=True, max_length=64)),
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
                ("description", models.TextField(blank=True)),
                ("formed_on", models.DateField(blank=True, null=True)),
                ("closed_on", models.DateField(blank=True, null=True)),
                (
                    "community",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="cooperatives",
                        to="communities.community",
                    ),
                ),
            ],
            options={"ordering": ["community__name", "name"]},
        ),
        migrations.CreateModel(
            name="CommitteeMembership",
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
                ("role_name", models.CharField(blank=True, max_length=128)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("active", "Active"),
                            ("inactive", "Inactive"),
                            ("ended", "Ended"),
                            ("archived", "Archived"),
                        ],
                        default="active",
                        max_length=32,
                    ),
                ),
                ("start_date", models.DateField(blank=True, null=True)),
                ("end_date", models.DateField(blank=True, null=True)),
                ("notes", models.TextField(blank=True)),
                (
                    "committee",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="memberships",
                        to="participation.committee",
                    ),
                ),
                (
                    "member",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="committee_memberships",
                        to="members.member",
                    ),
                ),
            ],
            options={
                "ordering": [
                    "committee__name",
                    "member__last_name",
                    "member__first_name",
                ]
            },
        ),
        migrations.CreateModel(
            name="CooperativeMembership",
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
                ("role_name", models.CharField(blank=True, max_length=128)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("active", "Active"),
                            ("inactive", "Inactive"),
                            ("ended", "Ended"),
                            ("archived", "Archived"),
                        ],
                        default="active",
                        max_length=32,
                    ),
                ),
                ("start_date", models.DateField(blank=True, null=True)),
                ("end_date", models.DateField(blank=True, null=True)),
                ("notes", models.TextField(blank=True)),
                (
                    "cooperative",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="memberships",
                        to="participation.cooperative",
                    ),
                ),
                (
                    "member",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="cooperative_memberships",
                        to="members.member",
                    ),
                ),
            ],
            options={
                "ordering": [
                    "cooperative__name",
                    "member__last_name",
                    "member__first_name",
                ]
            },
        ),
        migrations.AddConstraint(
            model_name="committeemembership",
            constraint=models.UniqueConstraint(
                condition=models.Q(is_deleted=False, status="active"),
                fields=("committee", "member"),
                name="unique_active_committee_membership",
            ),
        ),
        migrations.AddConstraint(
            model_name="cooperativemembership",
            constraint=models.UniqueConstraint(
                condition=models.Q(is_deleted=False, status="active"),
                fields=("cooperative", "member"),
                name="unique_active_cooperative_membership",
            ),
        ),
    ]
