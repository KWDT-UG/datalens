# Implementation Notes

## 2026-06-21 Interactive dashboard programme lens

Update: the dashboard now exposes real programme-aware data rather than visual
placeholder charts. Its authenticated aggregate endpoint accepts optional
community, thematic-area, and reporting-period filters. The frontend uses the
existing `ThematicArea` resource links as KWDT's programme lens, renders a
beneficiary trend from dated impact records, and surfaces non-active resources
and visible approvals as a small attention queue. The resource readiness bar
uses the existing resource-status data.

The MVP has no separate Programme model, so the four seeded thematic areas
remain the deliberate programme boundary. Reporting-period filters are based on
the newest dated impact record in scope rather than the wall-clock date; this
keeps the seeded local dataset demonstrable while production records naturally
follow their latest reporting date.

## 2026-06-21 Persistent responsive navigation

Update: desktop navigation and the top bar are now sticky, keeping primary
navigation and account/sync controls available while page content scrolls. Below
920px, the sidebar becomes a hamburger-triggered drawer with a dismissible
backdrop. At the narrowest widths, the Sync label condenses to its icon and
status dot to preserve room for search and account controls.

## 2026-06-21 Reference-led visual foundation

Update: the shared application shell now follows the supplied Group Tank
references before any page-specific redesign. The default KWDT Reference palette
uses a white navigation surface, taupe primary actions, focused orange selection
states, warm neutral canvas panels, and white content cards. Shared buttons,
tabs, table headings, form labels, cards, and headings now use the same spacing,
corner, and typography rules. The sidebar also uses the KWDT organization mark.

Lake & Sun remains available as an optional experiment; this update intentionally
establishes the default reference palette as the visual baseline for subsequent
page-by-page work.

## 2026-06-21 Persistent light and dark themes

Update: the frontend now provides an Appearance control in the application top
bar with light/dark modes and two palette directions: KWDT Reference and Lake & Sun.
Selections are stored in local storage and applied in
`index.html` before React mounts, avoiding a visible palette flash and keeping
the preference available in cached/offline PWA sessions. The manifest remains
intentionally static; the runtime browser theme color changes with the selected
palette.

## 2026-06-19 Railway Invitation Links

Issue: staging invitations were generating
`http://localhost:5173/accept-invite?...` links because the backend builds
invite URLs from `FRONTEND_APP_URL`, whose local default is the Vite dev server.

Update: the invitation endpoint now uses the configured `FRONTEND_APP_URL` when
it is non-local. If it is still local but the admin request has a non-local
browser `Origin`, the endpoint uses that origin for the generated invite link.
Railway should still set `FRONTEND_APP_URL` on the backend service to the public
frontend domain.

## 2026-06-08 Browser Offline And PWA Verification

Update: a Playwright Chromium suite now exercises the production nginx build.
It verifies service-worker activation and control, manifest icon/installability
metadata, cached application-shell reload while offline, Dexie mutation
queueing, and automatic server replay after reconnecting. Run it with
`make frontend-pwa-e2e`.

Fix: TanStack Query's default online mutation mode paused form submissions
before the application's offline queue wrapper could run. Global mutations now
use `networkMode: 'always'`, leaving connectivity decisions and durable queueing
to Data Lens.

Verification: both Playwright PWA scenarios passed, all 33 Vitest tests passed,
and frontend TypeScript compilation passed.

## 2026-06-07 Offline And PWA

Decision: sync conflicts remain record-level. Data Lens does not automatically
merge individual fields because doing so could combine stale operational or
financial values without a user's review. The Sync Center presents the local
payload and current server record with explicit keep-server and retry-local
actions.

Update: create and edit forms now autosave user-partitioned Dexie drafts.
Offline or network-interrupted creates, updates, and archives enter a persistent
queue with a stable `client_mutation_id`. The queue replays automatically on
reconnect in batches of 25 and exposes pending, syncing, failed, conflict,
pending-approval, and synced states per record.

Update: direct sync writes store durable per-user mutation receipts with request
fingerprints and accepted results. Replays remain safe after later target edits,
and mutation IDs cannot be reused for different data. Approval-gated writes
continue to return the existing approval request. Pull sync now issues opaque
`(updated_at, id)` cursors, caps each response at 200 rows, and reports
per-entity continuation metadata. The frontend cursor helper consumes every
page instead of stopping at the former fixed limit.

Update: the PWA manifest now includes 192px, 512px, and maskable icons. The
auto-updating service worker precaches the application shell.
`make frontend-pwa-check` builds the production frontend and verifies the
manifest, icon files, registration, and shell precache.

Branding update: the temporary Data Lens initials were replaced with KWDT's
official organization logo sourced from `https://katosi.org/`. The original
WebP is retained in `frontend/public`, and the generated maskable icon uses a
full-bleed KWDT-orange background with the complete logo inside the safe zone.

Verification: `make test` passed 96 Django tests, `make frontend-test` passed
32 Vitest tests, `make frontend-lint` passed, and the Node 20 production PWA
check verified installability, update activation, and offline shell assets.

## 2026-06-07 Permissions And Privacy

Decision: Field Officer and Programme Manager assignments become restrictive
once any assignment is configured. Empty assignment sets remain
organization-wide so existing accounts continue to work during rollout.
Programme assignments use `ThematicArea` as the MVP programme boundary because
the current data model has no separate Programme entity.

Update: centralized queryset scoping now covers CRUD, nested routes,
dashboards, reports, approval queues, and sync pull/push. Field Officers can be
assigned by district or community. Programme Managers can additionally derive
community access from assigned thematic areas.

Update: serializers mask member and institution PII by capability. Resource
financial values are visible only to Finance, Executive, and Procurement
roles, and editable only by Finance and Procurement roles. Approval payloads
receive the same field masking.

Update: Communications Viewer output remains limited to publication-oriented
families and removes internal audit/sync metadata, financial values, notes,
locations, source/serial details, and direct owner/beneficiary identifiers.

Update: every soft-deletable viewset now exposes `POST {id}/restore/`.
Restore and `include_deleted` access require entity-specific capabilities.

Security decision: browser tokens are no longer stored in `localStorage`.
Login rotates the DRF token, stores it in an HttpOnly `SameSite=Lax` cookie,
and requires CSRF protection for unsafe browser requests. Header token
authentication remains available for non-browser clients.

Verification: `make test` passed 92 Django tests, `make frontend-test` passed
29 Vitest tests, `make frontend-lint` passed, and the production frontend build
completed.

## 2026-06-07 Approval Policy Enforcement

Decision: routine operational creates and updates remain direct for MVP. All
archive/delete operations require approval. Resource-domain mutations require
standard programme review, while resource `value_amount`/`value_currency`
changes and valued-resource archives require finance review. All impact record
mutations require impact review.

Update: the policy is centralized and used by normal DRF CRUD, nested resource
actions, manual approval submissions, and offline sync pushes. Gated REST writes
return `202 Accepted`; gated sync changes return `pending_approval`.

Update: Finance Administrators and Executive Leadership can review finance
requests. Programme Managers review standard and impact requests, and M&E
Managers review impact requests. Self-review remains prohibited. Superusers
retain a break-glass direct-write bypass.

Update: approval requests now store review scope, policy reason, submission
source, and the target's base sync version. Applying a stale approval returns
`409` and leaves it pending. Approval-gated offline replays are idempotent when
the client reuses `client_mutation_id`.

Update: entity serializers expose the latest approval status, pending request
ID, and history count. Filtered approval history is available by `entity_type`
and `entity_id`.

Verification: `make test` passed 85 Django tests, `make frontend-test` passed
28 Vitest tests, `make frontend-lint` passed, the production frontend build
completed, the migration applied cleanly, and `make smoke-api` passed.

## 2026-07-14 Password Reset

- Public password reset endpoints now support request and confirm flows for the
  login page.
- Reset requests accept a username or email address and always return a generic
  success response to avoid account enumeration.
- Emails are sent only for active users with usable passwords and a saved email
  address. Password reset emails include both plain text and a clickable HTML
  link. Delivery failures are logged but do not alter the public response.
- Reset confirmation uses Django's password reset token generator and password
  validators, rejects reuse of the current password, then revokes existing DRF
  auth tokens for the user.
- The frontend validates reset links before showing the new-password form, so
  already-used reset links render as invalid immediately.

## 2026-07-14 Invitation Lifecycle

- Invitation tokens expire after seven days.
- Accepted and revoked invitations are hidden from the default Admin invitation
  list because the user account becomes the source of truth after acceptance.
- Expired pending invitations remain visible for 15 days and can be resent.
  Resend generates a fresh single-use token and resets expiry to seven days.
- `purge_invitations --older-than-days 30` removes accepted, revoked, and
  expired invitations after the retention window.

## 2026-06-06 Self-Service Profiles

- The authenticated `/api/v1/auth/me/` endpoint now supports partial profile
  updates for names, email, position title, and password.
- Password changes require the current password and pass Django's configured
  password validators.
- Role, workforce type, username, account status, and Django staff flags are
  intentionally excluded from self-service updates. The API rejects protected
  or unknown fields instead of silently ignoring them.
- The frontend `/profile` route now uses this API and shows effective roles and
  capabilities as read-only account information.

## 2026-06-06 MVP RBAC Revision

Update: The initial four role placeholders were replaced with eight roles that
match KWDT's current organizational functions: Field Officer, Programme
Manager, Executive Leadership, Finance Administrator, Monitoring & Evaluation
Manager, Communications Viewer, Resource & Procurement Officer, and System
Administrator.

Assumption: MVP users hold exactly one primary Data Lens role. Role assignment
replaces earlier Data Lens groups. Accounts without a role receive no API
access, and Django `is_staff` is intentionally separate from product RBAC.
Django superusers retain break-glass access.

Update: API authorization now uses centralized capabilities and distinguishes
operational, resource, impact, archive, approval-review, export, and system
administration responsibilities. M&E approval review is object-scoped to
`impact_record`, and self-review is rejected.

Update: Development authentication is enforced by default. Anonymous API access
is available only when `DATALENS_ALLOW_ANONYMOUS_API=true` is explicitly set.

Superseded on 2026-06-07: assignments, field masking, restore endpoints, and
user administration are now implemented. Communications Viewer endpoint
restrictions remain as an additional publication-safety boundary.

Update: `make smoke-api` now creates or refreshes a dedicated `api-smoke`
Programme Manager account with an unusable password. This preserves the
authenticated local smoke workflow without embedding credentials.

Update: The product Admin route now uses live `/api/v1/admin/users/` and
`/api/v1/admin/roles/` endpoints. System Administrators can create accounts,
assign one primary role, update email/password, and activate or deactivate
accounts. Self-deactivation and self-demotion are blocked, and only Django
superusers may modify another superuser.

Update: Admin invitations now use single-use random tokens stored as SHA-256
hashes. Links expire after seven days, may be revoked while pending, and create
the user/profile only after the recipient chooses a username and password.
Local development can use Mailtrap Email Sandbox by setting a Mailtrap API key,
sandbox inbox ID, and `MAILTRAP_USE_SANDBOX=true`; without a Mailtrap key,
Django's console email backend remains the fallback. Production uses the same
API integration with `MAILTRAP_USE_SANDBOX=false`, a separate token, and a
Mailtrap-verified sender domain. If delivery fails, the invitation creation
transaction rolls back so an administrator can correct configuration and retry.

Update: `seed_demo_data` now creates eight representative user profiles across
all MVP roles, including staff, intern, contractor, and volunteer examples.
These accounts use unusable passwords and exist to exercise Admin views rather
than provide shared demo credentials. It also creates pending, accepted, and
revoked invitation examples so each Admin invitation state is visible locally.

Update: `seed_demo_data` also creates or refreshes one predictable local-only
Django superuser with the System Administrator role. The default credentials
are `admin` / `adm!n@pass123` and can be overridden with the
`DATALENS_LOCAL_ADMIN_*` environment variables. The password is deliberately
reset on each demo seed to keep local UI testing frictionless; the command
must not be used to provision shared or production environments.

## 2026-05-31 Staging Image Workflow

Assumption: staging should deploy from GitHub Actions-built Docker images after
merges to `main`, while production remains a manual Docker-image promotion
flow. The workflow publishes moving staging tags for Railway staging and
immutable commit-SHA tags for rollback/promotion.

Published image tags use the existing Docker Hub repository:

- `dmjx/datalens:backend-staging`
- `dmjx/datalens:frontend-staging`
- `dmjx/datalens:backend-sha-<git-sha>`
- `dmjx/datalens:frontend-sha-<git-sha>`

Assumption: Docker image digests are recorded in the GitHub Actions job summary
after each push. Production can use either the immutable commit-SHA tag or the
reported digest for a stricter manual promotion.

Update: The workflow reads the image repository from the GitHub repository
variable `DOCKER_IMAGE_REPOSITORY`, falling back to the repository secret with
the same name. A validation step fails early if neither value is configured.

Update: Pull-request checks now live in `.github/workflows/ci.yml`, while
`.github/workflows/staging-images.yml` only runs on pushes to `main` and manual
dispatches. This prevents skipped image-publish jobs from appearing on pull
requests.

Update: Backend checks use Django's full test discovery as the single test gate.
This keeps CI simpler and avoids running model/service-style unit tests twice.

Update: The Docker Hub username is read from the GitHub repository variable
`DOCKERHUB_USERNAME`, with the original `DOCKERHUB_USERNAME` secret kept as a
fallback. The Docker Hub access token remains the `DOCKERHUB_TOKEN` repository
secret and is passed to `docker/login-action` as the Docker login password. The
workflow validates these values before attempting Docker Hub login so missing
credentials fail with a clearer message.

Assumption: Railway staging will use Docker image auto updates on the
non-semantic `*-staging` tags rather than a Railway CLI redeploy step in GitHub
Actions. This keeps Railway credentials out of the repository workflow and
matches the staging-only automation goal.

Update: The backend Docker image now has a production default command:
`gunicorn config.wsgi:application --bind [::]:${PORT:-8000}`. Railway private
networking recommends listening on `[::]` so service-to-service requests work
across IPv4 and IPv6 private addresses. The frontend `BACKEND_UPSTREAM` should
point at the backend service's Railway internal hostname and the same port the
backend listens on.

## 2026-04-13 Backend Foundation

Assumption: The request referenced
`docs/data_lens_codex_backend_handoff_unittest.md`, but that file is not present
in this checkout. I used `docs/data_lens_codex_backend.md` as the available
handoff source, then followed `AGENTS.md` for the concrete repository rules.
This may need revision if the missing handoff file is later added with newer
requirements.

Assumption: Docker/development settings use PostgreSQL by default, while
`config.settings.test` uses SQLite so Django's unittest suite can run quickly
without requiring a local database service. This is a test-runner convenience
and does not change the Docker/PostgreSQL development target.

Assumption: The first implementation slice stops at `Community`, `Group`,
`Member`, and `Institution` because the current task explicitly requested only
those models. Later MVP models remain scaffolded only as empty package
directories where useful.

Historical assumption: Shared offline-prep metadata fields are included on the first four
models: `client_created_at`, `client_updated_at`, `client_mutation_id`,
`sync_version`, and `is_deleted`. The conflict-resolution and queue behavior
described as deferred here was implemented on 2026-06-07.

Assumption: Delete operations use soft-delete semantics by setting
`is_deleted=true`. List endpoints filter soft-deleted records by default and
allow `include_deleted` for development/admin inspection. This preserves future
flexibility while product delete semantics remain unresolved.

Assumption: API access uses a centralized authenticated-only permission class,
`AuthenticatedAccess`, with no hard-coded role logic. This keeps permissions
simple and modular until the full RBAC and approval workflow rules are defined.

Development exception: `config.settings.dev` allows unauthenticated API access
with DRF `AllowAny` because the MVP does not yet include a complete auth engine
or login/logout flow. The shared base settings keep the authenticated default so
permissions can be tightened again once dev auth is implemented.

Initial assumption: `Community.code` was globally unique in the first scaffold.
Update on 2026-05-22: community codes were removed from the MVP Community
model/API and frontend create form so a community record uses its generated
database/API `id` plus descriptive fields for now. Group and Institution codes
remain community-scoped where already specified.

Update: Local workflow helpers are exposed through a root `Makefile` rather
than shell scripts under `scripts/`, per follow-up request. The Make targets wrap
Docker Compose and keep the documented commands short.

Verification note: After Docker was started on 2026-04-13, `make migrate`
applied all migrations successfully and `make test` ran 7 Django unittest tests
successfully. The backend was also started with Docker Compose and
`GET /health/` returned `{"status": "ok"}`.

## 2026-05-04 Governance Slice

Update: the governance domain was consolidated into a single
`backend/apps/participation/` app instead of separate `committees` and
`cooperatives` apps. The public API paths remain unchanged.

Assumption: `committee_type` and `cooperative_type` are stored as simple text
fields for now rather than constrained enums. The handoff names the fields but
does not define a controlled value set, so the simpler implementation preserves
future flexibility.

Assumption: membership status choices are `active`, `inactive`, `ended`, and
`archived`. This gives the backend an explicit "active" state for duplicate
membership prevention without overfitting a more detailed governance workflow.

Verification note: On 2026-05-04, `make migrate` applied the new committee and
cooperative migrations successfully, and `make test` passed 16 Django unittest
tests covering the original core slice plus governance/membership rules.

Verification note: After consolidating governance into the `participation` app,
the local Docker Compose Postgres volume was reset on 2026-05-04 so the
development database would match the new app-label and migration layout. The
fresh `make migrate` and `make test` runs both completed successfully.

## 2026-05-04 Resource Slice

Assumption: thematic areas are implemented inside the shared `resources` app
instead of a dedicated `thematic_areas` app. This keeps the resource slice
cohesive while preserving the public `/thematic-areas/` API surface.

Assumption: resource owners and beneficiaries use explicit `type + id` fields
with validation helpers rather than Django polymorphism helpers or generic
foreign keys. This follows the repo guidance to keep polymorphism simple and
validation explicit.

Assumption: `ResourceThematicArea` does not have a standalone public endpoint.
Instead, resource create/update accepts `thematic_area_ids` and
`primary_thematic_area_id`, and resource detail returns the linked thematic
areas. This keeps the API practical without adding an extra route family that
the current contract does not require.

Verification note: On 2026-05-04, `make migrate` applied the new `resources`
migration successfully and `make test` passed 26 Django unittest tests across
the core, governance, and resource slices.

## 2026-05-04 Impact And Approval Slice

Assumption: `ImpactRecord.period_type` is a simple text field instead of a
controlled enum for now. The product docs define the field but do not yet pin
down the exact allowed set, so the backend leaves that flexible.

Assumption: approval review actions (`approve` and `reject`) are restricted to
admin/staff users via DRF's `IsAdminUser`, while base approval-request CRUD
remains under the repo's authenticated default. This matches the current repo
guidance without hard-wiring a deeper RBAC model.

Historical assumption, superseded on 2026-06-07: approval actions initially
updated review state only. Approved requests now apply their payload and set
`applied_at`.

Verification note: On 2026-05-04, `make migrate` applied the new `impacts` and
`approvals` migrations successfully and `make test` passed 34 Django unittest
tests across the implemented backend slices.

## 2026-05-04 Hardening Slice

Assumption: filter support remains local and explicit through shared viewset
mixins instead of adding `django-filter` right now. The current backend only
needs exact filters, search, and whitelisted ordering, so a lighter approach
keeps the dependency surface smaller.

Assumption: API error responses now add a normalized `errors` list but preserve
the original field keys from DRF validation output. This improves machine- and
human-readability without forcing every caller to switch response parsing all at
once.

Assumption: approval review policy is exposed through a dedicated
`ApprovalReviewAccess` permission class and action-level permission mapping.
This is an extension point for later RBAC work rather than a final permission
model.

Verification note: On 2026-05-04, no new migrations were needed for the
hardening changes. `make test` passed 40 Django unittest tests, including new
API smoke coverage for route availability, filter/ordering behavior, and
structured error responses.

## 2026-05-04 Seed Data And Management Commands

Assumption: reference data is intentionally minimal and currently limited to
four thematic areas: `WASH`, `EDU`, `ENV`, and `ECON`. This matches the repo
guidance to seed only what is needed for development and tests.

Assumption: demo data uses deterministic records keyed off stable codes like
`KWDT-DEMO` and `KWDT-NORTH` so the command can be rerun without creating
duplicates. The seeded data is intentionally richer than a smoke fixture and is
meant to exercise MVP list/detail workflows across members, groups,
institutions, committees, cooperatives, resources, impact records, and approval
requests.

Behavior added:

- `python manage.py seed_reference_data`
- `python manage.py seed_demo_data`
- `python manage.py smoke_api --seed-demo-data`
- Makefile wrappers:
  - `make seed-reference-data`
  - `make seed-demo-data`
  - `make smoke-api`

Verification note: On 2026-05-04, `make test` passed 42 Django unittest tests
after adding management-command coverage.

Update on 2026-05-12: `seed_demo_data` now loads a broader deterministic test
dataset: 2 communities, 5 groups, 13 members, 5 institutions, 3 committees,
2 cooperatives, 7 resources, 7 impact records, and related memberships,
beneficiaries, status events, thematic links, and approval requests. The
management-command test asserts a second run is idempotent.

Update on 2026-07-13: `seed_staging_data` provides a Railway-safe version of
the demo domain seed. It defaults to dry-run, requires `--apply` to commit, does
not create local admin/demo users or invitations, and uses create-only behavior
for existing seed-keyed records so current remote data is preserved. This
command is intended for hosted demo/staging environments, while
`seed_demo_data` remains the local development seed with login-capable demo
accounts.

## 2026-05-05 Milestones 1-3 Start

Assumption: role-based access is implemented as Django auth group placeholders
instead of a custom auth engine. The groups are `field_officer`,
`program_manager`, `admin`, and `leadership`. Local development settings still
allow unauthenticated API access until login/logout or token auth is added.

Assumption: authenticated users without one of those role groups default to
field-officer access. This keeps early developer-created users usable while
preserving a clear role matrix for tests and future auth work.

Assumption: approval review now applies supported submitted payloads for
registered MVP entities on approve. Direct CRUD remains enabled because final
approval-gating policy was still unresolved. This was resolved on 2026-06-07.
`supersede` is available as a
terminal pending-review state for replacement workflows.

Update: UI-ready auth endpoints now exist for login, logout, and current-user
inspection. Local development remains unauthenticated by default for browser
verification, while shared settings support token/session/basic auth.

Update: resource thematic links now have a standalone endpoint and resources can
be filtered by thematic area.

Update: impact reporting endpoints provide summary totals grouped globally, by
community, and by resource.

Update: offline sync push now applies clean create/update/delete changes through
DRF serializers after record-level `sync_version` conflict detection. It is
still not a final merge engine.

Update: community list responses now include table-ready aggregate counts for
members, groups, committees, cooperatives, resources, and institutions.
`member_search` was added so a communities table can be filtered by member name
or member number without extra client-side joins.

Update: community detail pages are expected to load tab content with separate
community-filtered API calls. Committee memberships, cooperative memberships,
resource beneficiaries, and resource thematic links now support `community`
query filtering for related tab views.

## 2026-05-11 Frontend Foundation

- Added the first React/TypeScript/Vite frontend scaffold under `frontend/`.
- The frontend uses PatternFly packages for CSS/icons, with custom CSS for the
  current dark mockup direction. This keeps the shell close to the screenshots
  while leaving room to replace local markup with deeper PatternFly components
  as the shared table/form systems mature.
- Vite proxies `/api/v1` and `/health` to the Django backend during development.
  `VITE_API_BASE_URL` is intentionally blank by default so browser requests use
  the Vite dev proxy and avoid local CORS requirements.
- The Docker Compose default stack now includes a `frontend` dev service on
  port `5173`. A production-style `nginx` service is available behind the
  `production` profile and serves the built frontend while proxying API traffic
  to the backend service.
- Dexie was initially configured with draft and pending-sync tables only. Full
  queue processing and conflict resolution were added on 2026-06-07.
- The communities page consumes the real paginated community endpoint. The
  community detail breakdown table is a visual/route foundation for now; later
  milestones should replace its sample rows with entity-specific API queries.

Update on 2026-05-13: community detail breakdown tabs now load section data from
the MVP API for members, groups, institutions, cooperatives, committees,
resources, and impact records. The top-level resources route also uses the real
resource list endpoint instead of the placeholder route.

Update on 2026-05-22: the visible frontend `Create community` and
`Create resource` buttons now open mutation-backed forms. Community creation
navigates to the new community detail view after save. Resource creation keeps
owner selection scoped to the selected community and supports community, group,
member, cooperative, and institution owners through existing list endpoints.
The first resource create form intentionally defers thematic-area assignment
until the resource form/detail workflow grows that part of the shared form
surface.

Update on 2026-05-22: the community create form no longer asks for a community
code after the Community MVP contract dropped that field.

Update on 2026-05-22: community detail breakdown tabs now expose active-section
create actions for members, groups, institutions, cooperatives, committees,
resources, and impact records. Member and impact creation select existing
community-scoped groups/resources before saving; resource creation reuses the
owner-aware resource dialog with the current community fixed.

Update on 2026-05-22: visible frontend `Actions` menus on the communities,
global resources, and community breakdown lists now open and provide current
page CSV export, selection clearing, and selected-row archive through the
existing soft-delete API endpoints. Row checkboxes and the select-visible
control now feed those selected actions. View/edit row actions remain aligned
with the later detail/edit screen work rather than pointing at placeholder
routes.

Update on 2026-05-23: the frontend Impact and Approvals routes now consume the
real MVP API endpoints instead of placeholder screens. Impact includes summary,
by-community, by-resource, filtered list, CSV export, selection, and archive
actions. Approvals includes status filtering, export/selection/archive actions,
and pending request review actions for approve, reject, and supersede. Browser
offline queue processing was added on 2026-06-07.

Update on 2026-05-23: resources and impact records can now be edited from their
global list pages and from the matching community breakdown tabs. These edit
dialogs use PATCH against the existing MVP endpoints and refresh the affected
list/report query caches after save.

## 2026-06-07 Frontend Production-Readiness Slice

- Added `GET /api/v1/dashboard/` for operation-wide totals, resource status
  counts, approval workload scoped to the current user, and recent
  non-sensitive activity. This replaces incorrect client aggregation over the
  first page of communities.
- Implemented functional global search using the existing entity search
  endpoints. Communications Viewer searches intentionally omit member and
  institution requests to preserve the current API privacy boundary.
- Replaced the Reports placeholder with operational and impact summaries.
  Report exports fetch every API page in batches of 200; existing list-page CSV
  actions still export only their visible page and remain tracked separately.
- Removed Donors from frontend navigation/routing because donor functionality is
  outside backend v1 scope. Removed the community e-mail button because no
  community e-mail contract exists.
- Added read-only relationship display names to serializers so frontend tables,
  reports, and search results can avoid showing community and resource IDs.
- Corrected `ApprovalRequestSerializer.read_only_fields`; approval status,
  reviewer, submission, application, and audit fields are server-managed.

## 2026-06-07 Operational Editing And Frontend Tests

- Added edit actions and PATCH-backed forms for communities, groups, members,
  institutions, committees, and cooperatives. The forms reuse their create
  dialogs so create and update validation remain aligned.
- Operational editing is capability-gated by `manage_operations`, matching the
  existing create and archive controls.
- Added Vitest, jsdom, and Testing Library coverage. API-client matrix tests
  verify list GET, create POST, and partial-update PATCH requests for
  communities, groups, members, institutions, committees, cooperatives,
  resources, and impact records. Component matrix tests verify create
  submissions, edit-form prefilling, and detail-endpoint updates.
- Added `make frontend-test` and made frontend tests required by pull-request
  CI and the staging image pipeline.

Verification note: frontend tests use mocked API responses and complement the
Django API tests, which continue to exercise real list, retrieve, create, and
partial-update endpoint behavior. Dedicated browser end-to-end coverage remains
deferred. On 2026-06-07, all 27 frontend tests and all 78 Django tests passed;
frontend type-checking and the production build also completed successfully.

Update: approval review actions now open an application-styled dialog instead of
using `window.prompt`. The dialog identifies the request, submitted action, and
community; accepts optional review notes; displays submission errors inline; and
supports approve, reject, and supersede through the existing review endpoints.

Update: approval request submission now validates the proposed payload with the
target entity serializer. Create payloads receive full validation, update
payloads receive partial validation against the current entity, and missing
update/delete targets are rejected before entering the review queue. The demo
impact-create approval now includes its required resource relationship.

## 2026-05-13 Local Compose Hostnames

Update: local development allows `backend` in `DJANGO_ALLOWED_HOSTS` because the
frontend container proxies API and health requests to `http://backend:8000`.
Without this hostname, Django rejects normal Compose-internal frontend traffic
with `DisallowedHost` responses.

## 2026-07-10 Community Breakdown Drill-Down

- Community Breakdown rows now support URL-addressable drill-downs:
  `/communities/:communityId/:section/:recordId`.
- Drill-downs now render as independent nested detail pages instead of modal or
  drawer inspectors. This gives records enough room on large screens and avoids
  nested-scroll issues on small screens.
- The page layout keeps community context through breadcrumbs and a
  section-aware back link, then uses a large hero, a snapshot card, and stacked
  content cards. On smaller screens the snapshot and detail sections collapse
  into a single-column page flow.
- Groups and members have tailored detail content:
  - Groups show code, meeting cadence, formed/closed dates, notes, a member
    count, and a live related-members list from `GET /api/v1/groups/:id/members/`.
  - Members show identity/contact fields, current group link, participation
    dates, address, and notes.
- Other Community Breakdown sections use a generic detail page for now so
  the drill-down affordance is consistent across groups, members, institutions,
  committees, cooperatives, resources, and impact records.
- The first table column opens details while existing edit/archive/export
  controls remain separate. This avoids making checkbox/action rows ambiguous
  and keeps touch targets predictable for offline/PWA small-screen use.

## 2026-07-12 Group Workspace Detail

- Replaced the plain group drill-down content with a group workspace view using
  tabs for Overview, Resources, Trainings, Committees, and Members.
- The workspace reuses the existing community detail route and Data Lens visual
  system, but gives groups a richer header, summary metrics, a compact overview
  focused on upcoming trainings, relevant committees, linked resources, and
  group context, plus dedicated resource cards and member cards in their tabs.
- Current implementation uses existing MVP APIs only: group members come from
  `GET /api/v1/groups/:id/members/`, group-owned resources are fetched from the
  resources list with `owner_type=group` and narrowed by `owner_id` client-side,
  and impact records are narrowed client-side to group beneficiaries or
  group-owned resources.
- The Demo Savings Group seed now includes a dedicated leadership committee via
  member-level `CommitteeMembership` records. The group Committees tab derives
  committees from the selected group members until the backend exposes a
  group-scoped participation summary.
- Trainings remain outside the MVP backend. The group Trainings tab uses a
  temporary frontend-only fixture for `KWDT-DEMO-GRP` so the intended UI shape
  can be reviewed without introducing a speculative training model. The fixture
  is intentionally scoped to the selected group; attendance counts and chart
  labels should be read as group-level training participation.

## 2026-07-25 Group Subcounty

- Added optional `sub_county` support to groups across the backend model,
  serializer, admin, demo seed data, and frontend create/edit dialog.
- Group list/export and the group workspace now surface Subcounty so saved
  values are visible immediately after create or edit.
- The group Members tab now uses a consistent roster table for all group sizes,
  with client-side search, status filtering, 25-row pagination, and preserved
  parent-group back navigation when opening a member from the roster.

## 2026-08-01 Resource Repayment Foundation

- Reviewed `notes/temp-files/resources.csv` and the Group/Tank reference
  designs. The source material represents applications, inventory, beneficiary
  relationships, deposits/installments, maintenance costs, and type-specific
  fields as separate concerns rather than one flat resource record.
- Added a canonical `/resources/:resourceId` workspace with Overview,
  Beneficiaries, Payments & costs, and History sections. Global, community,
  group, and member resource presentations link to the same workspace.
- Group resource views now include resources owned by the group, directly
  benefiting the group, or linked to current group members. Member details now
  include member-owned and member/household-beneficiary resources.
- Added `benefit_scope` to resource beneficiaries. `household` is represented
  by an accountable member for MVP; a first-class Household entity is deferred.
- Added repayment obligations with a beneficiary, explicit responsible payer,
  repayable principal, deposit terms, cadence, installment amount, and dates.
  Resource asset value remains distinct from the amount a beneficiary repays.
- Corrected the school water tank demo fixture so the school is its only active
  recipient entity and 245 students and staff are represented by the linked
  impact record. The legacy seeded member link is soft-archived on reseeding.
- Resource quantities retain decimal API precision but omit insignificant
  trailing zeros in the interface.
- Added an append-only payment ledger. Deposits and installments reduce the
  confirmed balance; penalties/fees and adjustments remain explicit; full
  reversal entries preserve history. Overpayments are rejected under a row
  lock, and confirmed summaries exclude pending approvals.
- Financial mutations require `manage_resource_financials` and finance review.
  Financial reads require `view_resource_financials`. Payment posting is
  online-only for this slice and is rejected by offline sync push.
- Deferred distinct `ResourceApplication` and maintenance/service-cost records
  to follow-up slices. ApprovalRequest will not be reused as a beneficiary
  application. Automated installment schedules, reminders, calculated
  penalties, partial reversals, file uploads, and configurable resource-type
  forms also remain deferred.
- Verification: Django system and migration-drift checks passed; 22 focused
  backend tests passed; frontend TypeScript checks and all 41 Vitest tests
  passed; the production/PWA frontend build completed in the Node 20 container.
## 2026-09-29 Temporary MVP Full Access Role

Added the explicit `mvp_full_access` role for authorized stakeholders who need
to evaluate the complete product workflow during the MVP phase. The role is
assigned every capability currently defined by the centralized RBAC matrix.
It remains subject to normal approval queuing and the existing prohibition on
reviewing one's own submission.

This is intentionally separate from `system_administrator`, which remains a
technical administration role rather than an all-encompassing business role.
The full-access role should be used with demo or sanitized data where possible
and reviewed for removal or replacement by multi-role authorization before
production launch.

Adversarial follow-up: role replacement now locks the affected user row and
performs old-role removal plus new-role assignment in one database transaction.
Any assignment failure rolls back to the prior role instead of leaving the
account without access. Existing authentication tokens are preserved, and API
coverage verifies an active user can move to full access and back to the prior
role without re-authenticating. Browser clients still need to refresh their
`/auth/me/` state to render the changed capability set.

## 2026-09-29 Community Subcounty and Resident Count

- Renamed the community `area_name` field to `subcounty_name` with a
  data-preserving database migration. The API, create/edit form, search,
  exports, list, detail view, admin, and demo seed now use Subcounty.
- Added an optional non-negative `resident_count` to represent the total number
  of people living in a community. It is intentionally distinct from
  `member_count`, which remains the computed number of registered members.
- Community list rows now show Residents, Groups, and Members as separate
  columns. Community details include a summary card for residents, resources,
  and groups alongside the address card.
- The API accepts legacy `area_name` on writes as a temporary write-only alias
  so pending approvals and queued offline changes created before the rename can
  still apply. Responses expose only `subcounty_name`; conflicting old and new
  values are rejected. Existing browser drafts are normalized when loaded.

## 2026-10-01 Group and Committee Stakeholder Feedback

- Community screens and forms now use the shorter `Subcounty` label. The
  community list shows the subcounty alone in that column; district, region,
  and country remain available on the community detail page.
- The community Groups table now shows group name, code, formed date, status,
  total members, female members, and male members. Counts exclude soft-deleted
  members; gender totals use case-insensitive `female` and `male` values, so
  unspecified or differently recorded gender values remain in the total only.
- Meeting day was removed from the group create/edit experience and from the
  group workspace presentation. The legacy API/model field is retained so old
  records and queued mutations remain compatible while event scheduling is
  designed.
- Committee membership responses now include the member display name, number,
  gender, and current group. Opening a committee shows its member roster with
  roles and membership dates, and committee cards in a group workspace link to
  that roster.
- The redundant group Overview context panel was replaced by a combined
  `Trainings & Meetings` presentation with explicit event categories.
- The detailed Trainings & Meetings tab now opens as a current-month agenda
  instead of rendering all historical activity and attendance details at once.
  Users can search title/facilitator/location, switch between meetings and
  trainings, filter by date range and record completeness, change sort order,
  navigate months, and choose Agenda, Compact, or Calendar views. Full
  attendance/report details load only after selecting an activity, while
  `Browse all history` exposes older records.

## 2026-10-01 Persistent Group Activities

- Added `GroupActivity` as the persisted schedule and history record for group
  meetings and trainings. It captures dates, status, location, facilitator,
  expected and gender attendance totals, meeting notes, training reporting,
  and an optional committee link for committee meetings.
- Added CRUD at `/api/v1/group-activities/` plus the read-only nested group
  route `/api/v1/groups/{id}/activities/`. Community scoping, audit/sync
  metadata, approval-aware archive behavior, search, filtering, and ordering
  follow the existing operational API conventions.
- The group workspace now loads activities from the API instead of fixtures.
  Authorized users can add a meeting or training, edit the selected activity,
  or use `Schedule next` to start a new planned occurrence from an existing
  record. The same edit form records attendance and minutes/report notes after
  an activity occurs.
- Assumption: MVP attendance stores women and men totals. Age-band attendance
  is not persisted yet, so the prior illustrative age chart is hidden for real
  records rather than inventing demographic detail. This can be extended with
  an explicit attendance-breakdown model if stakeholders confirm the required
  dimensions.

## 2026-10-02 Group Member Roster Feedback

- Added optional `group_position` and `community_position` fields to members so
  group leadership and wider community or political leadership no longer need
  to be recorded in general notes. Both fields are exposed by the API and can
  be searched and ordered.
- The group workspace Members tab shows both kinds of position as labelled
  tags, removes email from the roster, and supports explicit ascending or
  descending sorting by name, member number, position, or joined date. Phone
  remains available as the roster's contact detail.
- Authorized users can create members without leaving the group workspace and
  edit any visible roster member in place. Group-scoped creation fixes the
  member's group to the current workspace, and successful creates or edits
  refresh the nested roster query.
- Email remains part of the underlying member record and other member
  workflows. The stakeholder feedback was applied specifically to the group
  roster rather than treated as a request to discard existing contact data.
- Assumption: the MVP stores at most one current group position and one current
  community position per member. If stakeholders need multiple concurrent
  roles, effective dates, or role history, these fields should migrate to a
  first-class membership-position model without overloading notes again.

## 2026-10-02 Community Breakdown Table Sorting

- Sortable Breakdown columns are rendered as accessible header buttons with a
  neutral, ascending, or descending indicator. A first click sorts ascending;
  the next click reverses the order.
- Ordering is sent to the API before pagination and retained in the page URL,
  so a refreshed or shared view preserves the selected order. Changing the
  sort returns the user to the first page while preserving search criteria.
- Group member, female, and male totals sort using queryset annotations rather
  than only rearranging the visible page. The other enabled columns map to
  explicit API ordering fields.
- Resource owner and financial-position columns remain unsortable. Owner
  labels are polymorphic and financial position can combine asset value with
  payment aggregates, so neither has one honest database ordering rule.
- User-facing labels now consistently spell the administrative area as
  `Subcounty`; compatibility field names such as `sub_county` and
  `subcounty_name` remain unchanged. The community Breakdown Members table no
  longer displays email, while the underlying member field and exports remain
  available for workflows that still require it.

## 2026-10-03 Resource Program Classification Decision

Stakeholder feedback established that every resource must be classified by a
thematic area and a program. The supplied working matrix places multiple
programs under each thematic area and lists reusable resource/category values
under each program.

Current implementation:

- `ThematicArea` is global reference data with four seeded records.
- `ResourceThematicArea` provides optional many-to-many resource links and an
  `is_primary` marker.
- resource create/update APIs accept optional `thematic_area_ids` and
  `primary_thematic_area_id`.
- the resource create/edit frontend does not expose or submit thematic-area
  selection.
- no `Program` or `ResourceCategory` model or API exists.
- dashboards and Programme Manager assignment scope currently use
  `ThematicArea` as a temporary programme boundary.

Accepted target design:

```text
ThematicArea -> Program -> ResourceCategory -> Resource
```

Every Program belongs to exactly one ThematicArea, and every Resource will
belong to exactly one primary Program. A Resource's thematic area is therefore
determined by its Program rather than stored as a second independent required
relationship. The UI may still present Thematic Area first to filter the
Program dropdown.

`ResourceCategory` distinguishes reusable taxonomy entries such as `Boat` or
`Borehole` from actual records such as `Katosi Primary School Borehole`.
Because the stakeholder matrix is still being refined, ResourceCategory will
initially be nullable and managed as extensible reference data. Whether it
becomes mandatory is an explicit follow-up decision.

The classification taxonomy remains organization-wide. Communities locate
resource records, while owners and beneficiaries connect them to communities,
groups, members, cooperatives, and institutions. A future requirement to track
formal program delivery in particular communities should use a separate dated
ProgramImplementation/CommunityProgram relationship rather than community-
scoping the Program taxonomy.

Original implementation sequence:

1. normalize and confirm the initial thematic-area/program/category matrix
2. add Program and ResourceCategory models, migrations, admin, APIs, and tests
3. add nullable Program and ResourceCategory relationships to Resource
4. seed reference records and produce a reconciliation report for existing
   resources, including missing or multiple primary thematic links
5. update resource create/edit/list/detail flows with cascading classification
   controls and filters
6. update dashboard, reporting, permissions, approvals, exports, and offline
   sync payloads to understand Program
7. require Resource.program after backfill and retain legacy thematic-link
   compatibility until all clients and queued mutations have migrated

Open decisions that do not block the first nullable migration are whether a
resource may ever have multiple programs and whether ResourceCategory must be
mandatory. The recommended defaults are one primary Program per Resource and a
temporarily optional ResourceCategory.

Implementation update:

- Added global Program and ResourceCategory models with protected hierarchy
  relationships, ordering, status, audit/offline metadata, and uniqueness
  constraints within their parents.
- Added nullable Program and ResourceCategory relationships to Resource through
  migration `resources.0003`. Resource validation rejects categories outside
  the selected Program.
- Added `/api/v1/programs/` and `/api/v1/resource-categories/` CRUD endpoints,
  hierarchy filters, resource filters, serializer display projections, admin
  registration, approvals/sync registration, and assignment-aware scoping.
- Resource writes keep the selected Program's thematic area synchronized as
  the primary legacy ResourceThematicArea link. Dashboard and access queries
  recognize both new Program classification and legacy thematic links.
- The create/edit form now requires cascading Thematic Area and Program
  selections, offers an optional Program-filtered Resource Category, and sends
  Program/Category IDs in normal and offline writes.
- The Resources page provides cascading classification filters and displays and
  exports thematic area, program, and category. Resource detail also displays
  all three values.
- Reference seeding now creates 4 thematic areas, 11 programs, and 41 initial
  resource categories from the stakeholder working matrix. Categories remain
  editable reference data because that matrix is not final.
- Existing resource rows remain valid without Program until a deliberate
  reconciliation/backfill step is completed. New and edited resources are
  required by the frontend to select Program; the database/API remain nullable
  for compatibility.

Remaining rollout work:

1. review the working reference taxonomy with stakeholders
2. produce and review a reconciliation report for legacy unclassified or
   multiply-linked resources
3. backfill approved Program and ResourceCategory values
4. make `Resource.program` non-nullable only after offline clients and queued
   mutations have crossed the compatibility window
5. decide whether ResourceCategory becomes mandatory

Local verification on 2026-10-03:

- migration `resources.0003` applied successfully to local PostgreSQL
- reference seed completed with 4 thematic areas, 11 programs, and 41 resource
  categories
- Django system checks passed
- all 133 Django unittest tests passed
- all 51 frontend Vitest tests passed
- frontend TypeScript checking passed
- the Docker Node 20 production build and PWA verification passed
- authenticated API smoke verification passed, including Program,
  ResourceCategory, classified resource detail, and all existing MVP routes
- local backend and frontend containers started successfully; `/health/` and
  the Vite application entry point returned HTTP 200

## 2026-10-03 Operational Table Sorting and Group Resource Display

- The main Resources table now places Thematic area, Program, and Category
  directly after Resource name and Community, matching the classification
  hierarchy users need when scanning records.
- Resources, Communities, Impact, and Approvals use the same accessible
  sortable-header interaction. Sorting is executed by the API before
  pagination; selecting the active header again reverses direction and any
  ordering change returns the list to page one.
- API ordering allowlists now cover the visible stored fields and safe related
  names used by those tables, including resource community/classification,
  community counts/location/status, all displayed impact counts, and approval
  community/action/status fields.
- Derived or polymorphic values remain deliberately unsortable when the label
  shown to users cannot be represented by one stable database field. This
  currently applies to resource owner display, resource financial position,
  approval payload summaries, and action columns.
- The Group workspace Resources tab is now a searchable, sortable comparison
  table rather than a card grid. It displays the full Thematic area → Program
  → Category path, resource type and quantity, whether the group owns or is
  linked to the record, financial position, and status. Its sort runs locally
  over the already-loaded group subset (currently capped at 100 records),
  while the main Resources list retains server-side sorting and pagination.
- Verification: all 134 Django tests and all 55 frontend tests pass; TypeScript
  checking and Django system checks pass; the Docker Node 20 production build,
  PWA/offline-shell verification, and rebuilt local backend/frontend services
  all pass. The running backend returns `{"status": "ok"}` and the frontend
  serves the Vite application entry point.

## 2026-10-03 Contextual Resource Creation and Resource Classification Governance

- Authorized users can create a resource from the Group workspace Resources
  tab through an explicit `Add group-owned resource` action. The shared form
  fixes Community to the group's community and fixes owner type/owner to the
  current group, preventing accidental cross-community or ambiguous ownership
  records. Linking an existing resource to a group remains a separate future
  beneficiary workflow; this action does not duplicate or silently link an
  existing record.
- Added a capability-gated `/reference-data` workspace named `Resource
  Classification` that presents and edits
  the global Thematic Area → Program → Resource Category hierarchy. It supports
  create/edit/status management and intentionally exposes no hard-delete
  action. Codes are normalized to uppercase underscore form before submission.
- Added the dedicated `manage_reference_data` capability to Programme Manager,
  System Administrator, and MVP Full Access roles. General resource mutation
  permission no longer implicitly permits taxonomy changes. Programme Managers
  with thematic assignments can manage Programs and Categories only inside
  their assigned areas; creating a new top-level Thematic Area requires
  organization-wide reference-data scope.
- The resource form links authorized users to Resource Classification when a Program is
  missing. Ordinary resource-entry users can select active reference values
  but cannot create or edit the shared taxonomy.
- The existing `Resource.location_text` storage contract is retained, but the
  product label is now `Site / location details`. The form displays the
  Community's Subcounty, District, Region, and Country as inherited read-only
  context and asks `location_text` only for a village, school, landing site,
  facility, or landmark within that community. Administrative fields are not
  duplicated on Resource, avoiding contradictory geography.
- Verification: all 135 Django tests and all 57 frontend tests pass; Django
  system checks and frontend TypeScript checking pass. The Docker Node 20
  production build, PWA/offline-shell verification, rebuilt local services,
  backend health endpoint, and frontend `/reference-data` application route
  also pass.
## 2026-10-04 Operational Domain Boundary Review

- Added `operational-domain-boundaries.md` as the working architecture and
  stakeholder walkthrough document for Resource inventory, Resource
  repayments, maintenance, performance/production, microcredit Loans, and the
  QuickBooks accounting boundary.
- The document distinguishes implemented behavior from recommendations,
  records open product questions and decision gates for each boundary, and
  defines staged review and delivery checkpoints. It does not authorize new
  models or implementation by itself.
- Linked the existing Resource lifecycle and finance design to the new boundary
  guide so detailed current behavior and future cross-domain decisions remain
  separate but discoverable.
- Recorded the separation of Loans from Resource inventory as a working
  architectural direction. It is explicitly provisional until reviewed and
  approved by KWDT leadership stakeholders.
