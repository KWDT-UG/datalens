# Resource Lifecycle and Finance Design

## Evidence and product shape

The sample resource CSV is a catalogue of related workflows, not a single flat
form. It includes a common application process plus resource-specific records
for water facilities, livestock, tools, trees, construction, repairs, veterinary
treatment, and other support. Repeated concepts are applicant/beneficiary,
group and location, fund, dates, cost, amount paid, voucher, inspection, and
status. Capacity, construction, livestock, demographic, and GPS fields vary by
resource type.

The reference designs correctly make deposits, installment history, total paid,
total cost, and remaining balance prominent. Their resource-type sidebar does
not scale to the full CSV catalogue, so type remains a filter rather than the
primary information architecture.

## Information architecture

- Keep one top-level **Resources** workspace.
- Inventory is the default list; applications and maintenance become sibling
  workflow views as their domain slices are implemented.
- Every resource opens one canonical `/resources/:id` workspace.
- Community, group, and member pages reuse contextual resource cards and link
  to that canonical workspace.
- The workspace preserves its originating context: a resource opened from a
  group returns to that group, one opened from a member returns to that member,
  and a global inventory visit returns to Resources.
- Group context includes group-owned, direct group-beneficiary, and current
  member/household resources.
- Member context includes member-owned and member/household-beneficiary
  resources, with repayment standing visible only to authorized roles.

Resource lifecycle, beneficiary application, internal change approval,
repayment standing, archive state, and synchronization state are independent.
They must never be collapsed into one status.

Beneficiary entities and people reached are also distinct. A school water tank
has the school institution as its linked beneficiary entity, while its latest
impact record stores the number of students and staff served. The interface
must not present one linked school as though only one person benefits.
Individual students, staff, or institutional contacts must not be translated
into member beneficiary links unless they personally receive, control, or owe
payment for a distinct resource. Contacts, custodians, and responsible payers
are separate roles.

`serial_or_tag_number` remains optional because it is useful for identified
assets such as bicycles, solar lamps, livestock, tanks, and facilities, but not
every resource has one. The interface hides it when blank and labels it as an
optional asset identifier.

Quantities remain decimal API values for accurate storage and export, but the
interface removes insignificant trailing zeros: `1.00 tank` is displayed as
`1 tank`, while meaningful fractions such as `1.50 tonnes` display as
`1.5 tonnes`.

## Delivered slice: resource detail and repayment ledger

The first slice implements:

- resolved owner and beneficiary names with privacy masking
- individual, household, and collective beneficiary scope
- contextual group/member resource filters
- payment obligations per beneficiary and obligation type
- an explicit responsible payer who may differ from the beneficiary
- asset value separated from beneficiary repayable principal
- deposit, cadence, installment, start, and due terms
- append-only deposits/installments and other ledger entry types
- full reversal rather than silent transaction editing
- derived paid, credited, charges, remaining, percent, deposit, and standing
- finance-only read/write access and finance approval
- online-only monetary posting

MVP financial decisions:

- deposits reduce the repayable principal
- overpayments are rejected
- reversals are full-only
- financial terms become immutable after the first approved payment
- pending/rejected approvals and client drafts never affect confirmed totals
- a member may represent a household until Household becomes a first-class entity

## Next slice: beneficiary resource applications

Add `ResourceApplication` separately from both Resource and ApprovalRequest.
An application can be rejected or withdrawn without creating inventory.

Common fields:

- community and optional group context
- typed applicant/beneficiary
- requested resource type, subtype, quantity, and unit
- purpose, location, contact, applied/siting dates, and funding source
- status: draft, submitted, under review, approved, rejected, withdrawn, fulfilled
- decision date and reason
- estimated cost/currency
- beneficiary disaggregation
- provisional, versioned type-specific data
- optional fulfilled resource and fulfillment date

Fulfillment is an explicit procurement action that creates or links a planned
Resource. It is not an automatic side effect of approving the application.
Configurable type-specific schemas should wait until real reporting needs for
tanks, cows, toilets, wells, and other forms are confirmed.

## Following slice: maintenance and service costs

Add `ResourceMaintenanceEvent` for repair, preventive maintenance, treatment,
inspection, and other service activity.

Common fields:

- resource, event type, complaint/nature, and workflow status
- reported, scheduled, completed, and verified dates
- provider/contractor description
- actual cost and currency
- cost payer: KWDT, beneficiary, or other
- recoverable amount
- voucher/reference and notes

If the beneficiary pays directly, record the actual cost for analysis but create
no receivable. If KWDT advances a recoverable amount, explicitly create a linked
maintenance payment obligation. Never silently add maintenance cost to the
original acquisition principal.

## Deferred sophistication

- generated amortization schedules and rescheduling
- automatic overdue and penalty calculation
- partial reversals, reconciliation, refunds, and credits
- offline posting of money
- reminders and collection notifications
- document/file uploads
- first-class households
- governed resource-type form schemas
- beneficiary disaggregation such as girls, boys, teachers, and people with
  disabilities beyond the current total people-reached count
- livestock lineage/production, contractor registry, GIS, and microcredit

Microcredit should remain a separate loan domain rather than being forced into
the resource repayment ledger.
