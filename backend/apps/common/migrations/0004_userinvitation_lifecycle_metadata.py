from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("common", "0003_syncmutationreceipt"),
    ]

    operations = [
        migrations.AddField(
            model_name="userinvitation",
            name="last_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="userinvitation",
            name="resend_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="userinvitation",
            name="revoked_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
