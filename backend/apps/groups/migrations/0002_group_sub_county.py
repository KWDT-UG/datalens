from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("groups", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="group",
            name="sub_county",
            field=models.CharField(blank=True, max_length=128),
        ),
    ]
