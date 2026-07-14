from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.common.models import InvitationStatus, UserInvitation


class Command(BaseCommand):
    help = "Delete terminal or stale expired user invitations after a retention window."

    def add_arguments(self, parser):
        parser.add_argument(
            "--older-than-days",
            type=int,
            default=30,
            help="Retention window in days. Defaults to 30.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report invitations that would be purged without deleting them.",
        )

    def handle(self, *args, **options):
        older_than_days = options["older_than_days"]
        if older_than_days < 1:
            self.stderr.write("older-than-days must be at least 1.")
            return

        cutoff = timezone.now() - timedelta(days=older_than_days)
        queryset = UserInvitation.objects.filter(
            Q(status=InvitationStatus.ACCEPTED, accepted_at__lte=cutoff)
            | Q(status=InvitationStatus.REVOKED, revoked_at__lte=cutoff)
            | Q(status=InvitationStatus.PENDING, expires_at__lte=cutoff)
        )
        count = queryset.count()

        if options["dry_run"]:
            self.stdout.write(
                f"Would purge {count} invitation(s) older than {older_than_days} days."
            )
            return

        queryset.delete()
        self.stdout.write(
            f"Purged {count} invitation(s) older than {older_than_days} days."
        )
