# Offline Sync Design

## Current Scope

Offline sync uses a record-version contract, persistent browser queues, and
server-issued cursors. It supports the MVP's create/update/archive forms without
introducing an automatic field merge engine.

Every MVP entity uses shared metadata fields:

- `client_created_at`
- `client_updated_at`
- `client_mutation_id`
- `sync_version`
- `is_deleted`

API updates and soft deletes increment `sync_version`. This gives clients a
simple value to compare when detecting stale offline mutations.

## Endpoints

```text
GET /api/v1/sync/pull/
POST /api/v1/sync/push/
```

`sync/pull` returns serialized records grouped by entity type. It supports:

- `entity_type`
- `updated_after`
- `include_deleted`
- `cursor`
- `page_size`, capped at 200

`sync/push` accepts a batch of client changes, detects conflicts, and validates
clean create/update/delete changes through the same DRF serializers used by the
public API. The centralized approval policy then either applies or queues each
change.

Cursor pulls require one `entity_type`. The opaque cursor represents the last
`(updated_at, id)` position returned by the server. Clients continue while
`has_more=true`, passing `next_cursor` into the next request. This avoids the
old per-entity pull limit without relying on client clocks. The final non-empty
page also returns a cursor that may be retained as the next incremental sync
checkpoint.

## Conflict Detection

The current conflict rule is intentionally narrow:

- if the client sends `sync_version`
- and the server record has a different `sync_version`
- the change returns a `version_mismatch` conflict with the current server row

Missing server records return a `not_found` conflict.

Clean changes are applied only when no record-level conflict is found for that
change. The response separates `accepted`, `conflicts`, and `errors`.

Field-level merge policy is intentionally explicit: the client never
automatically combines local and server fields. The conflict review UI shows
both versions and offers:

- **Keep server**, which discards the queued local change
- **Retry local version**, which resubmits the complete local payload against
  the latest server `sync_version`

This is a deliberate last-writer decision by a user, not an implicit merge.

## Browser Queue

Dexie stores user-partitioned drafts, pending mutations, and cursor-ready local
state. Create and edit forms restore autosaved drafts. Mutations made while
offline, or interrupted by a network failure, retain one stable
`client_mutation_id` and move through:

```text
pending -> syncing -> synced
                    -> pending_approval
                    -> failed
                    -> conflict
```

The Sync Center displays these states per queued record, retries failed work,
and automatically replays pending batches when connectivity returns. Pushes are
sent in batches of 25.

TanStack Query mutations use `networkMode: 'always'`. This is required so the
application's mutation function runs while offline and can place the change in
Dexie instead of TanStack Query pausing it until connectivity returns.

Direct creates, updates, and deletes store a durable per-user mutation receipt.
Replays return the original accepted result even after the target receives
later edits. Reusing one mutation ID for different request data is rejected.
Approval-gated replays return the existing approval request. A deliberate
retry-local conflict decision receives a new mutation ID.

Financial safety exception: resource payment transactions and reversals are
online-only. They are not admitted to `sync/push` or the browser mutation queue,
because a delayed or duplicated monetary post could corrupt the confirmed
ledger. Authorized users may pull confirmed financial records. Offline payment
drafts and fully idempotent financial replay remain follow-up work.

## Offline Approval Behavior

- approval-gated changes return `status: pending_approval`
- the accepted item includes the serialized approval request
- the target record remains unchanged until approval
- `submission_source` is `offline_sync`
- `base_sync_version` records the server version checked during push
- replaying the same approval-gated `client_mutation_id` returns the existing
  approval request instead of creating another
- approval fails with `409` if the target changed before review

## PWA Behavior

The production build registers an auto-updating service worker, precaches the
application shell, and ships 192px, 512px, and maskable icons. Run
`make frontend-pwa-check` to build and verify the manifest, icons,
service-worker registration, update activation, and cached shell. CI and the
staging-image workflow run the same check.

Run `make frontend-pwa-e2e` for browser-level verification in Chromium. It
starts the production stack and verifies service-worker control, manifest
installability, an offline application-shell reload, IndexedDB mutation
queueing, and automatic replay after reconnecting.

The app icons use KWDT's official organization logo from
`https://katosi.org/images/kwdt-logo.webp`. The source logo is retained as
`frontend/public/kwdt-logo.webp`; square and maskable derivatives preserve the
complete wordmark and keep it inside the PWA safe crop area.

Authenticated API data is not generally cached by the service worker. Offline
data entry relies on restored drafts and queued writes; previously loaded API
screens are not promised as a complete offline read replica.
