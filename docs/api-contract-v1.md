# API Contract v1

Base path:

```text
/api/v1/
```

Authentication:

- local development requires authenticated access by default; setting
  `DATALENS_ALLOW_ANONYMOUS_API=true` enables an explicit insecure demo mode
- browser authentication uses a CSRF-protected HttpOnly token cookie
- `Authorization: Token ...` remains supported for scripts and API clients
- shared base settings keep a named role-action permission class
- role-based behavior is enforced for authenticated settings
- login and current-user responses include `roles` and computed `capabilities`

Auth endpoints:

```text
GET  /api/v1/auth/csrf/
POST /api/v1/auth/login/
POST /api/v1/auth/logout/
GET /api/v1/auth/me/
PATCH /api/v1/auth/me/
POST /api/v1/auth/accept-invitation/
POST /api/v1/auth/password-reset/request/
POST /api/v1/auth/password-reset/confirm/
GET  /api/v1/auth/password-reset/validate/?uid=...&token=...
```

Browser clients must request `/auth/csrf/` before login and send the
`X-CSRFToken` header on unsafe requests. Login sets the `datalens_auth`
HttpOnly cookie and does not return the token in JSON. Logout revokes the token
and clears the cookie.

Dashboard endpoint:

```text
GET /api/v1/dashboard/
```

The dashboard response contains operation-wide community, group, active-member,
institution, resource, impact, and approval totals. Pending approval totals are
scoped to requests visible to the authenticated user. It also includes resource
status counts and the eight most recently updated non-sensitive operational
records.

Optional query parameters support the interactive dashboard lens:

```text
community=<community-id>
thematic_area=<thematic-area-code>
period=all|3|6|12
```

The response additionally includes programme-lens summaries, beneficiary trend
points grouped by `as_of_date`, and non-active resources or visible approvals
that need attention. A selected period is calculated against the newest dated
impact record in the selected scope, ensuring local/demo datasets remain useful
even when their reporting dates predate the current calendar date.

`PATCH /api/v1/auth/me/` allows an authenticated user to update `first_name`,
`last_name`, `email`, and `position_title`. Password changes require both
`current_password` and `new_password`. Username, role, workforce type, account
status, and staff/superuser flags remain administrator-controlled.

`POST /api/v1/auth/password-reset/request/` accepts `identifier`, which may be
a username or email address. It always returns a generic success message to
avoid account enumeration and sends an email only for active users with usable
passwords and a saved email address. Reset links target the frontend
`/reset-password?uid=...&token=...` route. The email is sent as multipart
text/HTML so normal email clients receive a clickable reset link.

`POST /api/v1/auth/password-reset/confirm/` accepts `uid`, `token`, and
`new_password`. Successful resets validate the new password with Django's
configured password validators, reject reuse of the current password, and
revoke existing DRF auth tokens for that user.
`GET /api/v1/auth/password-reset/validate/` lets the frontend detect invalid,
expired, or already-used reset links before showing the new-password form.

System administrator endpoints:

```text
GET  /api/v1/admin/users/
POST /api/v1/admin/users/
PATCH /api/v1/admin/users/{id}/
GET  /api/v1/admin/roles/
GET  /api/v1/admin/invitations/
POST /api/v1/admin/invitations/
PATCH /api/v1/admin/invitations/{id}/
POST /api/v1/admin/invitations/{id}/resend/
```

The user endpoints support account creation, email/password updates, one
primary role assignment, and activation/deactivation. They require the
`manage_users` capability. Self-deactivation and self-demotion are rejected.
User create/update also accepts `assigned_districts`,
`assigned_community_ids`, and `assigned_thematic_area_ids`.

The role list includes the temporary `mvp_full_access` role for authorized MVP
evaluation. It contains every product capability. Non-financial top-level
Resource creates and updates apply directly for this role and retain normal
audit metadata; all other approval policy and self-review restrictions remain.
The role is not a replacement for permanent job-role design.

Role updates atomically replace the current Data Lens group and do not revoke
existing authentication tokens. A subsequent `GET /api/v1/auth/me/` therefore
returns the new role and capability set in the user's current session. Another
privileged administrator can use the same user update endpoint to restore the
account's former role; privileged users cannot replace their own role.

Invitations contain the recipient's email, name, workforce type, position,
and primary role. Invitation links expire after seven days and can be accepted
only once. Pending invitations may be revoked by a System Administrator.
Accepted and revoked invitations are hidden from the default list. Pending
invitations that have expired remain visible for 15 days with `status:
"expired"` and `can_resend: true`; resend generates a fresh token and resets
`expires_at` to seven days from resend time. The list endpoint accepts
`status=visible|pending|expired|accepted|revoked|all`.

List endpoints are paginated with DRF page-number pagination.

Validation and permission errors include a normalized `errors` list while still
preserving field-specific keys where applicable. Example:

```json
{
  "errors": [
    {
      "attr": "owner_id",
      "detail": "Resource owner must belong to the same community.",
      "code": "invalid"
    }
  ],
  "owner_id": ["Resource owner must belong to the same community."]
}
```

## Implemented CRUD Endpoints

```text
/api/v1/communities/
/api/v1/groups/
/api/v1/group-activities/
/api/v1/members/
/api/v1/institutions/
/api/v1/committees/
/api/v1/committee-memberships/
/api/v1/cooperatives/
/api/v1/cooperative-memberships/
/api/v1/thematic-areas/
/api/v1/programs/
/api/v1/resource-categories/
/api/v1/resources/
/api/v1/resource-beneficiaries/
/api/v1/resource-thematic-areas/
/api/v1/resource-payment-obligations/
/api/v1/resource-payment-transactions/
/api/v1/impact-records/
/api/v1/approval-requests/
```

Each endpoint supports:

- list
- create
- retrieve
- partial update
- delete as soft delete through `is_deleted`
- restore through `POST /api/v1/{collection}/{id}/restore/`
- archive impact preview through
  `GET /api/v1/{collection}/{id}/deletion-preview/`
- MVP-only permanent-delete preview through
  `GET /api/v1/{collection}/{id}/permanent-delete-preview/`
- MVP-only permanent deletion through
  `DELETE /api/v1/{collection}/{id}/permanent-delete/`

The standard collection `DELETE` archives and never hard-deletes or recursively
archives related records. The archive preview
returns `can_archive`, `blockers`, and `warnings`, plus a server-authored
`confirmation_message`. Active structural references are blockers; retained
history/reference records are warnings. Clients must show confirmation and
should load a fresh preview immediately before issuing `DELETE`. The server
rechecks immediately before writing; a newly detected relationship produces
`409 Conflict` with code `archive_blocked` and a fresh `archive_preview`.

Restore also preserves relationship integrity. If a parent or polymorphic
owner/beneficiary is still archived, restore returns `409 Conflict` with code
`restore_blocked` and `restore_blockers`; restore the parent first.
Creates and relationship-changing updates likewise reject archived foreign-key
or polymorphic parents with a field-level `400` validation error. Unrelated
partial updates remain available for legacy rows with archived concrete
foreign-key parents; polymorphic links are revalidated on update.

Permanent deletion is a separate, temporary MVP cleanup action. It requires
`mvp_delete_permanently`, is never queued offline or submitted for approval,
and is unavailable for approval-request records. It is allowed only when the
preview finds zero stored relationships, including archived children,
historical evidence, financial records, user assignments, and approval history.
The UI requires the operator to type `DELETE`; the server then locks, rechecks,
and physically removes only the selected row. It never cascades.

Group activities can be filtered by `community`, `group`, `committee`,
`activity_type`, and `status`; searched by title, location, facilitator, topic,
agenda, group, or committee; and ordered by start/end time, title, status, or
creation time.

Activity representations include a `parties` array. Each item contains
`party_type`, `party_id`, `party_name`, and `role`. New clients should submit
exactly one `subject` and may submit related parties with `organizer`, `host`,
`partner`, or `audience` roles. Activities can additionally be filtered with
`party_type`, `party_id`, and `party_role`. `party_type` and `party_id` must be
provided together; every supplied party criterion is matched against the same
association row. `parties` is the authoritative relationship representation.
The `group` and `committee` fields remain available as synchronized nullable
compatibility projections, and `/group-activities/` remains the stable endpoint
during the transition to broader activity wording. A legacy-only update to
`group` or `committee` is translated into the corresponding party set.

Archived organizations retain their names in historical activity responses,
but cannot be newly attached to an activity. Communications Viewer responses
omit Institution parties because that role cannot access Institution records.

Resource lists accept `linked_party_type` and `linked_party_id` together to
return records owned by or benefiting a Group, Member, Cooperative, or
Institution. The earlier `linked_group` and `linked_member` filters remain
supported. Impact record lists accept `beneficiary_type` together with
`beneficiary_id`, enabling organization detail views to load direct impact.

Payment transactions are an exception: they support list, retrieve, and create
only. Corrections use `POST /api/v1/resource-payment-transactions/{id}/reverse/`.

`include_deleted=1` and restore actions require the matching archive or restore
capability. Assignment-scoped users receive `404` for objects outside their
effective community scope.

Submitted approval requests are immutable. They may be reviewed through the
approve/reject/supersede actions or archived, but not patched.

Writes that require approval return `202 Accepted` and do not change the target:

```json
{
  "approval_required": true,
  "detail": "Change submitted for approval.",
  "approval_request": {
    "id": 42,
    "status": "pending",
    "review_scope": "finance",
    "submission_source": "api"
  }
}
```

## Implemented Nested Read Endpoints

```text
/api/v1/communities/{id}/summary/
/api/v1/communities/{id}/groups/
/api/v1/communities/{id}/institutions/
/api/v1/groups/{id}/members/
/api/v1/groups/{id}/activities/
/api/v1/committees/{id}/memberships/
/api/v1/cooperatives/{id}/memberships/
/api/v1/resources/{id}/beneficiaries/
/api/v1/resources/{id}/status-events/
/api/v1/resources/{id}/impact-records/
/api/v1/resources/{id}/detail/
/api/v1/resource-payment-transactions/{id}/reverse/
/api/v1/approval-requests/{id}/approve/
/api/v1/approval-requests/{id}/reject/
/api/v1/approval-requests/{id}/supersede/
/api/v1/impact-records/summary/
/api/v1/impact-records/by-community/
/api/v1/impact-records/by-resource/
/api/v1/sync/pull/
/api/v1/sync/push/
```

Group representations include the read-only projections `member_count`,
`female_count`, and `male_count`. The total excludes soft-deleted members; the
gender projections count case-insensitive `female` and `male` values.

Member representations include the optional `group_position` and
`community_position` fields. Both fields can be searched and used for ordering
on the member list endpoint.

Community Breakdown list endpoints support server-side ordering for their
visible sortable columns. This includes group membership/gender aggregates,
member identity and participation fields, institution/committee/cooperative
classification and lifecycle fields, resource type/quantity/acquisition/status,
and impact dates, resource name, counts, and method. Prefix a field with `-`
for descending order; comma-separated fields provide deterministic compound
ordering such as `ordering=last_name,first_name`.

Committee membership representations include read-only member context for
roster screens: `member_name`, `member_number`, `member_gender`,
`member_group_id`, and `member_group_name`.

Cooperative membership representations expose the same read-only member
context so committee and cooperative rosters can share presentation behavior.

Resource list filters also support `linked_group={id}` and
`linked_member={id}`. These return resources owned by or benefiting the party;
group linkage also includes resources owned by or benefiting current group
members. The resource detail response includes beneficiaries, lifecycle events,
impact records, and—only for users with financial visibility—payment
obligations and confirmed transactions.

Sync pull supports the legacy `updated_after` filter and cursor pagination:

```text
GET /api/v1/sync/pull/?entity_type=resource&page_size=200
GET /api/v1/sync/pull/?entity_type=resource&cursor={opaque_cursor}&page_size=200
```

Cursor responses include `next_cursor`, `has_more`, `next_cursors`,
`has_more_by_entity`, and `sync_contract: record_version_v2`. Cursors are
server-issued, opaque positions ordered by `updated_at` and `id`.

Each pushed change should include a stable `client_mutation_id`. Replaying an
already applied direct mutation returns `replayed: true`; replaying an
approval-gated mutation returns the existing approval request. Receipts are
scoped by user and remain valid after later edits to the target. Reusing an ID
for different request data returns `mutation_id_reused`. Update and delete
changes should also include the client's `sync_version`. A mismatch returns
`409` with the current server record for manual conflict resolution.

## Basic Filtering

Filtering is implemented without adding `django-filter` yet.

Supported examples:

```text
/api/v1/communities/?status=active
/api/v1/communities/?country=Uganda
/api/v1/communities/?search=Alice
/api/v1/communities/?member_search=Grace
/api/v1/communities/?ordering=-member_count
/api/v1/groups/?community=1
/api/v1/groups/?status=active
/api/v1/groups/?sub_county=Mpunge
/api/v1/members/?community=1
/api/v1/members/?group=1
/api/v1/institutions/?community=1
/api/v1/institutions/?institution_type=school
/api/v1/committees/?community=1
/api/v1/committee-memberships/?committee=1
/api/v1/committee-memberships/?community=1
/api/v1/cooperatives/?community=1
/api/v1/cooperative-memberships/?cooperative=1
/api/v1/cooperative-memberships/?community=1
/api/v1/thematic-areas/?status=active
/api/v1/resources/?community=1
/api/v1/resources/?owner_type=group
/api/v1/resources/?thematic_area=1
/api/v1/resource-beneficiaries/?resource=1
/api/v1/resource-beneficiaries/?community=1
/api/v1/resource-thematic-areas/?resource=1
/api/v1/resource-thematic-areas/?community=1
/api/v1/impact-records/?resource=1
/api/v1/impact-records/?community=1
/api/v1/approval-requests/?status=pending
```

Implemented CRUD/list endpoints support `?search=...` where configured.
Implemented list endpoints also support `?ordering=...` for whitelisted fields.

The main operational tables use server-side ordering before pagination. Useful
ordering examples include:

```text
/api/v1/communities/?ordering=-resource_count
/api/v1/communities/?ordering=subcounty_name
/api/v1/resources/?ordering=program__thematic_area__name
/api/v1/resources/?ordering=program__name
/api/v1/resources/?ordering=resource_category__name
/api/v1/resources/?ordering=community__name
/api/v1/impact-records/?ordering=-beneficiary_count
/api/v1/approval-requests/?ordering=community__name
```

Descending ordering uses the same field prefixed with `-`. Only explicitly
allowlisted fields are honored. UI-only summaries such as resource financial
position, polymorphic owner display, and approval payload summary are not API
ordering fields.

Resource create/update also supports thematic links through:

```json
{
  "thematic_area_ids": [1, 2],
  "primary_thematic_area_id": 1
}
```

This remains the compatibility contract for legacy records and queued clients.

## Resource Classification Contract

Status: implemented with nullable backend relationships during migration.

Reference-data endpoints:

```text
/api/v1/programs/
/api/v1/resource-categories/
```

Authenticated reads follow normal scope rules. Create/update operations require
`manage_reference_data`, currently granted to Programme Managers, System
Administrators, and MVP Full Access. Programme Managers with thematic-area
assignments can mutate Programs and Categories only within those assignments.
The product UI archives taxonomy choices operationally by setting `status` to
`inactive`; it does not expose hard deletion.

Programs support filtering by `thematic_area` and `status`. Resource
categories support filtering by `program`, `thematic_area`, and `status`.
The resource list supports `program` and `resource_category` filters while
retaining the thematic-area filter as a derived convenience filter:

```text
/api/v1/programs/?thematic_area=1&status=active
/api/v1/resource-categories/?program=7&status=active
/api/v1/resources/?thematic_area=1
/api/v1/resources/?program=7
/api/v1/resources/?resource_category=32
```

The resource write shape is:

```json
{
  "community": 1,
  "program": 7,
  "resource_category": 32,
  "name": "Katosi Primary School Borehole"
}
```

`location_text` remains an optional free-text API field, but its product meaning
is specifically site detail within the Resource's Community. Administrative
geography is read from the related Community rather than repeated in the
Resource payload.

`program` is currently nullable in the API/database so existing data and
offline mutations remain valid; the resource create/edit UI requires it.
`resource_category` is nullable while the draft stakeholder matrix is
normalized. Resource responses include `program_name`, `thematic_area_id`,
`thematic_area_name`, and `resource_category_name`. A thematic-area identifier
is not accepted as an independent canonical Resource relationship.

The create/edit UI asks for Thematic Area first. That selection
filter the Program control; the saved Program determines the thematic area.
Resource Category will then be filtered by Program. Changing a parent selection
will clear incompatible child selections.

The existing `thematic_area_ids`, `primary_thematic_area_id`, and
`ResourceThematicArea` API remain in place during migration for compatibility
with existing records, queued offline mutations, reports, and approvals. Their
deprecation will occur only after classification backfill and client rollout.
Resource serializer writes automatically mark the selected Program's thematic
area as the primary legacy thematic link.

Soft-deleted rows are excluded by default. Use `?include_deleted=1` for
development/admin inspection.

Community list responses are UI-table ready and include:

```json
{
  "id": 1,
  "name": "KWDT Demo Community",
  "subcounty_name": "Central Demo Subcounty",
  "resident_count": 2450,
  "member_count": 1,
  "group_count": 1,
  "committee_count": 1,
  "cooperative_count": 1,
  "resource_count": 1,
  "institution_count": 1
}
```

The count fields support ordering through `?ordering=resident_count`,
`?ordering=member_count`, or their descending equivalents. `resident_count`
is the entered community population estimate; `member_count` is computed from
registered member records.

Read serializers include display names alongside relationship IDs where useful:
`community_name` for community-scoped records, `group_name` for members, and
`resource_name` plus `community_name` for impact records. IDs remain the write
contract for relationship fields.

Approval review actions are scope-aware: Programme Managers handle standard and
impact requests, M&E Managers handle impact requests, Finance Administrators
handle finance requests, and Executive Leadership can handle all three scopes.
Submitters cannot review their own requests.

Approval review actions now apply supported `submitted_payload` changes when
approved. `create`, `update`, and soft `delete` are supported for registered MVP
entities.

Approval enforcement is:

- operational creates and updates are direct
- all deletes are queued
- resource-domain creates and updates are queued for standard review
- resource value changes are queued for finance review
- repayment obligations, payments, and reversals are queued for finance review
- impact mutations are queued for impact review
- superusers retain a break-glass direct-write bypass

Temporary evaluation exception: `mvp_full_access` applies top-level,
non-financial Resource creates and updates directly with the authenticated
user recorded in the standard audit fields. Resource financial changes,
resource-related child records, archives, and deletes remain queued.

Financial transaction posting is intentionally online-only in this slice.
`sync/push` rejects `resource_payment_transaction` mutations, while authorized
financial users may pull confirmed records. Pending approval requests and local
drafts are excluded from confirmed payment summaries.

Approval requests include `review_scope`, `policy_reason`,
`submission_source`, and `base_sync_version`. An approval returns `409` instead
of applying when the target's `sync_version` changed after submission.

Entity serializers expose `approval_status`, `pending_approval_request_id`, and
`approval_history_count`. Full history is available through:

```text
/api/v1/approval-requests/?entity_type=resource&entity_id=1
```

Offline sync endpoints use a coarse record-version contract. `sync/pull`
returns grouped serialized records. `sync/push` detects `sync_version`
conflicts and applies clean create/update/delete changes through the same DRF
serializers used by the public API. Approval-gated changes return
`status=pending_approval` in the accepted list, with the approval request
included. Replaying the same approval-gated `client_mutation_id` returns the
existing request.
