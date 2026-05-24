from django.core.management.base import BaseCommand

from apps.common.permissions import GROUP_NAME_BY_ROLE, ensure_role_groups


class Command(BaseCommand):
    help = "Create the Django auth groups used for Data Lens role placeholders."

    def handle(self, *args, **options):
        ensure_role_groups()
        self.stdout.write(
            self.style.SUCCESS(
                "Role groups ready: " + ", ".join(sorted(GROUP_NAME_BY_ROLE.values()))
            )
        )
