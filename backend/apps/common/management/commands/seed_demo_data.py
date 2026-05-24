from django.core.management.base import BaseCommand
from django.db import transaction

from apps.common.seed_data import seed_demo_data


class Command(BaseCommand):
    help = "Seed a small idempotent demo dataset for local development."

    @transaction.atomic
    def handle(self, *args, **options):
        result = seed_demo_data()
        self.stdout.write(
            self.style.SUCCESS(
                (
                    "Demo data seeded: "
                    f"created={result['created']}, "
                    f"updated={result['updated']}, "
                    f"communities={result['community_count']}, "
                    f"groups={result['group_count']}, "
                    f"members={result['member_count']}, "
                    f"institutions={result['institution_count']}, "
                    f"committees={result['committee_count']}, "
                    f"cooperatives={result['cooperative_count']}, "
                    f"resources={result['resource_count']}, "
                    f"impact_records={result['impact_record_count']}, "
                    f"community_id={result['community_id']}, "
                    f"resource_id={result['resource_id']}, "
                    f"approval_request_id={result['approval_request_id']}"
                )
            )
        )
