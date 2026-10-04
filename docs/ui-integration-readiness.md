# UI Integration Readiness

This document gives frontend/UI developers the practical backend contract for
building against the KWDT Data Lens MVP API.

## Local Startup

Run these commands from the repository root:

```bash
make migrate
make init-roles
make seed-reference-data
make seed-demo-data
make smoke-api
```

Start the dev server if it is not already running:

```bash
make up
```

Useful health checks:

```text
GET http://127.0.0.1:8000/health/
GET http://127.0.0.1:8000/api/v1/communities/
```

Expected health response:

```json
{"status": "ok"}
```

## Base Contract

Base URL:

```text
http://127.0.0.1:8000
```

API prefix:

```text
/api/v1
```

List responses use DRF page-number pagination:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": []
}
```

Validation and permission errors include an `errors` list and may also include
field-specific keys:

```json
{
  "errors": [
    {
      "attr": "group",
      "detail": "Member group must belong to the same community.",
      "code": "invalid"
    }
  ],
  "group": ["Member group must belong to the same community."]
}
```

## Authentication

Local development requires authenticated access by default. An explicit
`DATALENS_ALLOW_ANONYMOUS_API=true` setting is available only for disposable
demo environments.

Browser login:

```text
GET /api/v1/auth/csrf/
POST /api/v1/auth/login/
```

Request:

```json
{
  "username": "api-smoke",
  "password": "ApiSmoke12345"
}
```

Response:

```json
{
  "data": {
    "user": {
      "id": 1,
      "username": "api-smoke",
      "email": "api-smoke@example.com",
      "is_staff": true,
      "is_superuser": true,
      "roles": ["system_administrator"],
      "capabilities": ["manage_roles", "manage_settings", "manage_users", "read"]
    }
  },
  "meta": {
    "token_type": "Token"
  },
  "errors": []
}
```

The login response sets an HttpOnly `datalens_auth` cookie. Browser code should
use `credentials: "include"`, read the non-HttpOnly `csrftoken` cookie, and send
it as `X-CSRFToken` on POST, PATCH, and DELETE requests. Do not store API tokens
in `localStorage`.

Authenticated requests:

```text
Authorization: Token token-value
```

Current user:

```text
GET /api/v1/auth/me/
PATCH /api/v1/auth/me/
```

The PATCH request accepts self-service name, email, position title, and
password updates. Password changes require `current_password` and
`new_password`. Role, workforce type, username, and account status are
read-only on the profile screen.

Logout:

```text
POST /api/v1/auth/logout/
```

Invitation acceptance:

```text
POST /api/v1/auth/accept-invitation/
```

The frontend public route is `/accept-invite?token=...`. The recipient chooses
a username and password; role and workforce metadata come from the invitation.
Admin invitation links expire after seven days. Accepted and revoked
invitations are hidden from the default Admin list. Expired pending invitations
remain visible for 15 days with `can_resend: true`; the UI should show Resend
for those rows. `POST /api/v1/admin/invitations/{id}/resend/` sends a new link
and resets expiry to seven days from resend time.

Password reset:

```text
POST /api/v1/auth/password-reset/request/
POST /api/v1/auth/password-reset/confirm/
GET /api/v1/auth/password-reset/validate/?uid=...&token=...
```

The request endpoint accepts `{ "identifier": "username-or-email" }` and
returns the same generic success response whether or not a matching account was
found. Active users with usable passwords receive an email linking to
`/reset-password?uid=...&token=...`. Reset emails include both plain text and a
clickable HTML link. The confirm endpoint accepts `uid`, `token`, and
`new_password`, validates the password, updates the account, and revokes
existing API tokens. It rejects attempts to reuse the current password.
The validate endpoint returns `{ "valid": true|false }` so used or expired
links can show an invalid-link screen before the user enters a new password.

## Roles

MVP roles are backed by Django auth groups:

```text
field_officer
programme_manager
executive_leadership
finance_administrator
monitoring_evaluation_manager
communications_viewer
resource_procurement_officer
system_administrator
mvp_full_access
```

The current role-to-capability contract is maintained in
`docs/permissions-matrix.md`. Frontend code should use the `capabilities`
returned by login or `/auth/me/`, rather than checking role names for actions.
`mvp_full_access` is temporary and intended only for authorized end-to-end MVP
evaluation; it should be visibly labeled as such anywhere roles are assigned.

## First UI Screens

These endpoints are enough for the first dashboard/list/detail screens:

```text
GET /api/v1/communities/
GET /api/v1/communities/{id}/summary/
GET /api/v1/groups/?community={id}
GET /api/v1/members/?community={id}
GET /api/v1/institutions/?community={id}
GET /api/v1/resources/?community={id}
GET /api/v1/resources/{id}/detail/
GET /api/v1/impact-records/summary/?community={id}
GET /api/v1/approval-requests/?status=pending
```

The communities list is table-ready for screens like the communities mock:

```text
GET /api/v1/communities/?search=Alice&ordering=name
GET /api/v1/communities/?member_search=Grace&ordering=-member_count
```

Each community row includes:

```json
{
  "id": 1,
  "name": "KWDT Demo Community",
  "member_count": 1,
  "group_count": 1,
  "committee_count": 1,
  "cooperative_count": 1,
  "resource_count": 1,
  "institution_count": 1
}
```

The UI can render the table columns directly from one paginated response:

```text
Community name | Members | Groups | Committees | Cooperatives | Resources
```

## Community Detail Tabs

When a user clicks one community row, load the community shell first:

```text
GET /api/v1/communities/{id}/
GET /api/v1/communities/{id}/summary/
```

Then each sub-menu tab should make its own filtered list call using the same
community id:

```text
GET /api/v1/members/?community={id}
GET /api/v1/groups/?community={id}
GET /api/v1/committees/?community={id}
GET /api/v1/cooperatives/?community={id}
GET /api/v1/resources/?community={id}
```

Optional related-tab helper calls:

```text
GET /api/v1/institutions/?community={id}
GET /api/v1/committee-memberships/?community={id}
GET /api/v1/cooperative-memberships/?community={id}
GET /api/v1/resource-beneficiaries/?community={id}
GET /api/v1/resource-thematic-areas/?community={id}
GET /api/v1/impact-records/?community={id}
```

Recommended tab labels:

```text
Members | Groups | Committees | Cooperatives | Resources
```

## CRUD Families

All listed families support list, create, retrieve, partial update, and soft
delete:

```text
/api/v1/communities/
/api/v1/groups/
/api/v1/members/
/api/v1/institutions/
/api/v1/committees/
/api/v1/committee-memberships/
/api/v1/cooperatives/
/api/v1/cooperative-memberships/
/api/v1/thematic-areas/
/api/v1/resources/
/api/v1/resource-beneficiaries/
/api/v1/resource-thematic-areas/
/api/v1/impact-records/
/api/v1/approval-requests/
```

Soft-deleted rows are hidden by default. For admin/debug screens:

```text
?include_deleted=1
```

## Create/Edit Examples

Create a group:

```text
POST /api/v1/groups/
```

```json
{
  "community": 1,
  "code": "UI-TEST-GROUP",
  "name": "UI Test Group",
  "sub_county": "Mpunge",
  "meeting_day": "Tuesday"
}
```

Edit a group:

```text
PATCH /api/v1/groups/{id}/
```

```json
{
  "sub_county": "Ntenjeru",
  "meeting_day": "Wednesday"
}
```

Create a resource with thematic links:

```text
POST /api/v1/resources/
```

```json
{
  "community": 1,
  "owner_type": "group",
  "owner_id": 1,
  "resource_type": "machinery",
  "name": "UI Test Pump",
  "quantity": "1.00",
  "unit": "unit",
  "status": "planned",
  "thematic_area_ids": [1, 4],
  "primary_thematic_area_id": 4
}
```

## Resource Workflow

Resource detail aggregates the related data a UI detail page needs:

```text
GET /api/v1/resources/{id}/detail/
```

Nested resource endpoints:

```text
GET  /api/v1/resources/{id}/beneficiaries/
POST /api/v1/resources/{id}/beneficiaries/
GET  /api/v1/resources/{id}/status-events/
POST /api/v1/resources/{id}/status-events/
GET  /api/v1/resources/{id}/impact-records/
POST /api/v1/resources/{id}/impact-records/
```

Standalone thematic link endpoint:

```text
/api/v1/resource-thematic-areas/
```

Financial-capable roles also receive payment obligations, confirmed
transactions, and derived summaries from resource detail. Financial writes are
online-only and return `202 Accepted` for finance review:

```text
POST /api/v1/resource-payment-obligations/
POST /api/v1/resource-payment-transactions/
POST /api/v1/resource-payment-transactions/{id}/reverse/
```

Transactions are append-only. A pending payment must be presented as
"submitted for finance approval" and must not be added to confirmed totals.

Useful filters:

```text
GET /api/v1/resources/?community=1
GET /api/v1/resources/?status=active
GET /api/v1/resources/?owner_type=group
GET /api/v1/resources/?thematic_area=4
GET /api/v1/resources/?linked_group=3
GET /api/v1/resources/?linked_member=17
```

## Impact Reporting

Impact report endpoints:

```text
GET /api/v1/impact-records/summary/
GET /api/v1/impact-records/by-community/
GET /api/v1/impact-records/by-resource/
```

Useful filters:

```text
?community=1
?resource=1
?period_type=monthly
?period_start=2026-01-01
?period_end=2026-01-31
```

## Approval Workflow

Approval review endpoints:

```text
POST /api/v1/approval-requests/{id}/approve/
POST /api/v1/approval-requests/{id}/reject/
POST /api/v1/approval-requests/{id}/supersede/
```

Approving a supported request applies `submitted_payload` for create, update,
or soft delete. Resource and impact mutations plus all archive actions are
approval-gated; routine operational creates and updates remain direct.

Example approval request for a resource update:

```json
{
  "community": 1,
  "entity_type": "resource",
  "entity_id": 1,
  "action_type": "update",
  "submitted_payload": {
    "status": "active"
  },
  "diff_summary": {
    "status": ["planned", "active"]
  }
}
```

## Offline Sync

Pull:

```text
GET /api/v1/sync/pull/
GET /api/v1/sync/pull/?entity_type=resource
GET /api/v1/sync/pull/?updated_after=2026-01-01T00:00:00Z
GET /api/v1/sync/pull/?entity_type=resource&cursor={opaque_cursor}&page_size=200
```

Push:

```text
POST /api/v1/sync/push/
```

Example update:

```json
{
  "changes": [
    {
      "entity_type": "resource",
      "id": 1,
      "sync_version": 1,
      "client_mutation_id": "device-123-mutation-456",
      "action": "update",
      "payload": {
        "name": "Synced Resource Name"
      }
    }
  ]
}
```

If the client `sync_version` does not match the server, the endpoint returns a
`409` with a `version_mismatch` conflict and the current server row.
Cursor pulls continue while `meta.has_more` is true by passing
`meta.next_cursor` to the next request. Replayed mutation IDs return the
existing applied result or approval request.

## UI Readiness Checks

Before starting frontend integration, verify:

```bash
make test
make check
make smoke-api
```

Then manually confirm:

```text
POST /api/v1/auth/login/
GET /api/v1/auth/me/
GET /api/v1/communities/
GET /api/v1/resources/1/detail/
GET /api/v1/impact-records/summary/?community=1
GET /api/v1/approval-requests/
```

## Known Boundaries

- Donor features are out of scope.
- The React frontend includes Dexie drafts, queued mutation replay, a sync and
  conflict center, and a generated service worker.
- Dev settings are intentionally permissive for local browser verification.
- Offline sync is record-version based. Conflicts require an explicit
  keep-server or retry-local decision; fields are not automatically merged.
- Approval-gated writes return `202 Accepted` with `approval_required=true`.
- Resource financial changes use the `finance` review scope.
- Offline gated writes return `pending_approval` instead of being applied.
