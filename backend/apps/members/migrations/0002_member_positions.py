from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("members", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="member",
            name="community_position",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="member",
            name="group_position",
            field=models.CharField(blank=True, max_length=150),
        ),
    ]
