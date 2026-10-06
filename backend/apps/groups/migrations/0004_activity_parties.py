import django.db.models.deletion
from django.db import migrations, models
from django.db.migrations.exceptions import IrreversibleError


def backfill_activity_parties(apps, schema_editor):
    GroupActivity = apps.get_model("groups", "GroupActivity")
    ActivityParty = apps.get_model("groups", "ActivityParty")
    parties = []
    for activity in GroupActivity.objects.all().iterator():
        if activity.committee_id:
            parties.append(
                ActivityParty(
                    activity_id=activity.pk,
                    party_type="committee",
                    party_id=activity.committee_id,
                    role="subject",
                    created_by_user_id=activity.created_by_user_id,
                    updated_by_user_id=activity.updated_by_user_id,
                )
            )
            parties.append(
                ActivityParty(
                    activity_id=activity.pk,
                    party_type="group",
                    party_id=activity.group_id,
                    role="audience",
                    created_by_user_id=activity.created_by_user_id,
                    updated_by_user_id=activity.updated_by_user_id,
                )
            )
        else:
            parties.append(
                ActivityParty(
                    activity_id=activity.pk,
                    party_type="group",
                    party_id=activity.group_id,
                    role="subject",
                    created_by_user_id=activity.created_by_user_id,
                    updated_by_user_id=activity.updated_by_user_id,
                )
            )
    ActivityParty.objects.bulk_create(parties)


def remove_activity_parties(apps, schema_editor):
    if apps.get_model("groups", "GroupActivity").objects.filter(
        group_id__isnull=True
    ).exists():
        raise IrreversibleError(
            "Cannot reverse activity parties after creating an activity without a group."
        )
    apps.get_model("groups", "ActivityParty").objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("groups", "0003_groupactivity")]

    operations = [
        migrations.AlterField(
            model_name="groupactivity",
            name="group",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="activities",
                to="groups.group",
            ),
        ),
        migrations.CreateModel(
            name="ActivityParty",
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
                    "party_type",
                    models.CharField(
                        choices=[
                            ("group", "Group"),
                            ("committee", "Committee"),
                            ("cooperative", "Cooperative"),
                            ("institution", "Institution"),
                        ],
                        max_length=32,
                    ),
                ),
                ("party_id", models.PositiveBigIntegerField()),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("subject", "For"),
                            ("organizer", "Organizer"),
                            ("host", "Host"),
                            ("partner", "Partner"),
                            ("audience", "Participating audience"),
                        ],
                        max_length=32,
                    ),
                ),
                (
                    "activity",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="parties",
                        to="groups.groupactivity",
                    ),
                ),
            ],
            options={"ordering": ["activity_id", "role", "party_type", "party_id"]},
        ),
        migrations.RunPython(backfill_activity_parties, remove_activity_parties),
        migrations.AddConstraint(
            model_name="activityparty",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_deleted", False)),
                fields=("activity", "party_type", "party_id", "role"),
                name="unique_active_activity_party_role",
            ),
        ),
        migrations.AddConstraint(
            model_name="activityparty",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_deleted", False), ("role", "subject")),
                fields=("activity",),
                name="unique_active_activity_subject",
            ),
        ),
        migrations.AddIndex(
            model_name="activityparty",
            index=models.Index(
                fields=["party_type", "party_id", "is_deleted"],
                name="activity_party_lookup_idx",
            ),
        ),
    ]
