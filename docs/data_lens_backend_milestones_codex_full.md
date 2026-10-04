# Data Lens Backend MVP Milestone Roadmap
Implementation roadmap with Codex prompts for each milestone

## Milestone 1: Permissions & Roles
**Goal:** Define and enforce role-based access control for backend entities.
**Tasks:**
- Implement roles: Field Officer, Program Manager, Admin, Leadership.
- Create permission classes and map them to entities/actions.
- Add view/mixin decorators enforcing permissions.
- Add unit tests for role-action matrix.
**Done When:** Permissions enforced on key endpoints, tests cover role vs action matrix.
**Suggested Codex Prompt:**
Goal: Implement role-based permissions for all core entities as per AGENTS.md and handoff doc. Tasks: create roles, map permissions, add decorators/mixins, add tests using unittest and subTest. Done when: all permissions enforceable, tests pass.

## Milestone 2: Approval Workflow
**Goal:** Implement approval logic for sensitive actions.
**Tasks:**
- Queue change requests for create/update/delete actions.
- Enforce approval before applying changes.
- Update endpoints for approval submission and review.
- Add tests for approval flows and reject/supersede logic.
**Done When:** Approval flows implemented with tests for main scenarios.
**Suggested Codex Prompt:**
Goal: Implement ApprovalRequest logic for entity mutations. Tasks: queue change requests, enforce approval, update endpoints, add unittest subTest coverage. Done when: approval flows working and verified.

## Milestone 3: Offline Sync Readiness
**Goal:** Prepare models and APIs for offline sync support.
**Tasks:**
- Ensure all entities have offline-prep fields: client_created_at, client_updated_at, client_mutation_id, sync_version, is_deleted.
- Add bulk sync API stubs for push/pull and conflict detection.
- Document sync assumptions in /docs/offline_sync_design.md.
- Add tests for version mismatch and conflict detection.
**Done When:** Bulk sync endpoints exist, conflict scenarios testable, documentation updated.
**Suggested Codex Prompt:**
Goal: Add offline-prep fields and basic sync API endpoints. Tasks: add fields to models, create bulk push/pull endpoints, add unittest subTest tests, document assumptions. Done when endpoints exist and tests pass.

## Milestone 4: Resource Workflow Completion
**Goal:** Complete resource CRUD, nested reads, and workflow endpoints.
**Tasks:**
- Implement ResourceBeneficiary and ResourceThematicArea endpoints.
- Add nested read routes for resources and beneficiaries.
- Add filters for community, thematic area, and status.
- Add unit tests for filters and nested reads.
**Done When:** Resource workflow fully testable with nested endpoints.
**Suggested Codex Prompt:**
Goal: Complete Resource API and workflows. Tasks: implement beneficiaries, thematic areas, nested reads, filters, unittest coverage. Done when API and tests functional.

## Milestone 5: Impact Reporting
**Goal:** Enable full impact record management and reporting.
**Tasks:**
- Support impact by period and beneficiary type.
- Add reporting endpoints by community and resource.
- Add matrix-style tests for impact scenarios.
**Done When:** Impact records can be created, retrieved, and filtered; tests cover edge cases.
**Suggested Codex Prompt:**
Goal: Implement ImpactRecord APIs with reporting filters. Tasks: create endpoints, add unittest subTest coverage for periods and beneficiary types. Done when filters and tests pass.

## Milestone 6: Security & Hardening
**Goal:** Secure backend and prepare for production readiness.
**Tasks:**
- CSRF protection, headers, input validation.
- Add audit logging and optional rate limiting.
- Validate all endpoints for proper auth/permissions.
**Done When:** Security checks pass and logging/audit prepared.
**Suggested Codex Prompt:**
Goal: Apply security best practices. Tasks: CSRF, headers, audit logging, rate limiting, auth validation. Done when tests confirm secure configuration.

## Milestone 7: Full Test Coverage
**Goal:** Ensure comprehensive test coverage across backend models and APIs.
**Tasks:**
- Expand Django unittest coverage for all entities.
- Add integration tests for nested endpoints and workflows.
- Use subTest for matrix-style validations.
**Done When:** All tests pass and coverage meets threshold.
**Suggested Codex Prompt:**
Goal: Expand unittest coverage with subTest for matrix-style tests. Tasks: unit and integration tests for all entities, edge cases, nested endpoints. Done when all tests pass.

## Milestone 8: Deployment & Release
**Goal:** Prepare backend for staging and production deployment.
**Tasks:**
- Document deployment steps, env vars, backups, logging.
- Set up staging environment and migrations strategy.
- Run smoke tests post-deployment.
**Done When:** Backend deployable with documented steps and verified smoke tests.
**Suggested Codex Prompt:**
Goal: Prepare backend for staging/production. Tasks: document deployment, configure staging, run migrations, execute smoke tests. Done when environment is ready and tests pass.
