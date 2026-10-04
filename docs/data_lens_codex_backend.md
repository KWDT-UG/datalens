# Data Lens Backend Build Handoff for Codex

## 1. Purpose

This document is the implementation handoff for using Codex to begin backend development for **Data Lens** with minimal human oversight.

It is written to help an agent:

- scaffold the repository correctly
- generate a Django backend foundation
- implement the MVP backend in coherent milestones
- avoid blocked work when some product and architecture details are still unresolved
- know what is fixed, what is assumed, and what must be deferred

This document is intentionally opinionated. Where product decisions are already clear, they are treated as requirements. Where decisions are not yet finalized, the agent should follow the default assumptions in this document unless explicitly overridden later.

---

## 2. Project summary

**Product name:** Data Lens  
**Context:** Internal data management system for structured community data  
**Primary users:** Field Officers, Program Managers, Admins, Leadership  
**Primary goal:** Track communities, groups, members, institutions, committees, cooperatives, resources, approvals, and impact in a system that supports intermittent connectivity.

### Core product principles

- Community is the top-level operational boundary.
- Groups organize primary membership within a community.
- Members belong to one group in MVP.
- Institutions belong directly to communities, not groups.
- Committees and cooperatives are community-level structures with member participation.
- Resources belong to a community and can be owned by or assigned to different entity types in that community.
- Resource history is event-based.
- Impact is time-based.
- Approval workflows are part of MVP.
- Donor support is **out of scope** for backend v1.

---

## 3. MVP scope boundary

The backend MVP must support:

- communities
- groups
- members
- institutions
- committees
- committee memberships
- cooperatives
- cooperative memberships
- thematic areas
- resources
- resource beneficiaries
- resource status history
- impact records
- approval requests

The backend MVP does **not** include:

- donors
- donor attribution or donor reporting
- advanced analytics
- mapping/GIS
- real-time collaboration
- mobile-native app backend specialization
- external integrations unless explicitly requested later

---

## 4. Fixed product decisions

These decisions are considered settled for v1 and should be treated as implementation requirements.

### 4.1 Community model

- Community is the top-level boundary for operational data.
- Most records belong directly or indirectly to exactly one community.

### 4.2 Membership model

- A Member belongs to exactly one Group in MVP.
- A Member may participate in multiple Committees and multiple Cooperatives.
- Committee participation and Cooperative participation must use explicit join tables.

### 4.3 Institution model

- Institution is an MVP core entity.
- Institution belongs directly to a Community.
- Institution is **not** a Member and is **not** part of the Group hierarchy.
- Institution can own or receive Resources.
- Institution must be supported in impact reporting.

### 4.4 Resource model

- Resource belongs to one Community.
- Resource has one current owner/assignee for MVP.
- Resource owner may be one of: Community, Group, Cooperative, Member, Institution.
- Resource may have one or more beneficiaries.
- Resource beneficiary must be modeled separately from resource owner.
- Resource must support many-to-many classification with Thematic Areas.

### 4.5 History and reporting model

- Resource status changes are stored as timestamped events.
- Impact is stored as time-based records.
- Impact records may optionally reference a specific beneficiary.

### 4.6 Approvals

- ApprovalRequest is part of MVP.
- Proposed changes may be queued and reviewed.
- The backend must support approval records even if some approval workflow details remain configurable.

### 4.7 Scope control

- Donor support is excluded from backend v1.
- Do not create donor models, donor endpoints, or donor-related abstractions.

---

## 5. Unresolved items and default implementation assumptions

The following items are not fully finalized. Codex should not block on them.

### 5.1 Full tech stack choices

Not every tool choice has been finalized.

#### Default assumption

Use:

- Python 3.12
- Django 5.x
- Django REST Framework
- PostgreSQL
- unittest
- Docker and docker compose
- Ruff for linting
- Black for formatting
- mypy optional but preferred if it does not slow initial progress too much

If one exact version is needed, use current stable versions that work cleanly together.

### 5.2 Offline sync behavior

Offline support is a product requirement, but the full sync contract is not yet finalized.

#### Default assumption

Implement the backend so it is **offline-aware**, not fully offline-complete.

That means:

- include common sync fields such as `client_created_at`, `client_updated_at`, `sync_version`, `is_deleted`
- support idempotent write patterns where practical
- allow `client_mutation_id` in create/update endpoints
- structure models and APIs so sync conflict handling can be layered in later
- do **not** overbuild a full sync engine yet

### 5.3 Approval policy details

The exact rule for which actions require approval by role is not finalized.

#### Default assumption

Implement ApprovalRequest as a first-class model and API surface, but do not hard-wire every mutation behind approval yet.

Use this temporary rule:

- support direct writes for Admin
- support ApprovalRequest submission for all major mutable entities
- keep approval enforcement configurable in code rather than deeply coupled to every serializer or model

### 5.4 Authentication and RBAC details

Exact auth strategy is not yet finalized.

#### Default assumption

Build in a way that can support role-based permissions later.

For initial scaffold:

- use Django auth user model or a custom user model only if needed early
- add role placeholders for `field_officer`, `program_manager`, `admin`, `leadership`
- avoid deep custom auth logic in the first pass

### 5.5 File storage / media

Not yet a major requirement.

#### Default assumption

Prepare for local/dev media storage only. Do not build a complex document storage system yet.

---

## 6. Repository structure Codex should create

Codex should scaffold the repository in a way that is immediately usable by both humans and future agent runs.

### Target structure

```text
data-lens/
├── README.md
├── AGENTS.md
├── .gitignore
├── .env.example
├── docker-compose.yml
├── docs/
│   ├── backend-build-handoff.md
│   ├── data-model-spec.md
│   ├── api-contract.md
│   ├── permissions-todo.md
│   └── offline-sync-todo.md
├── backend/
│   ├── manage.py
│   ├── pyproject.toml
│   ├── unittest.ini
│   ├── Dockerfile
│   ├── requirements/
│   │   ├── base.txt
│   │   ├── dev.txt
│   │   └── prod.txt
│   ├── config/
│   │   ├── __init__.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   ├── asgi.py
│   │   └── settings/
│   │       ├── __init__.py
│   │       ├── base.py
│   │       ├── dev.py
│   │       └── prod.py
│   ├── apps/
│   │   ├── common/
│   │   ├── communities/
│   │   ├── groups/
│   │   ├── members/
│   │   ├── institutions/
│   │   ├── committees/
│   │   ├── cooperatives/
│   │   ├── thematic_areas/
│   │   ├── resources/
│   │   ├── impact/
│   │   └── approvals/
│   └── tests/
│       ├── factories/
│       ├── integration/
│       └── unit/
└── scripts/
    ├── bootstrap.sh
    └── run-dev.sh
```

### Repository rules

- Put all implementation-specific backend code under `/backend`.
- Put all human-readable design and handoff material under `/docs`.
- Put explicit agent instructions in `AGENTS.md`.
- Keep the repo legible and boring. Prefer clarity over cleverness.

---

## 7. AGENTS.md requirements

Codex should create a strong `AGENTS.md` file at the repository root.

It must include:

- repo layout
- how to install dependencies
- how to run the backend locally
- how to run linting and tests
- coding conventions
- migration rules
- app ownership boundaries
- what “done” means for a task
- explicit do-not rules

### Required do-not rules

- do not add donor functionality
- do not invent frontend work unless asked
- do not add features outside the MVP scope
- do not silently change model semantics from the handoff docs
- do not skip tests for model relationships and API validation
- do not introduce Celery, Redis, Kafka, or other infrastructure unless specifically justified and documented

---

## 8. Backend architecture Codex should assume

### 8.1 High-level architecture

Use a standard service split:

- web API service: Django + DRF
- database: PostgreSQL
- local development: docker compose

### 8.2 Django organization

Use multiple domain apps rather than one giant app.

Recommended apps:

- `common`
- `communities`
- `groups`
- `members`
- `institutions`
- `committees`
- `cooperatives`
- `thematic_areas`
- `resources`
- `impact`
- `approvals`

### 8.3 Shared model utilities

Create reusable base abstractions in `common` for:

- timestamp fields
- optional sync metadata fields
- soft delete support
- common model mixins
- shared validators if appropriate

---

## 9. Data model Codex should implement

Codex should implement these primary models.

### 9.1 Community

Suggested fields:

- id
- code
- name
- subcounty_name
- district_name
- region_name
- country
- resident_count
- status
- notes
- created_at
- updated_at
- created_by_user_id
- updated_by_user_id
- client_created_at
- client_updated_at
- sync_version
- is_deleted

### 9.2 Group

Suggested fields:

- id
- community (FK)
- code
- name
- status
- formed_on
- closed_on
- meeting_day
- notes
- common metadata fields

Constraints:

- unique `(community, name)`
- unique `(community, code)`

### 9.3 Member

Suggested fields:

- id
- community (FK)
- group (FK)
- member_number
- first_name
- last_name
- middle_name
- preferred_name
- gender
- date_of_birth
- phone
- email
- address_text
- status
- joined_on
- left_on
- deceased_on
- notes
- common metadata fields

Rules:

- group community must equal member community
- deceased members cannot be active
- left date cannot be before joined date

### 9.4 Institution

Suggested fields:

- id
- community (FK)
- code
- name
- institution_type
- status
- contact_name
- phone
- email
- location_text
- notes
- common metadata fields

Constraints:

- unique `(community, name)`
- unique `(community, code)` when not null

### 9.5 Committee

Suggested fields:

- id
- community (FK)
- name
- committee_type
- status
- description
- formed_on
- closed_on
- common metadata fields

### 9.6 CommitteeMembership

Suggested fields:

- id
- committee (FK)
- member (FK)
- role_name
- status
- start_date
- end_date
- notes
- common metadata fields

Rules:

- member and committee must belong to same community
- no duplicate active membership for the same member and committee

### 9.7 Cooperative

Suggested fields:

- id
- community (FK)
- name
- cooperative_type
- status
- description
- formed_on
- closed_on
- common metadata fields

### 9.8 CooperativeMembership

Suggested fields:

- id
- cooperative (FK)
- member (FK)
- role_name
- status
- start_date
- end_date
- notes
- common metadata fields

Rules:

- member and cooperative must belong to same community
- no duplicate active membership for same member and cooperative

### 9.9 ThematicArea

Suggested fields:

- id
- code
- name
- description
- status
- common metadata fields

This is global, not community-specific.

### 9.10 Resource

Suggested fields:

- id
- community (FK)
- owner_type
- owner_id
- resource_type
- name
- description
- quantity
- unit
- value_amount
- value_currency
- acquired_on
- status
- location_text
- serial_or_tag_number
- source_notes
- common metadata fields

Owner types:

- community
- group
- cooperative
- member
- institution

Rules:

- owner must resolve to an entity in the same community
- exactly one current owner in MVP

### 9.11 ResourceBeneficiary

Suggested fields:

- id
- resource (FK)
- beneficiary_type
- beneficiary_id
- relationship_type
- notes
- common metadata fields

Beneficiary types:

- community
- group
- member
- cooperative
- institution

Rules:

- beneficiary must resolve to same community as resource
- support one or more beneficiaries

### 9.12 ResourceThematicArea

Suggested fields:

- id
- resource (FK)
- thematic_area (FK)
- is_primary
- common metadata fields

Constraint:

- unique `(resource, thematic_area)`

### 9.13 ResourceStatusEvent

Suggested fields:

- id
- resource (FK)
- event_type
- effective_at
- notes
- recorded_by_user_id
- common metadata fields

### 9.14 ImpactRecord

Suggested fields:

- id
- resource (FK)
- beneficiary_type
- beneficiary_id
- period_type
- period_start
- period_end
- as_of_date
- beneficiary_count
- household_count
- member_count
- institution_count
- notes
- method
- recorded_by_user_id
- common metadata fields

### 9.15 ApprovalRequest

Suggested fields:

- id
- community (FK, nullable)
- entity_type
- entity_id
- action_type
- submitted_payload (JSON)
- diff_summary (JSON, nullable)
- status
- submitted_by_user_id
- submitted_at
- reviewed_by_user_id
- reviewed_at
- review_notes
- applied_at
- common metadata fields where relevant

---

## 10. Enumerations Codex should define

Use controlled enums, preferably via Django `TextChoices`.

### Record status

- active
- inactive
- archived

### Member status

- active
- inactive
- deceased
- exited

### Institution type

- school
- church
- clinic
- community_center
- cooperative_partner
- other

### Resource owner type

- community
- group
- cooperative
- member
- institution

### Resource beneficiary type

- community
- group
- member
- cooperative
- institution

### Beneficiary relationship type

- primary
- secondary
- indirect

### Resource type

- livestock
- tool
- machinery
- land_plot
- grant
- cash_asset
- building_material
- other

### Resource status

- planned
- active
- inactive
- transferred
- disposed

### Resource event type

- created
- application_submitted
- approved
- procurement_started
- delivered
- in_use
- maintenance
- completed
- transferred
- disposed
- other

### Impact method

- observed
- estimated
- derived

### Approval status

- pending
- approved
- rejected
- superseded

### Approval action type

- create
- update
- delete

---

## 11. API surface Codex should scaffold

Base path:

```text
/api/v1/
```

### CRUD resources

Create DRF routes for:

- communities
- groups
- members
- institutions
- committees
- committee-memberships
- cooperatives
- cooperative-memberships
- thematic-areas
- resources
- resource-beneficiaries
- impact-records
- approval-requests

### Nested or specialized routes

Also provide routes for:

- `GET /communities/{id}/summary`
- `GET /communities/{id}/groups`
- `GET /communities/{id}/institutions`
- `GET /groups/{id}/members`
- `GET /committees/{id}/memberships`
- `GET /cooperatives/{id}/memberships`
- `GET /resources/{id}/beneficiaries`
- `POST /resources/{id}/beneficiaries`
- `GET /resources/{id}/status-events`
- `POST /resources/{id}/status-events`
- `GET /resources/{id}/impact-records`
- `POST /approval-requests/{id}/approve`
- `POST /approval-requests/{id}/reject`

### API behavior requirements

- Use JSON only.
- Support pagination on list endpoints.
- Support basic filtering on list endpoints.
- Use serializer validation for cross-community integrity rules.
- Provide clean error messages for invalid relationships.
- Leave advanced auth enforcement lightweight in the first pass.

---

## 12. Testing requirements

Codex must create tests from the beginning.

### Minimum model tests

- community/group uniqueness
- member must belong to group in same community
- committee membership cross-community invalidation
- cooperative membership cross-community invalidation
- resource owner community validation
- resource beneficiary community validation
- resource thematic area uniqueness
- member status date validation

### Minimum API tests

- create/list/get/update for core entities
- invalid group/community member creation rejected
- invalid resource beneficiary rejected
- approval request create/list works
- approval approve/reject endpoints work at basic level

### Minimum integration tests

- create community → group → member chain
- create institution → resource owned by institution → resource beneficiary assigned
- create resource → add status event → add impact record

---

## 13. What Codex should build first

Codex should work in milestones.

### Milestone 1: Repository and project bootstrap

Deliver:

- repository structure
- README
- AGENTS.md
- docs placeholders
- Django project scaffold
- docker compose
- base settings split
- lint/test tooling

### Milestone 2: Core domain models and migrations

Deliver:

- base mixins
- all core models
- enums
- migrations
- admin registrations

### Milestone 3: Basic API scaffold

Deliver:

- serializers
- viewsets or API views
- routers
- pagination
- filtering
- basic validation

### Milestone 4: Relationship validation and tests

Deliver:

- service/serializer validation for cross-community integrity
- unit tests
- integration tests

### Milestone 5: Resource history, impact, and approvals

Deliver:

- ResourceStatusEvent endpoints
- ImpactRecord endpoints
- ApprovalRequest endpoints
- approve/reject actions

### Milestone 6: Documentation polish

Deliver:

- final README usage instructions
- updated docs with actual commands
- implementation notes for unresolved items

---

## 14. README requirements

Codex should generate a practical `README.md` that covers:

- what Data Lens backend is
- prerequisites
- how to run locally with docker compose
- how to run migrations
- how to create a superuser
- how to run tests
- how to run linting
- repo structure summary
- current MVP scope

The README should be short enough to use quickly, but complete enough for a fresh engineer to get running.

---

## 15. Implementation style rules

Codex should follow these rules while generating code.

### Code style

- prefer explicitness over abstraction
- keep files readable
- avoid premature generic frameworks
- avoid hidden magic in model save methods
- keep business validation in serializers/services where practical
- prefer small, composable helpers

### Django style

- use DRF serializers and viewsets unless a simpler APIView is cleaner for custom actions
- keep app responsibilities narrow
- avoid circular imports by keeping cross-domain lookups simple
- use database constraints where possible, serializer validation where necessary

### Documentation style

- update docs as implementation choices become concrete
- note assumptions when a decision is temporary
- do not remove unresolved items; track them visibly

---

## 16. Explicit non-goals

Codex must not do the following unless explicitly requested:

- build donor models or donor APIs
- build frontend pages
- implement a full offline sync engine
- add background workers or queues
- introduce event buses
- add audit logging infrastructure beyond basic model metadata
- implement advanced analytics/report builders
- optimize for scale beyond sensible MVP practices

---

## 17. Definition of done for initial backend kickoff

The backend is ready for active feature development once the following are complete:

- repository scaffold exists and is clean
- local development works via docker compose
- Django project runs successfully
- migrations apply successfully
- all core MVP models exist
- basic CRUD API exists for the main entities
- resource beneficiary, resource status event, impact record, and approval request flows exist
- basic tests pass
- README and AGENTS.md are present and usable

---

## 18. Suggested first Codex task list

If Codex is being used iteratively, start with these prompts/tasks in order.

### Task 1

Create the repository scaffold, `README.md`, `AGENTS.md`, `/docs`, `/backend`, Python/Django tooling, and docker compose for a Django + DRF + Postgres project.

### Task 2

Create the Django settings structure, common base mixins, and domain app skeletons.

### Task 3

Implement the core models and enums with migrations for Community, Group, Member, Institution, Committee, CommitteeMembership, Cooperative, CooperativeMembership, ThematicArea, Resource, ResourceBeneficiary, ResourceThematicArea, ResourceStatusEvent, ImpactRecord, and ApprovalRequest.

### Task 4

Implement DRF serializers, viewsets, and routers for core CRUD and specialized routes.

### Task 5

Add model and API tests for relationship validation and core happy paths.

### Task 6

Tighten README and docs so a second agent can continue without reinterpreting the project.

---

## 19. Human review checkpoints

Even with minimal human oversight, these are the recommended checkpoints:

- after repository scaffold
- after model/migration generation
- after first CRUD API pass
- after validations/tests are added
- before starting deeper RBAC or offline-specific work

If a checkpoint is skipped, Codex should continue, but it should leave clear notes in `/docs` about any assumptions it made.

---

## 20. Final instruction to Codex

Build the backend foundation for Data Lens as a clean, maintainable Django + DRF repository that matches this handoff.

Do not wait for unresolved details if they do not block core MVP structure.

When something is unclear:

1. prefer the simplest implementation that preserves future flexibility
2. document the assumption in `/docs`
3. continue making progress
4. do not expand scope beyond the MVP defined here
