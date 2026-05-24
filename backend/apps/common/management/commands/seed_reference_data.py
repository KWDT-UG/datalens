from django.core.management.base import BaseCommand

from apps.common.seed_data import seed_reference_data


class Command(BaseCommand):
    help = "Seed minimal reference data used for development."

    def handle(self, *args, **options):
        result = seed_reference_data()
        self.stdout.write(
            self.style.SUCCESS(
                (
                    "Reference data seeded: "
                    f"created={result['created']}, "
                    f"updated={result['updated']}, "
                    f"total_thematic_areas={result['total']}"
                )
            )
        )
