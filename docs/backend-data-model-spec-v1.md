# Backend Data Model Spec v1

## Implemented

The governance slice is currently implemented under a shared
`backend/apps/participation/` app.

The resource slice, including thematic areas, programs, and resource
categories, is currently implemented under a shared `backend/apps/resources/`
app.

Impact and approval models are currently implemented in
`backend/apps/impacts/` and `backend/apps/approvals/`.

### UserProfile assignments

Authorization metadata implemented:

- `assigned_districts`
- `assigned_communities`
- `assigned_thematic_areas`

These assignments scope Field Officer and Programme Manager access. Empty
assignments preserve organization-wide access during rollout.

### Community

Community is the top-level boundary for this first backend slice.

Fields implemented:

- `name`
- `subcounty_name`
- `district_name`
- `region_name`
- `country`
- `resident_count` (optional non-negative community population estimate)
- `status`
- `notes`
- shared metadata fields

### Group

Group belongs to one Community.

Fields implemented:

- `community`
- `code`
- `name`
- `status`
- `formed_on`
- `closed_on`
- `meeting_day`
- `sub_county`
- `notes`
- shared metadata fields

Read-only API projections:

- `member_count`
- `female_count`
- `male_count`

`meeting_day` remains in the storage/API model for backward compatibility but
is no longer collected by the group UI. Meeting dates and attendance use the
event-oriented `GroupActivity` model instead of a single recurring weekday.

Constraints implemented:

- unique `(community, name)`
- unique `(community, code)`

Validation implemented:

- `closed_on` cannot be before `formed_on`

### GroupActivity

GroupActivity records a dated meeting or training for one Group and Community.
An optional Committee link identifies committee-specific meetings.

Fields implemented:

- `community`
- `group`
- optional `committee`
- `activity_type` (`meeting` or `training`)
- `title`
- `starts_at` and optional `ends_at`
- `status` (`planned`, `completed`, or `cancelled`)
- `location_text`
- `facilitator_name`
- optional expected, women, and men participant counts
- meeting `agenda`, `minutes`, and `decisions_actions`
- training `training_topic`, `objectives`, and `report_notes`
- `notes`
- shared metadata fields

Read-only API projections include `actual_participant_count` and
`record_status`. A completed record needs both gender attendance counts and a
meeting minute or report narrative to be considered complete.

Validation implemented:

- group and activity must belong to the same community
- an optional committee must belong to the same community
- only meetings may be linked to committees
- `ends_at` cannot be before `starts_at`

### Member

Member belongs to one Community and exactly one current Group in the MVP.

Fields implemented:

- `community`
- `group`
- `member_number`
- `first_name`
- `last_name`
- `middle_name`
- `preferred_name`
- `gender`
- `date_of_birth`
- `phone`
- `email`
- `group_position`
- `community_position`
- `address_text`
- `status`
- `joined_on`
- `left_on`
- `deceased_on`
- `notes`
- shared metadata fields

Validation implemented:

- member group must belong to the same community
- `left_on` cannot be before `joined_on`
- deceased members cannot have active status

`group_position` records a member's leadership or operational position within
their group, such as Chairperson or Treasurer. `community_position` records a
wider community or political position, such as a district councillor. Both are
optional free-text fields in the MVP.

### Institution

Institution belongs directly to Community and is not part of the Group hierarchy.

Fields implemented:

- `community`
- `code`
- `name`
- `institution_type`
- `status`
- `contact_name`
- `phone`
- `email`
- `location_text`
- `notes`
- shared metadata fields

Constraints implemented:

- unique `(community, name)`
- unique `(community, code)` when `code` is not blank

### Committee

Committee belongs to one Community.

Fields implemented:

- `community`
- `name`
- `committee_type`
- `status`
- `description`
- `formed_on`
- `closed_on`
- shared metadata fields

Validation implemented:

- `closed_on` cannot be before `formed_on`

### CommitteeMembership

CommitteeMembership links Member participation to a Committee.

Fields implemented:

- `committee`
- `member`
- `role_name`
- `status`
- `start_date`
- `end_date`
- `notes`
- shared metadata fields

Read-only API member context:

- `member_name`
- `member_number`
- `member_gender`
- `member_group_id`
- `member_group_name`

Validation implemented:

- member must belong to the same community as the committee
- `end_date` cannot be before `start_date`
- duplicate active memberships for the same committee/member pair are blocked

### Cooperative

Cooperative belongs to one Community.

Fields implemented:

- `community`
- `name`
- `cooperative_type`
- `status`
- `description`
- `formed_on`
- `closed_on`
- shared metadata fields

Validation implemented:

- `closed_on` cannot be before `formed_on`

### CooperativeMembership

CooperativeMembership links Member participation to a Cooperative.

Fields implemented:

- `cooperative`
- `member`
- `role_name`
- `status`
- `start_date`
- `end_date`
- `notes`
- shared metadata fields

Validation implemented:

- member must belong to the same community as the cooperative
- `end_date` cannot be before `start_date`
- duplicate active memberships for the same cooperative/member pair are blocked

### ThematicArea

ThematicArea is global for the MVP and is not community-scoped.

Fields implemented:

- `code`
- `name`
- `description`
- `status`
- shared metadata fields

Constraint implemented:

- unique `code`

Legacy compatibility: thematic areas continue to support the older
`ResourceThematicArea` links while resource records are migrated to the new
Program hierarchy.

### Program Classification

Status: implemented as an additive, backward-compatible rollout.

The classification hierarchy will be:

```text
ThematicArea -> Program -> ResourceCategory -> Resource
```

`Program` is global reference data and belongs to exactly one `ThematicArea`.
Fields implemented:

- `thematic_area`
- `code`
- `name`
- `description`
- `status`
- `display_order`
- shared metadata fields

Constraints implemented:

- unique `(thematic_area, code)`
- unique `(thematic_area, name)`

`ResourceCategory` represents controlled leaf values from the stakeholder
resource matrix, such as `Borehole`, `Boat`, or `Financial Literacy Training`.
It avoids treating a reusable category as though it were an individual resource
record. Fields implemented:

- `program`
- `code`
- `name`
- `description`
- `status`
- optional `default_resource_type`
- `display_order`
- shared metadata fields

The agreed classification rule is:

- every Program belongs to exactly one ThematicArea
- every Resource belongs to exactly one primary Program
- a Resource's ThematicArea is determined through its Program
- ResourceCategory remains optional during taxonomy cleanup and may become
  mandatory after stakeholder confirmation

The database currently permits a null Resource program for legacy records and
offline compatibility. The create/edit frontend requires Program for new and
edited resources. The field will become non-nullable after existing records
have been reconciled.

Thematic areas, programs, and resource categories are organization-wide
reference data. They do not belong directly to communities or groups. A
Resource continues to connect classification to a Community through
`Resource.community`, and to groups, members, institutions, cooperatives, or
the community through its owner and beneficiary relationships.

If KWDT later needs to record where a program is formally operating, that
should use a separate time-aware `ProgramImplementation` or `CommunityProgram`
model. Program coverage must not be inferred solely from taxonomy or embedded
into the global Program record.

Reference-data writes require the dedicated `manage_reference_data`
capability. The product management surface uses status changes instead of hard
deletion. Programme Managers with thematic-area assignments may manage Programs
and ResourceCategories only inside those assigned areas.

### Resource

Resource belongs to one Community and stores a typed current owner.

Fields implemented:

- `community`
- `owner_type`
- `owner_id`
- `resource_type`
- `name`
- `description`
- `quantity`
- `unit`
- `value_amount`
- `value_currency`
- `acquired_on`
- `status`
- `location_text`
- `serial_or_tag_number`
- `source_notes`
- shared metadata fields

`location_text` represents site-level detail within the selected Community,
such as a village, school, landing site, facility, or landmark. Subcounty,
District, Region, and Country are derived from `Resource.community` and are not
duplicated on Resource. If future requirements allow resources physically
outside their recorded Community, that should be modeled as an explicit
structured override rather than silently contradicting Community geography.

Validation implemented:

- owner must resolve from `owner_type` and `owner_id`
- owner must belong to the same community as the resource

Classification fields implemented:

- nullable `program` during the compatibility/backfill period
- nullable `resource_category` while the working taxonomy is finalized
- read-only derived thematic-area ID/name projections through Program

Do not add an independent required
`thematic_area` field to Resource: once Program is present, storing both would
duplicate the hierarchy and permit contradictory combinations.

Validation implemented:

- ResourceCategory cannot be supplied without Program
- ResourceCategory must belong to the selected Program
- a Program in use cannot be moved to another ThematicArea through the API
- a ResourceCategory in use cannot be moved to another Program through the API
- serializer writes keep the Program's ThematicArea as the primary legacy
  ResourceThematicArea link during migration

### ResourceBeneficiary

ResourceBeneficiary stores typed beneficiary relationships separately from
resource ownership.

Fields implemented:

- `resource`
- `beneficiary_type`
- `beneficiary_id`
- `relationship_type`
- `benefit_scope` (`individual | household | collective`)
- `notes`
- shared metadata fields

Validation implemented:

- beneficiary must resolve from `beneficiary_type` and `beneficiary_id`
- beneficiary must belong to the same community as the resource
- individual and household scope require a member beneficiary
- collective scope is used for group, cooperative, institution, or community beneficiaries
- an active beneficiary cannot be duplicated on the same resource

For MVP household resources, the member beneficiary is the accountable
household representative. A separate Household model remains deferred.

### ResourcePaymentObligation

ResourcePaymentObligation stores agreed repayment terms separately from the
resource's asset value. It is scoped to a resource beneficiary but may name a
different responsible payer in the same community.

Fields implemented:

- `resource`
- `resource_beneficiary`
- `responsible_party_type`
- `responsible_party_id`
- `obligation_type` (`acquisition | maintenance | other`)
- `principal_amount`
- `currency`
- `deposit_required_amount`
- `payment_frequency`
- `installment_amount`
- `starts_on`
- `due_on`
- `status`
- `terms_notes`
- shared metadata fields

Validation implemented:

- beneficiary must belong to the selected resource
- responsible payer must belong to the resource community
- principal and installment values are positive; deposit is part of and cannot exceed principal
- currency is a three-letter ISO code
- only one open obligation of each type may exist per resource beneficiary
- financial terms cannot change after the first approved deposit or installment

### ResourcePaymentTransaction

ResourcePaymentTransaction is an append-only financial ledger. Confirmed
transactions derive paid, credited, charged, remaining, deposit, and repayment
state values; pending approval requests are not counted.

Fields implemented:

- `obligation`
- `entry_type` (`deposit | installment | penalty | fee | waiver | refund | adjustment_debit | adjustment_credit | reversal`)
- `amount`
- `effective_on`
- `reference`
- `voucher_number`
- `notes`
- optional typed `received_from` party
- optional `reverses` link
- `recorded_by_user_id`
- shared metadata fields

Rules implemented:

- amounts are positive and use the obligation currency
- payments or credits cannot exceed the confirmed balance
- posting revalidates under a database row lock
- transactions cannot be patched or deleted through the API
- corrections use one full reversal linked to the original entry
- a transaction cannot be reversed twice and a reversal cannot be reversed

### ResourceThematicArea

ResourceThematicArea links Resource to ThematicArea.

Fields implemented:

- `resource`
- `thematic_area`
- `is_primary`
- shared metadata fields

Constraint implemented:

- unique `(resource, thematic_area)`

### ResourceStatusEvent

ResourceStatusEvent preserves event-based resource history.

Fields implemented:

- `resource`
- `event_type`
- `effective_at`
- `notes`
- `recorded_by_user_id`
- shared metadata fields

### ImpactRecord

ImpactRecord stores time-based resource impact data, optionally scoped to a
specific beneficiary.

Fields implemented:

- `resource`
- `beneficiary_type`
- `beneficiary_id`
- `period_type`
- `period_start`
- `period_end`
- `as_of_date`
- `beneficiary_count`
- `household_count`
- `member_count`
- `institution_count`
- `notes`
- `method`
- `recorded_by_user_id`
- shared metadata fields

Validation implemented:

- beneficiary type and beneficiary id must be provided together
- beneficiary, when present, must belong to the same community as the resource
- `period_end` cannot be before `period_start`

### ApprovalRequest

ApprovalRequest stores proposed changes for later review.

Fields implemented:

- `community`
- `entity_type`
- `entity_id`
- `action_type`
- `submitted_payload`
- `diff_summary`
- `review_scope`
- `policy_reason`
- `submission_source`
- `base_sync_version`
- `status`
- `submitted_by_user_id`
- `submitted_at`
- `reviewed_by_user_id`
- `reviewed_at`
- `review_notes`
- `applied_at`
- shared metadata fields

Behavior implemented:

- policy-gated create/update/delete submissions
- standard, impact, and finance review scopes
- API, offline-sync, and manual submission sources
- optimistic target-version checking through `base_sync_version`
- role-scoped approve/reject/supersede actions
- approved requests apply supported payloads
- rejected and superseded requests preserve history without applying payloads

## Shared Metadata

Implemented on the first four models:

- `created_at`
- `updated_at`
- `created_by_user_id`
- `updated_by_user_id`
- `client_created_at`
- `client_updated_at`
- `client_mutation_id`
- `sync_version`
- `is_deleted`

These fields prepare the backend for future audit and offline-sync behavior
without finalizing the sync engine.

### SyncMutationReceipt

Fields:
- id
- user_id
- client_mutation_id
- request_fingerprint
- response_payload
- created_at
- updated_at

Constraint:
- unique `(user_id, client_mutation_id)`

The receipt preserves direct-write idempotency after the target record receives
later mutations and rejects reuse of one mutation ID for different request
data.

## Deferred

The current deferred MVP work is now beyond the core schema slices covered so
far.
