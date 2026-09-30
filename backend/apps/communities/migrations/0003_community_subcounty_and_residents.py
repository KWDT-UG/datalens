from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("communities", "0002_remove_community_code"),
    ]

    operations = [
        migrations.RenameField(
            model_name="community",
            old_name="area_name",
            new_name="subcounty_name",
        ),
        migrations.AddField(
            model_name="community",
            name="resident_count",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
