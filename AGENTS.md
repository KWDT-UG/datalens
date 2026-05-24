# AGENTS.md

## Purpose

This repository contains the MVP backend for **KWDT Data Lens**, a community/resource management system.

This file tells coding agents exactly how to work in this repository with minimal human oversight.

Primary goals for the MVP backend:
- implement the backend domain model
- expose a practical REST API
- support approval-aware workflows
- preserve resource history and impact records
- prepare the system for later offline-first behavior without blocking initial backend development

This repository should prioritize correctness, clarity, testability, and incremental delivery over premature complexity.

---

## Product summary

Data Lens manages structured information about:

- communities
- groups
- members
- institutions
- committees
- cooperatives
- resources
- thematic areas
- approvals
- impact records

Core business rules:
- `Community` is the top-level boundary
- `Group` belongs to a `Community`
- `Member` belongs to exactly one `Group` in MVP
- `Institution` belongs directly to a `Community`
- `Institution` is a first-class MVP beneficiary entity
- `Committee` and `Cooperative` belong to a `Community`
- a `Member` may participate in multiple committees and cooperatives
- a `Resource` belongs to a `Community`
- a `Resource` has one current owner
- a `Resource` may have one or more beneficiaries
- `ResourceStatusEvent` preserves status history
- `ImpactRecord` preserves time-based impact
- `ApprovalRequest` stores proposed changes that require review

Out of scope for this backend v1:
- donor support
- advanced analytics
- GIS mapping
- real-time collaboration
- final offline sync implementation
- frontend/PWA implementation

---

## Source of truth for implementation

When there is a conflict, use this order of precedence:

1. repository docs in `/docs`
2. this `AGENTS.md`
3. existing code and tests
4. inferred assumptions

Do not invent new product behavior when an ambiguity can be safely deferred.

If something is unresolved but non-blocking:
- choose the simplest implementation that preserves future flexibility
- document the assumption in code comments and in `/docs/implementation-notes.md`

---

## Repository expectations

Expected repository layout:

```text
/
├─ README.md
├─ AGENTS.md
├─ .gitignore
├─ .env.example
├─ docker-compose.yml
├─ docs/
│  ├─ backend-development-handoff.md
│  ├─ backend-data-model-spec-v1.md
│  ├─ api-contract-v1.md
│  ├─ permissions-matrix.md
│  └─ implementation-notes.md
├─ backend/
│  ├─ manage.py
│  ├─ pyproject.toml
│  ├─ requirements/
│  ├─ config/
│  ├─ apps/
│  │  ├─ communities/
│  │  ├─ groups/
│  │  ├─ members/
│  │  ├─ institutions/
│  │  ├─ committees/
│  │  ├─ cooperatives/
│  │  ├─ thematic_areas/
│  │  ├─ resources/
│  │  ├─ impacts/
│  │  ├─ approvals/
│  │  └─ common/
│  └─ tests/
└─ scripts/
```

If the repository does not yet match this structure, create it incrementally and safely.

Do not introduce unrelated folders or large framework churn unless required.

---

## Technology defaults

Use these defaults unless the repository already specifies otherwise:

### Backend
- Python 3.12
- Django 5.x
- Django REST Framework
- PostgreSQL
- Django's built-in `unittest`-based test framework

### Packaging and tooling
Prefer:
- `pyproject.toml` for Python project configuration
- `pytest` for tests
- `ruff` for linting/formatting if added
- simple requirements files only if pyproject-based dependency management is not practical

### Containers
Use:
- Docker for backend service
- Docker Compose for local development with PostgreSQL

### API style
- REST JSON API
- `/api/v1/...`
- predictable CRUD routes
- filterable list endpoints
- explicit nested endpoints where helpful

Do not introduce GraphQL.
Do not introduce Celery, Redis, Kafka, or event buses unless specifically required by an accepted milestone.

---

## Architecture constraints

Use a modular Django layout.

Recommended Django project structure:
- `config/` for settings, urls, ASGI/WSGI
- `apps/common/` for shared mixins, base models, utilities
- one app per domain area where practical

Keep apps cohesive. Do not split into too many micro-apps too early.

### Recommended domain app boundaries

- `communities`
- `groups`
- `members`
- `institutions`
- `committees`
- `cooperatives`
- `thematic_areas`
- `resources`
- `impacts`
- `approvals`
- `common`

Reasonable consolidations are allowed if they reduce complexity, but preserve clear domain boundaries.

---

## Domain model to implement

Implement these core models first.

### Community
Fields:
- id
- name
- area_name
- district_name
- region_name
- country
- status
- notes
- created_at
- updated_at
- created_by_user_id
- updated_by_user_id

### Group
Fields:
- id
- community_id
- code
- name
- status
- formed_on
- closed_on
- meeting_day
- notes
- created_at
- updated_at
- created_by_user_id
- updated_by_user_id

Constraints:
- unique `(community_id, name)`
- unique `(community_id, code)`

### Member
Fields:
- id
- community_id
- group_id
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
- created_at
- updated_at
- created_by_user_id
- updated_by_user_id

Rules:
- member's group must belong to same community
- member belongs to one current group in MVP

### Institution
Fields:
- id
- community_id
- code
- name
- institution_type
- status
- contact_name
- phone
- email
- location_text
- notes
- created_at
- updated_at
- created_by_user_id
- updated_by_user_id

Rules:
- institution is community-scoped
- institution can own resources
- institution can be a resource beneficiary

### Committee
Fields:
- id
- community_id
- name
- committee_type
- status
- description
- formed_on
- closed_on
- created_at
- updated_at
- created_by_user_id
- updated_by_user_id

### CommitteeMembership
Fields:
- id
- committee_id
- member_id
- role_name
- status
- start_date
- end_date
- notes
- created_at
- updated_at

Rules:
- member and committee must be in the same community
- prevent duplicate active memberships

### Cooperative
Fields:
- id
- community_id
- name
- cooperative_type
- status
- description
- formed_on
- closed_on
- created_at
- updated_at
- created_by_user_id
- updated_by_user_id

### CooperativeMembership
Fields:
- id
- cooperative_id
- member_id
- role_name
- status
- start_date
- end_date
- notes
- created_at
- updated_at

Rules:
- member and cooperative must be in the same community
- prevent duplicate active memberships

### ThematicArea
Fields:
- id
- code
- name
- description
- status
- created_at
- updated_at

### Resource
Fields:
- id
- community_id
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
- created_at
- updated_at
- created_by_user_id
- updated_by_user_id

Rules:
- owner types: `community | group | cooperative | member | institution`
- owner must belong to same community as resource

### ResourceBeneficiary
Fields:
- id
- resource_id
- beneficiary_type
- beneficiary_id
- relationship_type
- notes
- created_at

Rules:
- beneficiary types: `community | group | member | cooperative | institution`
- beneficiary must belong to same community as resource

### ResourceThematicArea
Fields:
- id
- resource_id
- thematic_area_id
- is_primary
- created_at

Constraint:
- unique `(resource_id, thematic_area_id)`

### ResourceStatusEvent
Fields:
- id
- resource_id
- event_type
- effective_at
- notes
- recorded_by_user_id
- created_at

Rule:
- preserve full status history

### ImpactRecord
Fields:
- id
- resource_id
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
- created_at
- updated_at

Rules:
- beneficiary is optional
- if set, must belong to same community as resource

### ApprovalRequest
Fields:
- id
- community_id
- entity_type
- entity_id
- action_type
- submitted_payload
- diff_summary
- status
- submitted_by_user_id
- submitted_at
- reviewed_by_user_id
- reviewed_at
- review_notes
- applied_at

Rule:
- stores proposed create/update/delete changes for review

---

## Common model conventions

Use shared abstract base models when helpful.

Recommended shared mixins:
- timestamp mixin
- audit mixin
- soft delete mixin if adopted
- sync metadata mixin if adopted

Recommended common fields where appropriate:
- `created_at`
- `updated_at`
- `created_by_user_id`
- `updated_by_user_id`
- `client_created_at`
- `client_updated_at`
- `sync_version`
- `is_deleted`

Do not over-engineer polymorphism. Prefer simple, explicit validation in serializers/services.

---

## API contract to implement

Base path:
- `/api/v1`

Required resource families:
- `/communities`
- `/groups`
- `/members`
- `/institutions`
- `/committees`
- `/committee-memberships`
- `/cooperatives`
- `/cooperative-memberships`
- `/thematic-areas`
- `/resources`
- `/resource-beneficiaries`
- `/resources/{id}/status-events`
- `/impact-records`
- `/approval-requests`

Also add useful nested/read endpoints:
- `/communities/{id}/summary`
- `/communities/{id}/groups`
- `/communities/{id}/institutions`
- `/groups/{id}/members`
- `/committees/{id}/memberships`
- `/cooperatives/{id}/memberships`
- `/resources/{id}/beneficiaries`
- `/resources/{id}/impact-records`
- `/resources/{id}/detail`

Mutations should support:
- create
- retrieve
- list
- partial update
- limited delete behavior where appropriate

Prefer soft-delete/archive semantics where product uncertainty exists.

---

## API implementation rules

Use Django REST Framework.

Recommended approach:
- serializers for validation and representation
- viewsets/routers for standard CRUD
- explicit API views/actions for approve/reject and specialized nested actions
- filtering using `django-filter` if added, otherwise lightweight custom filters

### Response conventions
Use a consistent JSON shape when practical:

```json
{
  "data": {},
  "meta": {},
  "errors": []
}
```

Do not get blocked if existing project conventions differ. Consistency matters more than perfect adherence.

### Validation examples to support
- group must match member community
- committee membership community consistency
- cooperative membership community consistency
- resource owner community consistency
- resource beneficiary community consistency
- no duplicate active committee membership
- no duplicate active cooperative membership

---

## Approval workflow defaults

Because some workflow details are still unresolved, use these safe defaults unless docs say otherwise:

- direct writes are allowed for initial scaffolding and core CRUD
- `ApprovalRequest` model and endpoints must exist in MVP
- approve/reject actions should update approval state only
- do not build a complicated automatic payload-application engine unless clearly required by current milestone
- keep approval application logic simple and explicit

If a write flow is ambiguous:
- implement direct CRUD first
- leave clear extension points for approval-gated workflows later

Do not block foundational backend work on unresolved approval policy details.

---

## Offline-related defaults

Offline behavior is important product-wise, but full sync behavior is not yet finalized.

Implement preparatory support only:

- allow `client_created_at`
- allow `client_updated_at`
- allow `client_mutation_id` on mutating endpoints if practical
- include `sync_version` if practical
- avoid hard-coding a final sync engine design
- document unresolved sync assumptions in `/docs/implementation-notes.md`

Do not implement a full offline queue processor in the backend unless explicitly requested.

The goal is backend readiness, not full offline completion.

---

## Permissions defaults

A full permissions matrix may not yet exist.

Until it does, use this practical default:

- authenticated access assumed for all endpoints
- staff/admin-only access can be applied to approval review actions
- keep permission classes modular and easy to replace
- do not hard-code role logic deeply into serializers or models

Structure code so role-based permissions can be layered in later with minimal refactor.

Recommended:
- centralize permission classes in a shared location
- use named permission classes rather than inline logic in views

---

## Testing requirements

All substantive backend work must include tests.

Testing stack:
- Django's built-in test framework
- Python `unittest`
- `django.test.TestCase` or `TransactionTestCase` where appropriate
- `subTest()` for matrix-style coverage across related cases

Minimum test coverage expectations for each new model/API area:
- model creation
- key validation rules
- list endpoint
- retrieve endpoint
- create endpoint
- update endpoint
- important edge case or invalid relationship

Priority tests:
- community/group/member relationship validation
- institution ownership/beneficiary cases
- committee/cooperative membership constraints
- resource owner validation
- resource beneficiary validation
- status event creation
- impact record creation
- approval request create/approve/reject endpoints

Testing style guidance:
- prefer table-driven test matrices using lists of case dictionaries/tuples
- iterate those cases with `self.subTest(...)`
- group closely related validation scenarios into one test method when it improves readability
- keep helper/builders lightweight and explicit
- prefer `setUpTestData()` for shared fixture creation where appropriate
- avoid overly abstract test utilities early in the project

Use Django's built-in test runner and Python `unittest`.
Prefer `subTest()` for matrix-style coverage.

Prefer reusable helpers/builders over repetitive fixture setup.
Use `subTest()` to cover input variations cleanly.

---

## Migration rules

- create migrations incrementally
- keep migrations readable
- avoid giant all-in-one schema dumps when working iteratively
- do not rewrite old migrations unless the repo is still pre-commit and explicitly allows it

Model rollout order:
1. Community
2. Group
3. Member
4. Institution
5. Committee
6. CommitteeMembership
7. Cooperative
8. CooperativeMembership
9. ThematicArea
10. Resource
11. ResourceBeneficiary
12. ResourceThematicArea
13. ResourceStatusEvent
14. ImpactRecord
15. ApprovalRequest

---

## Seed/reference data

Seed only what is needed for development and tests.

Reasonable initial seed data:
- thematic areas such as `WASH`, `Education`, `Environment`, `Economic Empowerment`
- minimal enum-aligned fixtures where useful

Do not embed large fake datasets in core migrations.
Use fixtures or factory-driven test data instead.

---

## Documentation requirements

When making meaningful implementation progress, update docs.

Keep these docs current:
- `/docs/implementation-notes.md`
- `/docs/backend-data-model-spec-v1.md`
- `/docs/api-contract-v1.md`

When an assumption is made because requirements are incomplete:
- record the assumption
- explain why it was chosen
- state whether it is likely to require later revision

---

## What not to do

Do not:
- add donor models
- add donor APIs
- add frontend code unless explicitly asked
- add mobile/PWA code
- add real-time collaboration features
- introduce complex async architecture
- introduce unnecessary abstractions
- optimize prematurely for scale beyond MVP needs
- create speculative phase-2 features

Keep the implementation aligned to MVP backend needs only.

---

## Milestones for Codex

### Milestone 1: Repository foundation
Create or align:
- top-level repo structure
- backend project scaffold
- docs placeholders
- pyproject / dependency config
- Dockerfile
- docker-compose
- env example
- Django test settings/configuration

### Milestone 2: Core schema
Implement:
- common base models/utilities
- community, group, member, institution
- migrations
- admin registration
- tests

### Milestone 3: Governance and participation
Implement:
- committee
- committee membership
- cooperative
- cooperative membership
- tests

### Milestone 4: Resource model
Implement:
- thematic areas
- resource
- resource beneficiary
- resource thematic area
- resource status event
- tests

### Milestone 5: Impact and approvals
Implement:
- impact record
- approval request
- approve/reject endpoints
- tests

### Milestone 6: API surface
Implement DRF endpoints for all MVP entities and key nested routes.

### Milestone 7: Hardening
Add:
- filter support
- better validation errors
- permission extension points
- implementation notes
- API smoke tests

---

## Definition of done

A milestone is done only when all of the following are true:

- code runs locally
- migrations apply cleanly
- tests for the milestone pass
- endpoints are wired and routable
- key validation rules are enforced
- docs are updated for any assumptions
- no obvious placeholder code is left without explanation

---

## How to behave when coding

When working on this repository:
- make incremental, reviewable changes
- keep diffs focused
- prefer explicitness over cleverness
- write tests alongside code
- avoid speculative product decisions
- preserve extension points for later permissions and offline work
- leave short implementation notes when something is intentionally deferred

When uncertain, choose the simplest path that preserves future flexibility.

---

## First recommended execution plan

If starting from an empty or near-empty repository, do this:

1. create the GitHub-ready repo structure
2. add `/docs` placeholders and this `AGENTS.md`
3. scaffold Django project in `/backend`
4. configure PostgreSQL + Docker Compose
5. set up pytest and basic health check
6. implement common base models
7. implement `Community`, `Group`, `Member`, `Institution`
8. add migrations and tests
9. expose first CRUD endpoints
10. continue by milestone order

This is the default starting plan unless repository state suggests a safer variation.
