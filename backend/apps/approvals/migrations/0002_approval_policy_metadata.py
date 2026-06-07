from django.db import migrations, models


def classify_existing_requests(apps, schema_editor):
    ApprovalRequest = apps.get_model("approvals", "ApprovalRequest")
    ApprovalRequest.objects.filter(entity_type="impact_record").update(
        review_scope="impact"
    )


class Migration(migrations.Migration):
    dependencies = [
        ("approvals", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="approvalrequest",
            name="base_sync_version",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="approvalrequest",
            name="policy_reason",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="approvalrequest",
            name="review_scope",
            field=models.CharField(
                choices=[
                    ("standard", "Programme Review"),
                    ("impact", "Impact Review"),
                    ("finance", "Finance Review"),
                ],
                default="standard",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="approvalrequest",
            name="submission_source",
            field=models.CharField(
                choices=[
                    ("api", "API"),
                    ("offline_sync", "Offline Sync"),
                    ("manual", "Manual"),
                ],
                default="manual",
                max_length=32,
            ),
        ),
        migrations.RunPython(
            classify_existing_requests,
            migrations.RunPython.noop,
        ),
    ]
