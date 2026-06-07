from datetime import date, datetime, timedelta, timezone
import secrets

from django.contrib.auth import get_user_model

from apps.approvals.models import ApprovalRequest
from apps.common.models import (
    ApprovalActionType,
    BeneficiaryRelationshipType,
    ImpactMethod,
    InvitationStatus,
    ResourceEventType,
    ResourcePartyType,
    ResourceStatus,
    ResourceType,
    UserProfile,
    UserInvitation,
    UserRole,
    WorkforceType,
)
from apps.common.permissions import assign_role
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


REFERENCE_THEMATIC_AREAS = [
    {
        "code": "WASH",
        "name": "WASH",
        "description": "Water, sanitation, and hygiene initiatives.",
    },
    {
        "code": "EDU",
        "name": "Education",
        "description": "Education access, school support, and learning outcomes.",
    },
    {
        "code": "ENV",
        "name": "Environment",
        "description": "Environmental restoration, conservation, and climate resilience.",
    },
    {
        "code": "ECON",
        "name": "Economic Empowerment",
        "description": "Livelihoods, savings groups, enterprise, and productive assets.",
    },
]

DEMO_USER_SPECS = [
    (
        "demo.field.officer",
        "Amina",
        "Field",
        "amina.field@example.test",
        UserRole.FIELD_OFFICER,
        WorkforceType.STAFF,
        "Field Officer - Mukono District",
        True,
    ),
    (
        "demo.programme.manager",
        "Joan",
        "Programme",
        "joan.programme@example.test",
        UserRole.PROGRAMME_MANAGER,
        WorkforceType.STAFF,
        "Programme Officer - Economic Empowerment",
        True,
    ),
    (
        "demo.executive",
        "Margaret",
        "Executive",
        "margaret.executive@example.test",
        UserRole.EXECUTIVE_LEADERSHIP,
        WorkforceType.STAFF,
        "Executive Director / Coordinator",
        True,
    ),
    (
        "demo.finance",
        "Viola",
        "Finance",
        "viola.finance@example.test",
        UserRole.FINANCE_ADMINISTRATOR,
        WorkforceType.STAFF,
        "Finance & Administration Officer",
        True,
    ),
    (
        "demo.me",
        "Benjamin",
        "Evaluation",
        "benjamin.me@example.test",
        UserRole.MONITORING_EVALUATION_MANAGER,
        WorkforceType.STAFF,
        "Monitoring & Evaluation Officer",
        True,
    ),
    (
        "demo.communications.intern",
        "Mildred",
        "Communications",
        "mildred.communications@example.test",
        UserRole.COMMUNICATIONS_VIEWER,
        WorkforceType.INTERN,
        "Communications Intern",
        True,
    ),
    (
        "demo.procurement.contractor",
        "Zoe",
        "Procurement",
        "zoe.procurement@example.test",
        UserRole.RESOURCE_PROCUREMENT_OFFICER,
        WorkforceType.CONTRACTOR,
        "Procurement Support Contractor",
        True,
    ),
    (
        "demo.system.volunteer",
        "Alex",
        "Systems",
        "alex.systems@example.test",
        UserRole.SYSTEM_ADMINISTRATOR,
        WorkforceType.VOLUNTEER,
        "Data Systems Volunteer",
        False,
    ),
]


def seed_reference_data():
    created = 0
    updated = 0

    for area in REFERENCE_THEMATIC_AREAS:
        thematic_area, was_created = ThematicArea.objects.update_or_create(
            code=area["code"],
            defaults={
                "name": area["name"],
                "description": area["description"],
                "status": "active",
            },
        )
        if was_created:
            created += 1
        else:
            updated += 1

    return {
        "created": created,
        "updated": updated,
        "total": ThematicArea.objects.count(),
    }


def seed_demo_data():
    seed_reference_data()

    created = 0
    updated = 0

    def count_result(was_created):
        nonlocal created, updated
        if was_created:
            created += 1
        else:
            updated += 1

    def upsert(model, lookup, defaults):
        instance, was_created = model.objects.update_or_create(
            **lookup,
            defaults=defaults,
        )
        count_result(was_created)
        return instance

    demo_users = {}
    for username, first_name, last_name, email, role, workforce_type, title, is_active in DEMO_USER_SPECS:
        user, was_created = get_user_model().objects.update_or_create(
            username=username,
            defaults={
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "is_active": is_active,
            },
        )
        demo_users[username] = user
        if was_created:
            user.set_unusable_password()
            user.save(update_fields=["password"])
        count_result(was_created)
        assign_role(user, role)
        _profile, profile_created = UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "workforce_type": workforce_type,
                "position_title": title,
            },
        )
        count_result(profile_created)

    invitation_specs = [
        {
            "email": "candidate.intern@example.test",
            "first_name": "Pat",
            "last_name": "Intern",
            "workforce_type": WorkforceType.INTERN,
            "position_title": "Community Data Intern",
            "role": UserRole.FIELD_OFFICER,
            "status": InvitationStatus.PENDING,
            "accepted_user": None,
            "accepted_at": None,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        },
        {
            "email": "alex.systems@example.test",
            "first_name": "Alex",
            "last_name": "Systems",
            "workforce_type": WorkforceType.VOLUNTEER,
            "position_title": "Data Systems Volunteer",
            "role": UserRole.SYSTEM_ADMINISTRATOR,
            "status": InvitationStatus.ACCEPTED,
            "accepted_user": demo_users["demo.system.volunteer"],
            "accepted_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        },
        {
            "email": "revoked.contractor@example.test",
            "first_name": "Chris",
            "last_name": "Contractor",
            "workforce_type": WorkforceType.CONTRACTOR,
            "position_title": "Short-term Data Contractor",
            "role": UserRole.RESOURCE_PROCUREMENT_OFFICER,
            "status": InvitationStatus.REVOKED,
            "accepted_user": None,
            "accepted_at": None,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        },
    ]
    invited_by_user_id = demo_users["demo.system.volunteer"].id
    for invitation_spec in invitation_specs:
        invitation, was_created = UserInvitation.objects.get_or_create(
            email=invitation_spec["email"],
            defaults={
                "token_hash": secrets.token_hex(32),
                "invited_by_user_id": invited_by_user_id,
                **invitation_spec,
            },
        )
        if not was_created:
            for field, value in invitation_spec.items():
                setattr(invitation, field, value)
            invitation.invited_by_user_id = invited_by_user_id
            invitation.save()
        count_result(was_created)

    community = upsert(
        Community,
        {"name": "KWDT Demo Community"},
        {
            "area_name": "Central Demo Parish",
            "district_name": "Kampala",
            "region_name": "Central",
            "country": "Uganda",
            "status": "active",
            "notes": "Seeded demo community for local development.",
        },
    )
    north_community = upsert(
        Community,
        {"name": "KWDT Northern Demonstration Community"},
        {
            "area_name": "Bweyale Cluster",
            "district_name": "Kiryandongo",
            "region_name": "Northern",
            "country": "Uganda",
            "status": "active",
            "notes": "Second seeded community for scoped list and summary checks.",
        },
    )

    group_specs = [
        ("KWDT-DEMO-GRP", "Demo Savings Group", "Thursday", date(2024, 1, 15)),
        ("KWDT-DEMO-YOUTH", "Youth Enterprise Group", "Tuesday", date(2024, 2, 7)),
        ("KWDT-DEMO-WASH", "Water Users Group", "Friday", date(2024, 3, 12)),
        ("KWDT-DEMO-ENV", "Environment Stewardship Group", "Monday", date(2023, 11, 22)),
    ]
    groups = {}
    for code, name, meeting_day, formed_on in group_specs:
        groups[code] = upsert(
            Group,
            {"community": community, "code": code},
            {
                "name": name,
                "status": "active",
                "formed_on": formed_on,
                "meeting_day": meeting_day,
                "notes": "Seeded demo group for MVP workflow testing.",
            },
        )

    north_group = upsert(
        Group,
        {"community": north_community, "code": "KWDT-NORTH-GRP"},
        {
            "name": "Northern Savings Group",
            "status": "active",
            "formed_on": date(2024, 5, 1),
            "meeting_day": "Wednesday",
            "notes": "Second-community group for cross-community API checks.",
        },
    )

    member_specs = [
        ("001", "KWDT-DEMO-GRP", "Amina", "Nabukenya", "Amina", "female", "active"),
        ("002", "KWDT-DEMO-GRP", "Brian", "Kato", "Brian", "male", "active"),
        ("003", "KWDT-DEMO-GRP", "Catherine", "Adoch", "Cathy", "female", "active"),
        ("004", "KWDT-DEMO-YOUTH", "David", "Okello", "David", "male", "active"),
        ("005", "KWDT-DEMO-YOUTH", "Esther", "Namara", "Esther", "female", "active"),
        ("006", "KWDT-DEMO-YOUTH", "Faridah", "Nakku", "Fari", "female", "inactive"),
        ("007", "KWDT-DEMO-WASH", "Grace", "Atim", "Grace", "female", "active"),
        ("008", "KWDT-DEMO-WASH", "Henry", "Mugisha", "Henry", "male", "active"),
        ("009", "KWDT-DEMO-WASH", "Irene", "Akello", "Irene", "female", "active"),
        ("010", "KWDT-DEMO-ENV", "Joseph", "Lwanga", "Joseph", "male", "active"),
        ("011", "KWDT-DEMO-ENV", "Keza", "Tumusiime", "Keza", "female", "active"),
        ("012", "KWDT-DEMO-ENV", "Lydia", "Nampiima", "Lydia", "female", "exited"),
    ]
    members = {}
    for index, spec in enumerate(member_specs, start=1):
        suffix, group_code, first_name, last_name, preferred, gender, status = spec
        member_number = f"KWDT-DEMO-MEM-{suffix}"
        joined_on = date(2024, min(index, 9), min(index + 1, 28))
        members[member_number] = upsert(
            Member,
            {"community": community, "member_number": member_number},
            {
                "group": groups[group_code],
                "first_name": first_name,
                "last_name": last_name,
                "preferred_name": preferred,
                "gender": gender,
                "phone": f"+256700000{index:03d}",
                "email": f"{first_name.lower()}.{last_name.lower()}@demo.example.com",
                "address_text": f"{community.area_name}, household {index}",
                "status": status,
                "joined_on": joined_on,
                "left_on": date(2024, 10, 31) if status == "exited" else None,
                "notes": "Seeded demo member for MVP workflow testing.",
            },
        )

    upsert(
        Member,
        {"community": north_community, "member_number": "KWDT-NORTH-MEM-001"},
        {
            "group": north_group,
            "first_name": "Moses",
            "last_name": "Ocen",
            "preferred_name": "Moses",
            "gender": "male",
            "phone": "+256700001001",
            "email": "moses.ocen@demo.example.com",
            "status": "active",
            "joined_on": date(2024, 5, 12),
            "notes": "Second-community member for scoped filtering checks.",
        },
    )

    institution_specs = [
        ("KWDT-DEMO-INS", "Demo Primary School", "school", "Grace N."),
        ("KWDT-DEMO-CLINIC", "Demo Health Clinic", "clinic", "Dr. Peter O."),
        ("KWDT-DEMO-CC", "Demo Community Center", "community_center", "Sarah A."),
        ("KWDT-DEMO-CHURCH", "Demo Parish Church", "church", "Rev. Daniel M."),
    ]
    institutions = {}
    for index, (code, name, institution_type, contact_name) in enumerate(
        institution_specs,
        start=10,
    ):
        institutions[code] = upsert(
            Institution,
            {"community": community, "code": code},
            {
                "name": name,
                "institution_type": institution_type,
                "status": "active",
                "contact_name": contact_name,
                "phone": f"+256700000{index:03d}",
                "email": f"{code.lower().replace('_', '-')}@demo.example.com",
                "location_text": "Seeded community service location.",
                "notes": "Seeded demo institution for MVP workflow testing.",
            },
        )

    north_institution = upsert(
        Institution,
        {"community": north_community, "code": "KWDT-NORTH-INS"},
        {
            "name": "Northern Demo Clinic",
            "institution_type": "clinic",
            "status": "active",
            "contact_name": "Alice A.",
            "phone": "+256700001010",
            "email": "northern.clinic@demo.example.com",
            "location_text": "Bweyale main road.",
            "notes": "Second-community institution for scoped filtering checks.",
        },
    )

    committee_specs = [
        ("Demo Oversight Committee", "oversight", date(2024, 3, 10)),
        ("Resource Allocation Committee", "resource_allocation", date(2024, 4, 15)),
        ("Impact Review Committee", "impact_review", date(2024, 5, 20)),
    ]
    committees = {}
    for name, committee_type, formed_on in committee_specs:
        committees[name] = upsert(
            Committee,
            {"community": community, "name": name},
            {
                "committee_type": committee_type,
                "status": "active",
                "description": "Seeded demo committee for MVP workflow testing.",
                "formed_on": formed_on,
            },
        )

    committee_membership_specs = [
        ("Demo Oversight Committee", "001", "Chairperson"),
        ("Demo Oversight Committee", "002", "Secretary"),
        ("Demo Oversight Committee", "007", "Member"),
        ("Resource Allocation Committee", "003", "Chairperson"),
        ("Resource Allocation Committee", "005", "Treasurer"),
        ("Resource Allocation Committee", "008", "Member"),
        ("Impact Review Committee", "009", "Chairperson"),
        ("Impact Review Committee", "011", "Member"),
    ]
    committee_membership = None
    for committee_name, member_suffix, role_name in committee_membership_specs:
        member = members[f"KWDT-DEMO-MEM-{member_suffix}"]
        committee_membership = upsert(
            CommitteeMembership,
            {"committee": committees[committee_name], "member": member},
            {
                "role_name": role_name,
                "status": "active",
                "start_date": committees[committee_name].formed_on,
                "notes": "Seeded demo committee membership.",
            },
        )

    cooperative_specs = [
        ("Demo Farmers Cooperative", "agriculture", date(2024, 4, 5)),
        ("Demo Craft Cooperative", "crafts", date(2024, 5, 6)),
    ]
    cooperatives = {}
    for name, cooperative_type, formed_on in cooperative_specs:
        cooperatives[name] = upsert(
            Cooperative,
            {"community": community, "name": name},
            {
                "cooperative_type": cooperative_type,
                "status": "active",
                "description": "Seeded demo cooperative for MVP workflow testing.",
                "formed_on": formed_on,
            },
        )

    cooperative_membership_specs = [
        ("Demo Farmers Cooperative", "001", "Treasurer"),
        ("Demo Farmers Cooperative", "004", "Chairperson"),
        ("Demo Farmers Cooperative", "007", "Member"),
        ("Demo Farmers Cooperative", "010", "Member"),
        ("Demo Craft Cooperative", "002", "Secretary"),
        ("Demo Craft Cooperative", "005", "Chairperson"),
        ("Demo Craft Cooperative", "011", "Member"),
    ]
    cooperative_membership = None
    for cooperative_name, member_suffix, role_name in cooperative_membership_specs:
        member = members[f"KWDT-DEMO-MEM-{member_suffix}"]
        cooperative_membership = upsert(
            CooperativeMembership,
            {"cooperative": cooperatives[cooperative_name], "member": member},
            {
                "role_name": role_name,
                "status": "active",
                "start_date": cooperatives[cooperative_name].formed_on,
                "notes": "Seeded demo cooperative membership.",
            },
        )

    areas = {area.code: area for area in ThematicArea.objects.all()}
    resource_specs = [
        (
            "Demo Irrigation Pump",
            ResourcePartyType.GROUP,
            groups["KWDT-DEMO-GRP"],
            ResourceType.MACHINERY,
            ResourceStatus.ACTIVE,
            1,
            "unit",
            2500000,
            date(2024, 6, 1),
            [(areas["ECON"], True), (areas["WASH"], False)],
        ),
        (
            "School Water Storage Tank",
            ResourcePartyType.INSTITUTION,
            institutions["KWDT-DEMO-INS"],
            ResourceType.OTHER,
            ResourceStatus.ACTIVE,
            1,
            "tank",
            1800000,
            date(2024, 6, 20),
            [(areas["WASH"], True), (areas["EDU"], False)],
        ),
        (
            "Goat Rearing Starter Kit",
            ResourcePartyType.MEMBER,
            members["KWDT-DEMO-MEM-004"],
            ResourceType.LIVESTOCK,
            ResourceStatus.ACTIVE,
            6,
            "goats",
            900000,
            date(2024, 7, 10),
            [(areas["ECON"], True)],
        ),
        (
            "Cooperative Seed Grant",
            ResourcePartyType.COOPERATIVE,
            cooperatives["Demo Farmers Cooperative"],
            ResourceType.GRANT,
            ResourceStatus.ACTIVE,
            1,
            "grant",
            3500000,
            date(2024, 7, 25),
            [(areas["ECON"], True), (areas["ENV"], False)],
        ),
        (
            "Community Center Roofing Materials",
            ResourcePartyType.COMMUNITY,
            community,
            ResourceType.BUILDING_MATERIAL,
            ResourceStatus.PLANNED,
            60,
            "sheets",
            4200000,
            date(2024, 8, 12),
            [(areas["EDU"], True)],
        ),
        (
            "Craft Cooperative Sewing Machines",
            ResourcePartyType.COOPERATIVE,
            cooperatives["Demo Craft Cooperative"],
            ResourceType.TOOL,
            ResourceStatus.ACTIVE,
            4,
            "machines",
            3200000,
            date(2024, 8, 30),
            [(areas["ECON"], True), (areas["EDU"], False)],
        ),
    ]
    resources = {}
    for index, spec in enumerate(resource_specs, start=1):
        name, owner_type, owner, resource_type, status = spec[:5]
        quantity, unit, value_amount, acquired_on, thematic_links = spec[5:]
        resource = upsert(
            Resource,
            {"community": community, "name": name},
            {
                "owner_type": owner_type,
                "owner_id": owner.id,
                "resource_type": resource_type,
                "description": f"{name} seeded for MVP workflow testing.",
                "quantity": quantity,
                "unit": unit,
                "value_amount": value_amount,
                "value_currency": "UGX",
                "acquired_on": acquired_on,
                "status": status,
                "location_text": "Seeded community resource location.",
                "serial_or_tag_number": f"KWDT-DEMO-RES-{index:03d}",
                "source_notes": "Seeded for local development demos.",
            },
        )
        resources[name] = resource
        for thematic_area, is_primary in thematic_links:
            upsert(
                ResourceThematicArea,
                {"resource": resource, "thematic_area": thematic_area},
                {"is_primary": is_primary},
            )

    north_resource = upsert(
        Resource,
        {"community": north_community, "name": "Northern Clinic Solar Kit"},
        {
            "owner_type": ResourcePartyType.INSTITUTION,
            "owner_id": north_institution.id,
            "resource_type": ResourceType.OTHER,
            "description": "Small solar kit for clinic lighting.",
            "quantity": 1,
            "unit": "kit",
            "value_amount": 1500000,
            "value_currency": "UGX",
            "acquired_on": date(2024, 9, 5),
            "status": ResourceStatus.ACTIVE,
            "location_text": "Installed at Northern Demo Clinic.",
            "serial_or_tag_number": "KWDT-NORTH-SOLAR-01",
            "source_notes": "Second-community resource for scoped filtering checks.",
        },
    )
    upsert(
        ResourceThematicArea,
        {"resource": north_resource, "thematic_area": areas["EDU"]},
        {"is_primary": True},
    )

    beneficiary_specs = [
        ("Demo Irrigation Pump", ResourcePartyType.INSTITUTION, institutions["KWDT-DEMO-INS"]),
        ("Demo Irrigation Pump", ResourcePartyType.GROUP, groups["KWDT-DEMO-WASH"]),
        ("School Water Storage Tank", ResourcePartyType.INSTITUTION, institutions["KWDT-DEMO-INS"]),
        ("School Water Storage Tank", ResourcePartyType.MEMBER, members["KWDT-DEMO-MEM-009"]),
        ("Goat Rearing Starter Kit", ResourcePartyType.MEMBER, members["KWDT-DEMO-MEM-004"]),
        ("Cooperative Seed Grant", ResourcePartyType.COOPERATIVE, cooperatives["Demo Farmers Cooperative"]),
        ("Community Center Roofing Materials", ResourcePartyType.COMMUNITY, community),
        ("Craft Cooperative Sewing Machines", ResourcePartyType.COOPERATIVE, cooperatives["Demo Craft Cooperative"]),
        ("Craft Cooperative Sewing Machines", ResourcePartyType.INSTITUTION, institutions["KWDT-DEMO-CC"]),
    ]
    beneficiary = None
    for index, (resource_name, beneficiary_type, target) in enumerate(beneficiary_specs):
        relationship_type = (
            BeneficiaryRelationshipType.PRIMARY
            if index % 3 != 0
            else BeneficiaryRelationshipType.SECONDARY
        )
        beneficiary = upsert(
            ResourceBeneficiary,
            {
                "resource": resources[resource_name],
                "beneficiary_type": beneficiary_type,
                "beneficiary_id": target.id,
            },
            {
                "relationship_type": relationship_type,
                "notes": "Seeded demo resource beneficiary.",
            },
        )

    status_event_specs = [
        ("Demo Irrigation Pump", ResourceEventType.APPROVED, date(2024, 5, 20)),
        ("Demo Irrigation Pump", ResourceEventType.DELIVERED, date(2024, 6, 5)),
        ("Demo Irrigation Pump", ResourceEventType.IN_USE, date(2024, 6, 10)),
        ("School Water Storage Tank", ResourceEventType.DELIVERED, date(2024, 6, 23)),
        ("School Water Storage Tank", ResourceEventType.IN_USE, date(2024, 7, 2)),
        ("Goat Rearing Starter Kit", ResourceEventType.DELIVERED, date(2024, 7, 12)),
        ("Cooperative Seed Grant", ResourceEventType.APPROVED, date(2024, 7, 20)),
        ("Cooperative Seed Grant", ResourceEventType.IN_USE, date(2024, 8, 1)),
        (
            "Community Center Roofing Materials",
            ResourceEventType.PROCUREMENT_STARTED,
            date(2024, 8, 15),
        ),
        ("Craft Cooperative Sewing Machines", ResourceEventType.DELIVERED, date(2024, 9, 3)),
        ("Craft Cooperative Sewing Machines", ResourceEventType.IN_USE, date(2024, 9, 9)),
    ]
    status_event = None
    for resource_name, event_type, event_date in status_event_specs:
        status_event = upsert(
            ResourceStatusEvent,
            {
                "resource": resources[resource_name],
                "event_type": event_type,
                "effective_at": datetime(
                    event_date.year,
                    event_date.month,
                    event_date.day,
                    9,
                    0,
                    tzinfo=timezone.utc,
                ),
            },
            {"notes": f"{resource_name} status changed to {event_type}."},
        )

    impact_specs = [
        ("Demo Irrigation Pump", ResourcePartyType.MEMBER, members["KWDT-DEMO-MEM-001"], "monthly", date(2024, 7, 1), 18, 12, 18, 1),
        ("Demo Irrigation Pump", ResourcePartyType.GROUP, groups["KWDT-DEMO-WASH"], "monthly", date(2024, 8, 1), 32, 21, 29, 1),
        ("School Water Storage Tank", ResourcePartyType.INSTITUTION, institutions["KWDT-DEMO-INS"], "monthly", date(2024, 8, 1), 245, 0, 0, 1),
        ("Goat Rearing Starter Kit", ResourcePartyType.MEMBER, members["KWDT-DEMO-MEM-004"], "quarterly", date(2024, 10, 1), 7, 1, 1, 0),
        ("Cooperative Seed Grant", ResourcePartyType.COOPERATIVE, cooperatives["Demo Farmers Cooperative"], "quarterly", date(2024, 10, 1), 48, 32, 20, 0),
        ("Craft Cooperative Sewing Machines", ResourcePartyType.COOPERATIVE, cooperatives["Demo Craft Cooperative"], "monthly", date(2024, 10, 1), 16, 10, 12, 1),
        ("Community Center Roofing Materials", "", None, "milestone", date(2024, 9, 1), 120, 75, 0, 2),
    ]
    impact_record = None
    for spec in impact_specs:
        resource_name, beneficiary_type, target, period_type, as_of_date = spec[:5]
        beneficiary_count, household_count, member_count, institution_count = spec[5:]
        period_start = date(as_of_date.year, max(as_of_date.month - 1, 1), 1)
        period_end = date(as_of_date.year, as_of_date.month, 1)
        impact_record = upsert(
            ImpactRecord,
            {
                "resource": resources[resource_name],
                "period_type": period_type,
                "as_of_date": as_of_date,
                "beneficiary_type": beneficiary_type,
                "beneficiary_id": target.id if target else None,
            },
            {
                "period_start": period_start,
                "period_end": period_end,
                "beneficiary_count": beneficiary_count,
                "household_count": household_count,
                "member_count": member_count,
                "institution_count": institution_count,
                "notes": "Seeded demo impact record.",
                "method": ImpactMethod.OBSERVED,
            },
        )

    approval_specs = [
        (
            "resource",
            resources["Demo Irrigation Pump"].id,
            ApprovalActionType.UPDATE,
            {"status": "active"},
            {"status": ["planned", "active"]},
        ),
        (
            "resource",
            resources["Community Center Roofing Materials"].id,
            ApprovalActionType.UPDATE,
            {"status": "active", "location_text": "Delivered to center."},
            {"status": ["planned", "active"]},
        ),
        (
            "impact_record",
            impact_record.id,
            ApprovalActionType.CREATE,
            {
                "resource": impact_record.resource_id,
                "beneficiary_count": impact_record.beneficiary_count,
            },
            {"created": True},
        ),
    ]
    approval_request = None
    for entity_type, entity_id, action_type, payload, diff_summary in approval_specs:
        approval_request = upsert(
            ApprovalRequest,
            {
                "community": community,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "action_type": action_type,
            },
            {
                "submitted_payload": payload,
                "diff_summary": diff_summary,
                "review_notes": "",
            },
        )

    group = groups["KWDT-DEMO-GRP"]
    member = members["KWDT-DEMO-MEM-001"]
    institution = institutions["KWDT-DEMO-INS"]
    committee = committees["Demo Oversight Committee"]
    cooperative = cooperatives["Demo Farmers Cooperative"]
    resource = resources["Demo Irrigation Pump"]

    return {
        "created": created,
        "updated": updated,
        "community_count": Community.objects.count(),
        "group_count": Group.objects.count(),
        "member_count": Member.objects.count(),
        "institution_count": Institution.objects.count(),
        "committee_count": Committee.objects.count(),
        "cooperative_count": Cooperative.objects.count(),
        "resource_count": Resource.objects.count(),
        "impact_record_count": ImpactRecord.objects.count(),
        "community_id": community.id,
        "group_id": group.id,
        "member_id": member.id,
        "institution_id": institution.id,
        "committee_id": committee.id,
        "committee_membership_id": committee_membership.id,
        "cooperative_id": cooperative.id,
        "cooperative_membership_id": cooperative_membership.id,
        "resource_id": resource.id,
        "resource_beneficiary_id": beneficiary.id,
        "resource_status_event_id": status_event.id,
        "impact_record_id": impact_record.id,
        "approval_request_id": approval_request.id,
        "user_count": get_user_model().objects.count(),
        "invitation_count": UserInvitation.objects.count(),
    }
