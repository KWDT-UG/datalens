from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("communities", "0001_initial"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="community",
            name="code",
        ),
        migrations.AlterModelOptions(
            name="community",
            options={"ordering": ["name", "id"], "verbose_name_plural": "communities"},
        ),
    ]
