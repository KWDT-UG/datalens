from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("common", "0001_userprofile_userinvitation"),
        ("communities", "0002_remove_community_code"),
        ("resources", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="assigned_districts",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="assigned_communities",
            field=models.ManyToManyField(
                blank=True,
                related_name="assigned_user_profiles",
                to="communities.community",
            ),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="assigned_thematic_areas",
            field=models.ManyToManyField(
                blank=True,
                related_name="assigned_user_profiles",
                to="resources.thematicarea",
            ),
        ),
    ]
