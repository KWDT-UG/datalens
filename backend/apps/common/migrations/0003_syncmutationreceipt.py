from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("common", "0002_userprofile_assignments"),
    ]

    operations = [
        migrations.CreateModel(
            name="SyncMutationReceipt",
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
                ("user_id", models.PositiveBigIntegerField()),
                ("client_mutation_id", models.CharField(max_length=128)),
                ("request_fingerprint", models.CharField(max_length=64)),
                ("response_payload", models.JSONField(blank=True, default=dict)),
            ],
        ),
        migrations.AddConstraint(
            model_name="syncmutationreceipt",
            constraint=models.UniqueConstraint(
                fields=("user_id", "client_mutation_id"),
                name="unique_sync_mutation_receipt_per_user",
            ),
        ),
    ]
