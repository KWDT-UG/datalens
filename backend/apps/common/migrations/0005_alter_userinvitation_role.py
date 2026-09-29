from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("common", "0004_userinvitation_lifecycle_metadata"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userinvitation",
            name="role",
            field=models.CharField(
                choices=[
                    ("field_officer", "Field Officer"),
                    ("programme_manager", "Programme Manager"),
                    ("executive_leadership", "Executive Leadership"),
                    ("finance_administrator", "Finance Administrator"),
                    (
                        "monitoring_evaluation_manager",
                        "Monitoring & Evaluation Manager",
                    ),
                    ("communications_viewer", "Communications Viewer"),
                    (
                        "resource_procurement_officer",
                        "Resource & Procurement Officer",
                    ),
                    ("system_administrator", "System Administrator"),
                    ("mvp_full_access", "MVP Full Access"),
                ],
                max_length=64,
            ),
        ),
    ]
