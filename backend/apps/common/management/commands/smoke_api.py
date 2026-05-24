from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.test import Client

from apps.approvals.models import ApprovalRequest
from apps.common.seed_data import seed_demo_data
from apps.communities.models import Community
from apps.groups.models import Group
from apps.impacts.models import ImpactRecord
from apps.institutions.models import Institution
from apps.members.models import Member
from apps.participation.models import (
    Committee,
    CommitteeMembership,
    Cooperative,
    CooperativeMembership,
)
from apps.resources.models import (
    Resource,
    ResourceBeneficiary,
    ResourceStatusEvent,
    ResourceThematicArea,
    ThematicArea,
)


class Command(BaseCommand):
    help = "Run a read-only smoke check against the local API routes."

    def add_arguments(self, parser):
        parser.add_argument(
            "--seed-demo-data",
            action="store_true",
            help="Seed the idempotent demo dataset before checking endpoints.",
        )
        parser.add_argument(
            "--username",
            help="Optional username to force-login for authenticated settings.",
        )
        parser.add_argument(
            "--host",
            default="127.0.0.1",
            help="Host header used by the Django test client.",
        )

    def handle(self, *args, **options):
        if options["seed_demo_data"]:
            seed_demo_data()

        client = Client(HTTP_ACCEPT="application/json", HTTP_HOST=options["host"])
        if options["username"]:
            user = get_user_model().objects.filter(username=options["username"]).first()
            if user is None:
                raise CommandError(f"User '{options['username']}' was not found.")
            client.force_login(user)

        context = self._demo_context()
        endpoints = self._endpoints(context)
        failures = []

        for label, path, validator in endpoints:
            response = client.get(path)
            if response.status_code != 200:
                failures.append(f"{label}: expected 200, got {response.status_code}")
                self.stdout.write(self.style.ERROR(f"FAIL {label} {response.status_code}"))
                continue

            payload = response.json()
            try:
                detail = validator(payload)
            except AssertionError as exc:
                failures.append(f"{label}: {exc}")
                self.stdout.write(self.style.ERROR(f"FAIL {label} {exc}"))
                continue

            self.stdout.write(self.style.SUCCESS(f"OK   {label}: {detail}"))

        if failures:
            raise CommandError("API smoke check failed:\n" + "\n".join(failures))

        self.stdout.write(self.style.SUCCESS("API smoke check passed."))

    def _demo_context(self):
        return {
            "community": Community.objects.filter(name="KWDT Demo Community").first(),
            "group": Group.objects.filter(code="KWDT-DEMO-GRP").first(),
            "resource": Resource.objects.filter(name="Demo Irrigation Pump").first(),
        }

    def _endpoints(self, context):
        community = context["community"]
        group = context["group"]
        resource = context["resource"]

        if community is None or group is None or resource is None:
            raise CommandError(
                "Demo data was not found. Run with --seed-demo-data or run "
                "`make seed-demo-data` first."
            )

        return [
            ("health", "/health/", self._expect_keys("status")),
            ("api-root", "/api/v1/", self._expect_keys("communities", "resources")),
            ("communities", "/api/v1/communities/", self._expect_count(Community)),
            (
                "community-summary",
                f"/api/v1/communities/{community.id}/summary/",
                self._expect_keys("group_count", "member_count", "institution_count"),
            ),
            (
                "community-groups",
                f"/api/v1/communities/{community.id}/groups/",
                self._expect_list_count(Group),
            ),
            (
                "community-institutions",
                f"/api/v1/communities/{community.id}/institutions/",
                self._expect_list_count(Institution),
            ),
            ("groups", "/api/v1/groups/", self._expect_count(Group)),
            (
                "group-members",
                f"/api/v1/groups/{group.id}/members/",
                self._expect_list_count(Member),
            ),
            ("members", "/api/v1/members/", self._expect_count(Member)),
            ("institutions", "/api/v1/institutions/", self._expect_count(Institution)),
            ("committees", "/api/v1/committees/", self._expect_count(Committee)),
            (
                "committee-memberships",
                "/api/v1/committee-memberships/",
                self._expect_count(CommitteeMembership),
            ),
            ("cooperatives", "/api/v1/cooperatives/", self._expect_count(Cooperative)),
            (
                "cooperative-memberships",
                "/api/v1/cooperative-memberships/",
                self._expect_count(CooperativeMembership),
            ),
            ("thematic-areas", "/api/v1/thematic-areas/", self._expect_count(ThematicArea)),
            ("resources", "/api/v1/resources/", self._expect_count(Resource)),
            (
                "resource-detail",
                f"/api/v1/resources/{resource.id}/detail/",
                self._expect_resource_detail,
            ),
            (
                "resource-beneficiaries",
                "/api/v1/resource-beneficiaries/",
                self._expect_count(ResourceBeneficiary),
            ),
            (
                "resource-thematic-areas",
                "/api/v1/resource-thematic-areas/",
                self._expect_count(ResourceThematicArea),
            ),
            (
                "resource-status-events",
                f"/api/v1/resources/{resource.id}/status-events/",
                self._expect_list_count(ResourceStatusEvent),
            ),
            ("impact-records", "/api/v1/impact-records/", self._expect_count(ImpactRecord)),
            (
                "impact-summary",
                "/api/v1/impact-records/summary/",
                self._expect_data_keys("record_count", "beneficiary_count"),
            ),
            (
                "resource-impact-records",
                f"/api/v1/resources/{resource.id}/impact-records/",
                self._expect_list_count(ImpactRecord),
            ),
            (
                "approval-requests",
                "/api/v1/approval-requests/",
                self._expect_count(ApprovalRequest),
            ),
        ]

    def _expect_keys(self, *keys):
        def validate(payload):
            missing = [key for key in keys if key not in payload]
            if missing:
                raise AssertionError(f"missing keys: {', '.join(missing)}")
            return "keys=" + ",".join(keys)

        return validate

    def _expect_data_keys(self, *keys):
        def validate(payload):
            data = payload.get("data", {})
            missing = [key for key in keys if key not in data]
            if missing:
                raise AssertionError(f"missing data keys: {', '.join(missing)}")
            return "data_keys=" + ",".join(keys)

        return validate

    def _expect_count(self, model):
        def validate(payload):
            count = payload.get("count")
            expected_min = model.objects.count()
            if count is None:
                raise AssertionError("missing paginated count")
            if expected_min and count < expected_min:
                raise AssertionError(f"expected at least {expected_min} records, got {count}")
            return f"count={count}"

        return validate

    def _expect_list_count(self, model):
        def validate(payload):
            expected_min = model.objects.count()
            count = len(payload)
            if expected_min and count < 1:
                raise AssertionError("expected at least 1 record")
            return f"count={count}"

        return validate

    def _expect_resource_detail(self, payload):
        resource = payload.get("resource")
        beneficiaries = payload.get("beneficiaries")
        status_events = payload.get("status_events")
        impact_records = payload.get("impact_records")

        if not resource:
            raise AssertionError("missing resource object")
        for key, value in (
            ("beneficiaries", beneficiaries),
            ("status_events", status_events),
            ("impact_records", impact_records),
        ):
            if not isinstance(value, list) or not value:
                raise AssertionError(f"expected non-empty {key}")

        return (
            f"resource={resource.get('name')} "
            f"beneficiaries={len(beneficiaries)} "
            f"status_events={len(status_events)} "
            f"impact_records={len(impact_records)}"
        )
