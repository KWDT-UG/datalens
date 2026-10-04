# Resource Finance and Loans: Next Steps

## Purpose

This document is the restart point for continuing the Resource Lifecycle and
Finance work and beginning the separate Loans domain. It records where the
architecture discussion stopped, what exists in the application, what remains
to be designed or implemented, and which decisions still require approval from
KWDT leadership stakeholders.

No working baseline in this document is final KWDT policy until leadership has
reviewed and approved it.

## Decision lifecycle

Architecture and product decisions use this maturity sequence:

1. **Proposed** — under discussion.
2. **Working baseline** — accepted for design, initial implementation, and
   stakeholder validation.
3. **Stakeholder-approved** — confirmed by KWDT leadership.
4. **Superseded** — replaced by a later documented decision.

Implementation progress is tracked separately:

1. **Not started**
2. **In progress**
3. **Implemented**
4. **Verified**

Code being implemented or verified does not imply stakeholder approval.

## Current maturity snapshot

| Area | Decision maturity | Implementation state |
| --- | --- | --- |
| Resource inventory and classification | Working baseline | Implemented and verified |
| Resource repayment foundation | Working baseline | Core ledger implemented |
| Installment schedules and arrears | Working baseline | Not started |
| Payment evidence and document uploads | Working baseline | Metadata partially supported; file uploads not started |
| Funding, grants, donations, and valuation | Working baseline | Not started |
| Maintenance and service costs | Proposed | Not started |
| Resource performance and production | Proposed | Not started |
| Separation of Loans from Resources | Working baseline | No Loans implementation |
| Detailed Loans rules | Proposed/open | Not started |
| QuickBooks reconciliation | Proposed | Not started |

## Resource Finance: implemented foundation

The current application already provides:

- Resource inventory, classification, ownership, and beneficiaries;
- Resource asset value;
- beneficiary repayment obligations;
- deposits and installments;
- an explicit responsible payer;
- append-only payment transactions;
- confirmed balance and repayment-standing summaries;
- finance approval;
- full payment reversal;
- financial visibility controls; and
- a Resource-level **Payments & costs** interface.

This foundation should be extended rather than replaced.

## Resource Finance: Stage 1 working baseline

The following directions have been accepted for design and initial
implementation, but remain pending KWDT leadership approval.

### Value and funding meanings

- Acquisition cost, estimated or fair value, beneficiary obligation, and
  grant/donation funding contribution are separate facts.
- A donated Resource may show both acquisition cost and estimated value.
- Unknown, not applicable, confirmed zero, and recorded acquisition cost are
  distinct stored and displayed states.
- Forms should use persistent helper text and accessible tooltips; read views
  should state the meaning explicitly.
- Funding arrangements will eventually link the funded or subsidized portion
  to a grant, donation, internal fund, or combination of sources.

### Repayment accountability and deposits

- The obligation belongs to the party accountable under the KWDT agreement.
- For a shared Resource, individual payment transactions may identify the
  Member who paid without creating an individual Member debt.
- An individual Member obligation is created only when KWDT explicitly assigns
  that Member an individual repayable amount.
- A required deposit is the first payment against principal, not an additional
  charge.
- Application, transport, processing, and service fees are separate entries.

### Installments, arrears, and rescheduling

- Regular weekly or monthly schedules may be generated from agreed terms.
- Seasonal or irregular agreements may use a manually entered custom schedule.
- Each installment has an expected amount, due date, amount satisfied, and
  standing.
- Payments normally satisfy the oldest unpaid installment first.
- The interface derives the next amount due, overdue amount, and overall
  balance from confirmed transactions and the schedule.
- An agreed grace period may delay overdue classification.
- Rescheduling preserves the original schedule and records replacement terms,
  reason, approver, and effective date.

### Initial authorization posture

Access is intentionally broad for MVP validation but remains capability-based:

- designated Field/Programme staff, Resource & Procurement Officers, Finance
  Administrators, Executive Leadership, System Administrators, and MVP Full
  Access may view and submit payment information;
- Finance Administrators, Executive Leadership, System Administrators, and MVP
  Full Access may confirm financial entries;
- users may not confirm their own submissions;
- pending entries are visible but do not affect confirmed balances; and
- assignment scoping applies where assignments exist.

System Administrator business access is a temporary validation exception. The
role matrix should be tightened after KWDT confirms operating responsibilities.

### Payment information and evidence

An initial payment submission records:

- obligation;
- amount and inherited currency;
- effective payment date;
- payment method: cash, mobile money, bank transfer, or other;
- actual payer;
- submitting user;
- method-specific reference where required;
- optional receipt/voucher number, collection location, and notes.

Data Lens must not store unnecessary bank-account or mobile-money account
details.

Payment evidence should support private receipt, voucher, bank-slip, document,
and photo uploads. File metadata belongs in PostgreSQL; file content belongs in
private managed object storage accessed through time-limited URLs.

Evidence remains associated with the pending approval and then the confirmed
transaction. Rejected submissions retain evidence according to the approved
retention policy. Confirmed evidence is not silently replaced or deleted.

Uploads require authorization, encryption, file-type and size validation,
malware controls, checksums, and audited metadata. Mobile UI should support
camera capture, preview, progress, compression, retry, and removal of
unnecessary EXIF location data.

Evidence upload is supported but not universally mandatory initially. KWDT
leadership must still confirm requirements by payment method, amount, and
programme, along with retention and acceptable exceptions.

### Charges, credits, corrections, and refunds

- Fees, penalties, waivers, and debit/credit adjustments are manual,
  separately itemized, reasoned, and finance-approved.
- Data Lens does not automatically calculate or post penalties until KWDT
  confirms the policy.
- Confirmed financial entries cannot be edited or deleted.
- Incorrect entries use a full approved reversal followed by a corrected entry.
- A transaction can be reversed only once.
- Original payment evidence is preserved.
- Money genuinely returned to a beneficiary is a separate refund transaction.
- Partial returns are refunds, not partial reversals.
- Reversals and refunds require finance confirmation and prohibit
  self-approval.

This explainable-ledger rule is a Stage 1 working baseline.

## Resource Finance: implementation gaps

Before implementation, convert the working baseline into an implementation
specification covering models, migrations, API contracts, permissions, UI,
reporting, and tests.

The main gaps are:

1. Separate acquisition-cost state and estimated-value representation.
2. Future funding-allocation extension points for grants and donations.
3. Installment schedule and payment-allocation models.
4. Grace-period and arrears calculations.
5. Versioned rescheduling history.
6. Payment method and method-specific validation.
7. Revised capability assignments and assignment scoping.
8. Payment evidence metadata and approval linkage.
9. Private object-storage abstraction and upload lifecycle.
10. Expanded payment, arrears, evidence, reversal, and refund UI.
11. Reporting that keeps asset value, principal, charges, payments, credits,
    refunds, and funding contributions distinct.
12. Migrations, model/API tests, permission tests, and end-to-end verification.

Maintenance, Resource applications, and Resource performance remain later
stages and should not be bundled into the first Resource Finance delivery.

## Recommended Resource Finance delivery slices

### Slice RF1: Contract and terminology

- Finalize field names and state definitions.
- Define installment, allocation, arrears, rescheduling, and evidence API
  contracts.
- Map each working-baseline rule to tests.
- Preserve compatibility with existing repayment records.

### Slice RF2: Schedule and ledger behavior

- Add installment schedules and allocations.
- Add overdue and next-due calculations.
- Add versioned rescheduling.
- Complete refund and correction behavior.
- Verify balance calculations with representative examples.

### Slice RF3: Authorization and payment capture

- Separate view, submit, and confirm capabilities.
- Apply the initial broad role assignments.
- Add payment method and conditional references.
- Preserve no-self-confirmation and assignment scoping.

### Slice RF4: Evidence documents

- Add reusable private document metadata and explicit payment linkage.
- Add secure upload, download, validation, and retention behavior.
- Add mobile photo/document UI.
- Keep financial uploads online-only initially.

### Slice RF5: Valuation and funding readiness

- Separate acquisition cost from estimated value.
- Represent unknown, not applicable, and confirmed-zero values.
- Add valuation basis, source, and as-of date.
- Preserve extension points for future grant/donation funding allocations.

### Slice RF6: Integrated validation

- Seed representative scenarios.
- Run backend, frontend, permissions, approval, privacy, and PWA tests.
- Walk through the implemented workflow with KWDT stakeholders.
- Promote accepted decisions to stakeholder-approved and record revisions.

## Loans: current position

The separation of Loans from Resource inventory is a working baseline:

> A Loan is not a Resource. It has an independent application, approval,
> disbursement, repayment, arrears, restructuring, and closure lifecycle.

No Loan models, APIs, permissions, or user interface currently exist. Existing
`Micro Loans`, `Business Loan`, and `Education Loan` Resource classification
values are transitional reference data and must not be treated as a complete
Loans implementation.

## Loans: Stage 2 discovery questions

Use two or three representative real KWDT loan examples to confirm:

1. Supported borrower types: Member, household, Group, Cooperative,
   Institution, or another party.
2. Whether a first-class Household is required.
3. Loan products, purposes, and business classifications.
4. Application, review, approval, and rejection workflow.
5. Whether approval and disbursement are separate events.
6. Principal, currency, funding source, and disbursement method.
7. Interest and fee calculations, if any.
8. Weekly, monthly, seasonal, or custom schedules.
9. Grace periods, arrears, penalties, and collection practice.
10. Guarantors, security, or group guarantees.
11. Rescheduling, refinancing, suspension, write-off, and closure.
12. Whether a borrower may hold multiple active loans.
13. Payment evidence and receipt requirements.
14. Role permissions, privacy, and assignment scoping.
15. The current authoritative register and migration source.
16. The relationship between operational loan records and QuickBooks.

## Loans: expected Stage 2 deliverable

After discovery, produce an accepted working-baseline specification for:

- `LoanProduct`;
- `Loan`;
- `LoanInstallment` or equivalent schedule records;
- append-only `LoanTransaction` records;
- `LoanStatusEvent` and rescheduling history;
- borrower and Group contextual views;
- a canonical Loan workspace;
- permissions, approvals, privacy, audit, and online/offline rules;
- migration of any existing loan registers; and
- QuickBooks reconciliation boundaries.

Do not implement financial calculations or migrate existing records until the
representative examples reconcile correctly under the proposed rules.

## QuickBooks boundary

Data Lens remains the operational source for beneficiary agreements, field
payments, asset maintenance, and programme context. QuickBooks remains the
accounting source for the chart of accounts, general ledger, bank/cash
reconciliation, financial statements, and statutory accounting.

Begin with a source-of-truth and field-mapping exercise. Controlled CSV export
and reconciliation may precede any direct API integration.

## Exact restart sequence

When work resumes:

1. Read this document and `operational-domain-boundaries.md`.
2. Confirm whether any new KWDT leadership feedback changes a working baseline.
3. Produce the detailed RF1 implementation contract and test matrix.
4. Review the contract before changing the database schema.
5. Implement Resource Finance in slices RF2 through RF6.
6. In parallel or afterward, collect representative Loan records for Stage 2
   discovery.
7. Complete the Loans working-baseline specification before implementing Loan
   models.
8. Record every accepted, rejected, or superseded decision with its stakeholder
   status and date.

## Leadership approval checkpoints

KWDT leadership confirmation is still required for:

- valuation and funding-source meaning;
- accountable repayment parties;
- deposit and fee treatment;
- schedule, grace, arrears, and rescheduling policy;
- payment roles and approval authority;
- receipt and evidence requirements;
- retention and document-storage policy;
- charges, waivers, refunds, and correction policy;
- all Loans business rules; and
- QuickBooks source-of-truth and reconciliation ownership.

