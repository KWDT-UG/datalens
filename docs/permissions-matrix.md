# Permissions Matrix

The MVP RBAC model uses one primary business role per user. Roles are backed by
Django auth groups, while permissions are enforced through centralized
capabilities in `apps.common.permissions`.

## MVP Roles

| Role | Intended KWDT positions | MVP access |
| --- | --- | --- |
| `field_officer` | District Field Officers, Community Mobilisation Officer | Read; manage operational, resource, and impact records; submit approval requests |
| `programme_manager` | Programme, Project, and Gender & Social Inclusion Officers | Field Officer access; manage assigned reference taxonomy; submit archives; review standard and impact approvals; export |
| `executive_leadership` | Executive Director / Coordinator | Organization-wide read and export; review standard, impact, and finance approvals |
| `finance_administrator` | Finance & Administration Officer | Read and export; manage resource/value records; review finance approvals |
| `monitoring_evaluation_manager` | Monitoring & Evaluation Officer | Read and export; manage and archive impact records; review impact approvals only |
| `communications_viewer` | Communications & Outreach Officer | Read publication-oriented community, programme, resource, and impact data |
| `resource_procurement_officer` | Accounts & Procurement Assistant | Read; manage and archive resource records; submit approval requests |
| `system_administrator` | Designated technical operator | Read; manage users, roles, and system settings; no business approval authority |
| `mvp_full_access` | Authorized MVP stakeholders | Every product capability for temporary end-to-end evaluation |

## Capabilities

```text
read
manage_operations
manage_resources
manage_impact
archive_operations
archive_resources
archive_impact
restore_operations
restore_resources
restore_impact
mvp_delete_permanently
submit_for_approval
review_approvals
review_impact_approvals
review_finance_approvals
export
view_personal_data
view_resource_financials
manage_resource_financials
manage_users
manage_roles
manage_settings
manage_reference_data
```

Users without an assigned Data Lens role have no API access. Django `is_staff`
does not grant a product role. Django superusers retain break-glass access to
all capabilities.

`assign_role()` replaces any existing Data Lens role, enforcing one primary
role per user for MVP.

`mvp_full_access` is a temporary, explicitly assigned evaluation role. It does
not change the scope of permanent job roles. Its non-financial resource creates
and updates apply directly, while financial resource changes, resource-related
records, archives/deletes, impact changes, and other approval-gated mutations
remain queued. It does not allow users to review their own submissions. Limit
its use to authorized stakeholders, prefer demo or sanitized data, and remove
or redesign the role before production launch.

Role replacement is atomic and preserves the user's active authentication
tokens. An existing account can therefore be switched to `mvp_full_access` and
later restored to its former job role without a password reset or new login.
The user's browser must refresh its `/auth/me/` state to display the newly
effective navigation and capabilities.

## Approval Rules

- Programme Managers review standard and impact approvals.
- Executive Leadership reviews standard, impact, and finance approvals.
- M&E Managers review impact approvals only.
- Finance Administrators review finance approvals only.
- System Administrators do not receive business approval authority.
- MVP Full Access users may review every approval scope but cannot review their
  own submissions.
- Users cannot review their own submissions.
- Users without review authority see only approval requests they submitted.

## Mutation Policy

| Change | Behavior | Review scope |
| --- | --- | --- |
| Operational create/update | Applied directly | None |
| Any archive/delete | Queued before soft delete | Standard, impact, or finance according to the entity |
| Resource and resource-related create/update | Queued | Standard |
| Resource financial value change | Queued | Finance |
| Impact record create/update/delete | Queued | Impact |
| Thematic area/program/category create/update | Applied directly for authorized reference-data managers | None |

As a temporary evaluation exception, `mvp_full_access` applies top-level,
non-financial Resource creates and updates directly. Standard audit metadata is
still recorded. This exception does not apply to resource financial values,
resource-related child records, payments, archives, or deletes.

Resource financial review applies when `value_amount` is set on create, when
`value_amount` or `value_currency` changes, and when a valued resource is
archived. Django superusers retain a break-glass direct-write bypass.

Repayment obligations, payment transactions, and reversals always require
finance review for non-superusers. Only roles with
`manage_resource_financials` may submit them, and only roles with
`view_resource_financials` may read their amounts, balances, references, or
vouchers. Payment entries are append-only; corrections are approved reversals.

Only Finance Administrators, Executive Leadership, and Resource & Procurement
Officers can view resource financial values. Only Finance Administrators and
Resource & Procurement Officers can propose changes to those values.

## Assignment Scope

- Field Officers may be assigned to districts and explicit communities.
- Programme Managers may be assigned to districts, communities, and thematic
  areas. Thematic assignments scope the Program and Resource Category taxonomy
  as well as classified resource/community access.
- Once any assignment is configured for one of these roles, list, detail,
  dashboard, approval, report, and sync access is restricted to the resulting
  community scope.
- Empty assignments retain organization-wide access for backward-compatible
  rollout.
- Thematic assignments include communities with active resources linked to the
  assigned thematic area.
- Programme Managers with thematic assignments may create or update Programs
  and Resource Categories only within those areas. Creating a new top-level
  Thematic Area requires organization-wide reference-data scope.

## Admin Management

The product Admin UI and API allow System Administrators to:

- list and search user accounts
- invite staff, interns, volunteers, contractors, and other collaborators
- monitor and revoke pending invitations
- create a user with an initial password and one primary role
- update email, password, role, and active status
- inspect role capability definitions
- configure district, community, and thematic assignments

System Administrators and MVP Full Access users cannot deactivate themselves
or replace their own privileged role. Non-superusers cannot modify Django
superusers.

Workforce type and position title are descriptive account metadata. They do
not grant permissions; authorization continues to come only from the primary
Data Lens role.

## Privacy And Publication

- Member contact, birth-date, address, and notes fields are masked unless the
  user has `view_personal_data`.
- Institution contact and location fields use the same PII capability.
- Communications Viewer remains blocked from member, institution, membership,
  and approval endpoints.
- Communications Viewer resource and impact output removes internal audit,
  sync, exact owner/beneficiary identifiers, location, source, serial/tag, and
  notes fields.
- Restore is a direct, explicit action guarded by the matching restore
  capability. Viewing archived records is also restricted to archive/restore
  capable roles.
- Archive is reversible, non-cascading, and dependency-aware. Authorization is
  checked independently of relationship safety: even an authorized archive is
  rejected with `409 archive_blocked` while active structural dependents exist.
  Restore is similarly rejected until required parents are active.
- `mvp_delete_permanently` is a temporary test-data cleanup capability assigned
  only to `mvp_full_access` and Django staff/superusers. Permanent deletion is
  irreversible, typed-confirmation protected, and blocked by every stored
  relationship. It is not part of the intended production role matrix.
