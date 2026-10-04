# Operational Domain Boundaries

## Purpose

This document is the working architecture guide for the operational and
financial information that stakeholders want KWDT Data Lens to manage around
resources, repayments, microcredit, maintenance, production, and accounting.

It is intentionally a decision document rather than an implementation
specification. Each boundary should be reviewed with stakeholders before its
models, API, permissions, or interface are finalized. Open questions are kept
with the relevant boundary so that one area can be discussed without silently
settling another.

## Decision status

The terms used in this document have the following meanings:

- **Implemented**: present in the current application and covered by the
  existing implementation documentation.
- **Recommended**: the proposed architecture, but not yet an accepted product
  decision.
- **Deferred**: deliberately excluded from the first delivery of that domain.
- **Open**: requires stakeholder confirmation before implementation.

No recommended item in this document should be treated as approved merely
because it is documented here.

## Guiding principles

1. A Resource remains an asset or intervention record, not a container for
   every operational and financial fact associated with it.
2. Asset value, beneficiary repayment, maintenance cost, loan balance, and
   accounting entries are separate concepts.
3. Financial and operational history is recorded as dated events or
   append-only transactions. Historical records must not be replaced by a
   current total.
4. A contextual Community, Group, or Member view may summarize another domain,
   but the underlying record has one canonical workspace and source of truth.
5. Data Lens should support field operations and programme accountability
   without prematurely becoming a general accounting system.
6. Sensitive financial details require explicit permissions and must not be
   exposed merely because a user can view a Community, Group, Member, or
   Resource.
7. Financial posting remains online-only until a safe offline reconciliation
   design has been accepted.

## Boundary map

| Concern | Domain owner | Status | Core distinction |
| --- | --- | --- | --- |
| Physical assets and interventions | Resource inventory | Implemented | What exists, where it is, who owns it, and who benefits |
| Beneficiary installments for an asset | Resource finance | Implemented foundation | What a beneficiary agreed to repay for a Resource |
| Repairs, treatments, and renovations | Resource maintenance | Recommended | Work performed on a Resource and the cost of that work |
| Milk production, offspring, water supplied, and similar outcomes | Resource performance | Recommended | Time-based outputs or observations produced by a Resource |
| Microcredit loans | Loans | Recommended | A financial agreement with its own approval, disbursement, repayment, and closure lifecycle |
| General accounting and financial statements | QuickBooks/accounting integration | Recommended boundary | Formal accounting remains outside Data Lens; operational records are referenced and reconciled |

The boundaries are related, but they must not be flattened into additional
columns on `Resource` or into a single ambiguous payment table.

## 1. Resource inventory

### Responsibility

The Resource domain answers:

- What asset or intervention exists?
- Which Community does it belong to?
- Who currently owns or controls it?
- Which parties benefit from it?
- How is it classified by Thematic Area, Program, and Resource Category?
- What is its current lifecycle status?

### Current implementation

The application currently implements Resource, ResourceBeneficiary,
ResourceThematicArea, ResourceStatusEvent, Program, and ResourceCategory.
Resource details provide the canonical workspace used by global and contextual
views.

`Resource.value_amount` represents the recorded asset or acquisition value.
It is not a running account balance and must not be changed as installments or
maintenance costs are recorded.

### Working Stage 1 direction

The architecture should distinguish acquisition cost, estimated or fair value,
beneficiary obligation, and the grant, donation, or other funding contribution.
For a donated Resource, both acquisition cost and estimated value may be shown.

Unknown, not-applicable, confirmed-zero, and recorded acquisition costs have
different meanings and must be distinguishable in stored data. Zero means a
confirmed zero cash cost. Estimated value should carry an as-of date, valuation
basis or method, and source where practical.

Forms should use persistent helper text and accessible tooltips where useful.
Read views should display explicit meanings such as `Not recorded`, `Not
applicable`, and `UGX 0 — no acquisition cost`; tooltips must not be the only
explanation.

The beneficiary obligation remains valid when a grant or donation funded the
Resource. It represents beneficiary cost sharing and reuse of limited funding,
not a change to the Resource's value. Explicit funding arrangements will be
modeled later and may link the subsidized portion to grants or donations.

This direction remains provisional pending KWDT leadership approval.

### Outside this boundary

- a microcredit loan account
- accumulated payment totals
- individual repair or treatment costs
- periodic production measurements
- QuickBooks ledger accounts

### Open decisions

- Should `value_amount` always mean acquisition cost, or may it sometimes be a
  later valuation? If both are needed, valuation history should become a
  separate future record.
- Which Resource Categories represent individually tagged assets, shared
  facilities, consumable distributions, or services?
- Which Resource lifecycle states are required beyond the current MVP status
  set?

### Decision gate

Before expanding Resource fields, confirm that the proposed field describes
the asset itself and is not actually a payment, maintenance event, loan term,
or time-based outcome.

## 2. Resource repayment and beneficiary installments

### Responsibility

Resource finance answers:

- How much of a particular Resource cost is a beneficiary expected to repay?
- Who is responsible for payment?
- What deposit, installment amount, cadence, and dates were agreed?
- Which payments have been confirmed?
- What balance and repayment standing are derived from those confirmed entries?

### Current implementation

The implemented foundation uses:

- `ResourcePaymentObligation` for agreed repayment terms;
- `ResourcePaymentTransaction` for append-only deposits, installments, fees,
  adjustments, waivers, refunds, and reversals;
- finance approval before entries affect confirmed totals;
- full reversal rather than editing or deleting a confirmed payment;
- financial visibility and mutation capabilities;
- online-only monetary posting.

### Working Stage 1 direction

An obligation belongs to the party accountable under the KWDT agreement. For
a shared Resource this will ordinarily be one Group, Cooperative, Institution,
or other supported accountable party. Each payment may identify the actual
party who handed it in without transferring or dividing the obligation.
Separate Member obligations are created only when KWDT explicitly assigns
individual repayable amounts.

A required deposit is the first payment against the beneficiary principal, not
an additional charge. Application, processing, transport, service, and similar
fees must be identified separately.

Repayment terms should support an explicit installment schedule. Regular
weekly or monthly schedules may be generated, while seasonal or irregular
agreements may use a manually entered custom schedule. Each installment should
retain its expected amount, due date, amount satisfied, and standing. Payments
should ordinarily satisfy the oldest unpaid installment first.

The interface should derive the next amount due, currently overdue amount, and
overall outstanding balance from the schedule and confirmed transactions. An
agreed grace period may delay overdue classification. Rescheduling must preserve
the original schedule and record the replacement terms, reason, approver, and
effective date rather than rewriting history.

These directions remain provisional pending KWDT leadership approval and
confirmation of detailed operating rules.

For the initial implementation, payment access should remain capability-based
but deliberately permissive enough for workflow validation:

- designated Field/Programme staff, Resource & Procurement Officers, Finance
  Administrators, Executive Leadership, System Administrators, and the
  temporary MVP Full Access role may view and submit payment information;
- Finance Administrators, Executive Leadership, System Administrators, and the
  temporary MVP Full Access role may perform finance confirmation;
- no user may confirm their own submission;
- pending entries are visible as pending but do not affect confirmed balances;
- assignment scoping should still apply where assignments exist.

System Administrator access is an explicit temporary product-validation
exception rather than a permanent assumption that technical administrators are
business approvers. Capabilities must remain centralized so the role matrix can
be tightened without changing payment models or API behavior once KWDT confirms
the operating responsibilities.

Payment submissions should capture the obligation, amount and inherited
currency, effective date, payment method, actual payer, and submitting user.
Supported initial methods should be cash, mobile money, bank transfer, and
other. Mobile-money and bank-transfer entries should require an external
transaction reference; `other` should require an explanation. Receipt or
voucher number, collection location, and notes may also be recorded. Data Lens
must not collect unnecessary bank-account or mobile-money account details.

Receipt, voucher, bank-slip, and other payment evidence should support document
or photo upload. File content should not be stored in PostgreSQL or embedded in
the payment row. Store private objects in managed object storage and retain
metadata in Data Lens, including document type, original filename, media type,
size, storage key, checksum, upload status, uploader, and timestamps.

The document record must remain associated with the pending finance submission
and, after approval, with the confirmed transaction. Rejected submissions must
retain their evidence according to the agreed audit and retention policy.
Confirmed evidence must not be silently replaced or deleted; corrections
should preserve the original and add a superseding document or an audited
administrative action.

Uploads require private access, authorization checks, encryption, file-size and
media-type validation, malware scanning, and time-limited download URLs. Photo
handling should account for bandwidth, image compression, and removal of
unnecessary EXIF location data. The user interface may offer direct camera
capture on supported mobile devices, preview, upload progress, and retry.

Evidence upload should initially be supported but not universally mandatory
until KWDT confirms receipt practices, connectivity, retention, and acceptable
exceptions. Cash entries should at least support a receipt or voucher number;
whether a photo is required may later be configured by payment method, amount,
or programme policy. Financial submission and file upload remain online-only
for the initial implementation.

Fees, penalties, waivers, and debit or credit adjustments should initially be
manual, separately itemized, and finance-approved ledger entries. Data Lens
must not calculate or post late penalties automatically until KWDT confirms the
policy. Each charge or credit requires an effective date and reason; waivers
also require an identified approving authority. These entries must remain
separate from principal and beneficiary payments so reports can explain how a
balance was produced.

The Resource value and repayable principal are intentionally separate. A
Resource valued at UGX 2,000,000 can have a beneficiary obligation of UGX
1,200,000 without changing either concept.

### Recommended interface

The canonical Resource workspace should continue to show repayment terms,
payment progress, confirmed transactions, and outstanding balance under
**Payments & costs**. Community, Group, and Member views may show a privacy-
filtered summary and link back to that workspace.

### Outside this boundary

- independent microcredit loans
- formal bank or cash-account reconciliation
- the operational details of a repair or veterinary treatment
- automatically generated accounting journal entries

### Open decisions

- How is an installment considered overdue when there is a recurring cadence
  but only one final due date is currently stored?
- Are interest, penalties, fees, grace periods, and rescheduling used for asset
  repayments?
- Who may record a payment, and which finance role confirms it?
- Are receipts or supporting documents required?
- Which payment channels and external reference numbers must be captured?

### Decision gate

Confirm repayment rules before adding generated installment schedules,
automatic arrears, reminders, partial reversals, or offline payment posting.

## 3. Resource maintenance and service costs

### Responsibility

Maintenance answers:

- What problem, inspection, repair, treatment, or renovation occurred?
- When was it reported, scheduled, completed, and verified?
- Who performed the work?
- What did it cost, and who paid?
- Is any part of that cost recoverable from a beneficiary?

### Recommended model

Introduce `ResourceMaintenanceEvent` with common fields such as:

- Resource
- event type: repair, renovation, preventive maintenance, inspection,
  veterinary treatment, or other service
- complaint, diagnosis, or work description
- workflow status
- reported, scheduled, completed, and verified dates
- provider or contractor description
- actual cost and currency
- cost payer: KWDT, beneficiary, or another party
- recoverable amount
- voucher, invoice, or external accounting reference
- notes and audit metadata

The event records the operational work even when no money is owed to KWDT.

If a beneficiary pays the provider directly, record the cost for programme
analysis but create no Data Lens receivable. If KWDT advances a recoverable
cost, explicitly link the event to a maintenance-type
`ResourcePaymentObligation`. Never silently add a repair cost to the original
acquisition obligation.

### Recommended interface

- Add a **Maintenance** section to the canonical Resource workspace.
- Show open issues, scheduled work, completed work, costs, and verification.
- Add contextual alerts to Group or Community views only when useful, such as
  overdue repairs or resources currently out of service.
- Keep the complete event history in the Resource workspace.

### Outside this boundary

- beneficiary loan repayments
- resource production measurements
- contractor accounting or payroll
- a full procurement or inventory-parts system

### Open decisions

- Which maintenance event types are needed initially for tanks, buildings,
  livestock, bicycles, water systems, and other assets?
- Who reports, approves, verifies, and closes maintenance work?
- Does KWDT need estimates and approvals before work, or only actual costs?
- Are providers free-text initially, or must they be managed entities?
- Which events make a Resource unavailable or change its lifecycle status?

### Decision gate

Agree on the minimum maintenance workflow and responsibilities before deciding
whether estimates, work orders, providers, attachments, or service schedules
are first-class records.

## 4. Resource performance and production

### Responsibility

Resource performance answers time-based questions such as:

- How much milk did a cow produce during a period?
- How many offspring were born, and when?
- How much water did a system supply?
- What other measurable output or condition should programme staff monitor?

These values are observations or outcomes, not static Resource fields.

### Recommended model direction

Use governed metric definitions associated with relevant Resource Categories,
plus dated or period-based metric records. A future design may include:

- `ResourceMetricDefinition`: code, label, value type, unit, applicable Resource
  Categories, reporting cadence, and status;
- `ResourceMetricRecord`: Resource, metric definition, observation date or
  reporting period, numeric or permitted value, unit, notes, and recorder.

Examples:

- cow / milk production / 42 litres / week ending 4 October 2026
- cow / offspring born / 1 calf / 4 October 2026
- tank / water supplied / 12,000 litres / September 2026

Repairs remain maintenance events. A stable characteristic such as tank
capacity may belong to governed Resource specifications rather than a periodic
metric. People reached remains an ImpactRecord concern unless stakeholders
define a more specific operational measure.

### Recommended interface

- Show a **Performance** section only for Resource Categories with governed
  metrics.
- Present trends and recent records, with a clear period and unit.
- Keep metric entry constrained to approved definitions rather than arbitrary
  user-created field names.

### Outside this boundary

- maintenance work and repair costs
- beneficiary repayments
- accounting income
- unrestricted JSON or a universal form builder

### Open decisions

- Which measurements are actually used for decisions or reporting?
- What cadence and unit apply to each measurement?
- Are measurements recorded per animal, herd, facility, or beneficiary?
- Does offspring tracking require individual animal identity and lineage, or
  only aggregate counts?
- Who records and verifies the data?
- How should performance records relate to existing ImpactRecords?

### Decision gate

Obtain a short, confirmed metric catalogue for the first one or two Resource
Categories before designing a generalized schema. Do not implement a generic
form engine solely from hypothetical examples.

## 5. Microcredit loans

### Responsibility

The Loan domain answers:

- Who borrowed money, for what purpose, and under which product or Program?
- What amount was approved and disbursed?
- What repayment terms apply?
- What payments, adjustments, or reversals occurred?
- What is outstanding, due soon, overdue, restructured, closed, or written off?

### Recommended boundary

A microcredit loan is not a Resource. It has an independent financial
lifecycle and should not be forced into Resource inventory or the Resource
repayment ledger.

This is the accepted working direction for the architecture walkthrough, but
remains subject to confirmation by KWDT leadership.

Potential core records are:

- `LoanProduct`: governed product such as business or education loan;
- `Loan`: borrower, Community/Group context, purpose, principal, currency,
  terms, dates, and status;
- `LoanTransaction`: disbursement, repayment, fee, interest, waiver,
  adjustment, write-off, or reversal as accepted by policy;
- `LoanStatusEvent`: submission, approval, disbursement, suspension,
  restructuring, closure, and other lifecycle history.

A borrower should be an explicitly supported party, potentially Member, Group,
Cooperative, or Institution. The supported borrower types remain an open
product decision.

The existing `Micro Loans` Program and `Business Loan`/`Education Loan`
Resource Categories are transitional classification data. They must not by
themselves determine that every loan is a Resource. Once the Loan domain is
accepted, those concepts should be reviewed as Loan Products or purpose
classifications and migrated deliberately.

### Recommended Group experience

Group details may include a **Loans** view similar in prominence to upcoming
trainings. It should summarize records from the canonical Loan domain:

- active loans
- total outstanding, subject to permission
- amount paid
- overdue loans
- payments due soon
- borrower and purpose
- next expected payment

Selecting a loan should open a canonical Loan workspace. Creating a loan from
a Group may preselect the Community and Group context but must still use the
same Loan workflow and permissions.

### Outside this boundary

- physical inventory
- asset maintenance
- QuickBooks general-ledger accounts
- informal savings unless stakeholders explicitly add a savings domain

### Open decisions

- Who can borrow: Member, household, Group, Cooperative, Institution, or more
  than one of these?
- Is a first-class Household required before household lending is recorded?
- Are interest and fees charged? If so, how are they calculated?
- Are schedules flat, reducing-balance, weekly, monthly, seasonal, or custom?
- How are grace periods, missed installments, rescheduling, refinancing,
  write-offs, and guarantors handled?
- Is approval separate from disbursement?
- Can one borrower hold multiple active loans?
- Which loan purposes and business types must be reported?
- Which staff roles may view member-level balances?
- Is the existing loan register in QuickBooks, spreadsheets, or another system,
  and which system currently holds the authoritative balance?

### Decision gate

Do not implement loan calculations or migrate existing records until the
borrower, interest, schedule, arrears, approval, and source-of-truth rules are
confirmed using representative real loan examples.

## 6. Accounting and QuickBooks integration

### Responsibility

Data Lens should be the operational source for questions such as who received
support, what agreement applies, what field payment was recorded, what asset
was repaired, and what programme outcome was observed.

QuickBooks should remain the accounting source for:

- the chart of accounts and general ledger
- bank and cash reconciliation
- formal income and expenses
- financial statements
- tax and statutory accounting

### Recommended integration boundary

Data Lens may capture an operational financial transaction and route it through
programme and finance approval. Once posted or matched in QuickBooks, Data Lens
should retain reconciliation metadata such as:

- QuickBooks transaction or reference ID
- export or synchronization status
- reconciliation status and date
- reconciled by
- discrepancy notes

This supports traceability without reproducing double-entry accounting inside
Data Lens.

Start with a controlled CSV export/import or reconciliation report if that
matches the organization's workflow. A direct QuickBooks API integration
should follow only after identifiers, mappings, error handling, and ownership
of corrections are understood.

### Outside this boundary

- building a second chart of accounts
- bank feeds and bank reconciliation
- tax calculations
- financial statements
- payroll
- silently considering an operational entry posted in QuickBooks without an
  explicit match or acknowledgement

### Open decisions

- Which QuickBooks product and organization configuration is in use?
- Which Data Lens transactions must appear in QuickBooks?
- Where is each transaction first recorded today?
- Who owns reconciliation and correction?
- Which identifiers can reliably connect the two systems?
- What import/export cadence is acceptable?
- May QuickBooks update Data Lens status, or is reconciliation one-way?

### Decision gate

Create a source-of-truth and field-mapping matrix using real QuickBooks samples
before implementing exports, imports, or API synchronization.

## Cross-cutting controls

### Permissions and privacy

Financial summaries and transaction details require capabilities separate from
ordinary Resource, Group, or Member viewing. Contextual pages must use the same
privacy rules as the canonical Loan or Resource workspace.

### Approval

Operational changes and financial confirmation are separate responsibilities.
An approved maintenance event does not automatically approve its financial
transaction, and an approved loan does not necessarily mean that funds were
disbursed.

### Audit history

Confirmed financial entries should remain append-only and be corrected through
explicit reversals or accepted adjustment workflows. Lifecycle changes should
retain dated status history.

### Offline behavior

Non-financial drafts may be candidates for later offline synchronization.
Payment, disbursement, reversal, and reconciliation operations should remain
online-only until duplicate prevention and financial conflict handling are
proven.

### Reporting

Reports should identify their source domain. Asset value, outstanding Resource
repayments, outstanding Loans, maintenance cost, and production output must not
be added together or presented under one ambiguous `value` total.

## Proposed walkthrough and delivery stages

The stages below are discussion and decision stages first. Implementation
starts only after the relevant decision gate is accepted.

### Stage 1: Validate Resource and repayment semantics

- Confirm the meaning of asset value and repayable principal.
- Review the existing Resource payment workflow with representative records.
- Resolve cadence, overdue, receipt, and payment-channel questions.
- Decide whether the existing foundation needs correction before expansion.

Deliverable: accepted Resource finance rules and an updated model/API contract.

### Stage 2: Define the Loans MVP

- Walk through real active microcredit examples.
- Confirm borrower types, products, purposes, approvals, disbursement, interest,
  schedules, arrears, privacy, and the current source of truth.
- Define the Group summary and canonical Loan workspace.
- Agree on migration treatment for the current loan-related Resource
  classifications.

Deliverable: accepted Loan domain specification and UI workflow.

### Stage 3: Implement and validate Loans

- Implement models, API, permissions, approvals, tests, and audit rules.
- Add the canonical Loan workspace and contextual Group presentation.
- Validate balances against representative stakeholder records.
- Do not introduce QuickBooks automation yet unless Stage 6 decisions are
  already complete.

Deliverable: usable Loans MVP with verified balances and payment history.

### Stage 4: Define and implement Maintenance

- Confirm event types, workflow, roles, costs, recoverability, and verification.
- Implement maintenance history and its optional link to a Resource repayment
  obligation.
- Add Resource and contextual maintenance views.

Deliverable: auditable maintenance and service-cost workflow.

### Stage 5: Pilot Resource performance metrics

- Select one or two high-value categories, such as livestock and water assets.
- Confirm a small governed metric catalogue, units, cadence, and responsibility.
- Pilot entry and reporting before generalizing the design.

Deliverable: validated performance-record model without a speculative universal
form system.

### Stage 6: Define accounting reconciliation

- Document system-of-record ownership and QuickBooks mappings.
- Pilot export and reconciliation with representative transactions.
- Add API integration only if the pilot demonstrates a stable need and mapping.

Deliverable: controlled accounting handoff with traceable reconciliation.

## Decision log

Record accepted decisions here as the walkthrough proceeds. An entry should
name the boundary, decision, reason, approver or stakeholder group, and date.

| Boundary | Decision | Reason | Confirmed by | Date |
| --- | --- | --- | --- | --- |
| All | Architecture captured for staged stakeholder review; recommendations are not yet accepted implementation requirements | Preserve questions and prevent premature coupling | Pending walkthrough | 2026-10-04 |
| Loans | Keep Loans as a separate domain from Resource inventory and Resource repayment | Loans have an independent approval, disbursement, repayment, arrears, and closure lifecycle | Working direction agreed for design exploration; KWDT leadership approval pending | 2026-10-04 |
| Resource value | Distinguish acquisition cost, estimated/fair value, beneficiary obligation, and grant/donation funding contribution; donated Resources may show both cost and estimated value | These amounts answer different operational and financial questions and must not overwrite one another | Working direction agreed for design exploration; KWDT leadership approval pending | 2026-10-04 |
| Acquisition-cost meaning | Store and display unknown, not applicable, confirmed zero, and recorded amount as distinct states; use helper text and accessible tooltips | A blank amount alone cannot communicate the correct financial meaning, and tooltip-only explanations are not reliably accessible | Working direction agreed for design exploration; KWDT leadership approval pending | 2026-10-04 |
| Resource repayment accountability | Assign the obligation to the accountable party; record the actual payer on each transaction; create Member obligations only for explicitly allocated individual debts | Shared collections should retain payer detail without accidentally creating separate contractual debts | Provisional recommendation accepted for continued design; KWDT leadership and operational confirmation pending | 2026-10-04 |
| Resource deposit | Treat a required deposit as the first payment included within the beneficiary obligation; record additional fees separately | The deposit reduces principal and should not silently increase the amount owed | Provisional recommendation accepted for continued design; KWDT leadership approval pending | 2026-10-04 |
| Resource installment schedule | Support generated regular and manually entered custom schedules; allocate payments to the oldest unpaid installment by default; derive due and overdue amounts; preserve rescheduling history | A frequency and final due date cannot identify missed installments or provide a reliable next-payment view | Provisional recommendation accepted for continued design; KWDT leadership and detailed operating rules pending | 2026-10-04 |
| Initial payment authorization | Permit designated Field/Programme staff, Resource & Procurement, Finance, Executive Leadership, System Administrators, and MVP Full Access to view/submit; permit Finance, Executive Leadership, System Administrators, and MVP Full Access to confirm; prohibit self-confirmation | Broad initial access supports workflow validation while separated capabilities allow later tightening without redesign | Provisional implementation posture; KWDT leadership role confirmation pending | 2026-10-04 |
| Payment evidence | Capture method-specific references and support private receipt, voucher, bank-slip, and photo uploads linked through pending review to the confirmed transaction; do not make every file mandatory initially | Supporting evidence strengthens financial review and auditability, but storage, privacy, connectivity, and retention need explicit controls | Provisional recommendation accepted for continued design; KWDT leadership evidence policy and storage decision pending | 2026-10-04 |
| Charges and credits | Keep fees, penalties, waivers, and adjustments manual, separately itemized, reasoned, and finance-approved; do not calculate penalties automatically | KWDT policy is not yet confirmed, and explicit ledger entries preserve an explainable balance | Provisional recommendation accepted for continued design; KWDT leadership financial policy pending | 2026-10-04 |
