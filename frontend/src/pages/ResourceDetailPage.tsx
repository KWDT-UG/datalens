import { type ReactNode, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import {
  useCreateResourcePaymentObligationMutation,
  useCreateResourcePaymentTransactionMutation,
  useResourceDetailQuery,
  useReverseResourcePaymentTransactionMutation
} from '../api/queries';
import {
  isApprovalSubmission,
  type ResourceBeneficiary,
  type ResourcePaymentObligation
} from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { capabilities, hasCapability } from '../auth/permissions';
import { FormDialog, FormErrorSummary } from '../components/FormDialog';
import { StatusBadge } from '../components/StatusBadge';
import { formatQuantity } from '../utils/formatQuantity';

type ResourceTab = 'overview' | 'beneficiaries' | 'payments' | 'history';

function formatLabel(value?: string | null) {
  return value ? value.replace(/_/g, ' ') : 'Not recorded';
}

function formatDate(value?: string | null) {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString() : 'Not recorded';
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

function formatMoney(value?: string | null, currency?: string | null) {
  if (value === undefined || value === null || value === '') {
    return 'Not recorded';
  }
  return `${currency ?? 'UGX'} ${Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2
  })}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function ResourceDetailPage() {
  const { resourceId } = useParams();
  const location = useLocation();
  const id = resourceId && /^\d+$/.test(resourceId) ? Number(resourceId) : undefined;
  const { user } = useAuth();
  const canViewFinancials = hasCapability(user, capabilities.viewResourceFinancials);
  const canManageFinancials = hasCapability(user, capabilities.manageResourceFinancials);
  const query = useResourceDetailQuery(id);
  const [activeTab, setActiveTab] = useState<ResourceTab>('overview');
  const [obligationOpen, setObligationOpen] = useState(false);
  const [paymentObligation, setPaymentObligation] = useState<ResourcePaymentObligation | null>(null);
  const [notice, setNotice] = useState('');
  const reversePayment = useReverseResourcePaymentTransactionMutation();

  if (!id) {
    return <div className="state-box state-box--error">Invalid resource identifier.</div>;
  }
  if (query.isLoading) {
    return <div className="state-box">Loading resource details...</div>;
  }
  if (query.isError || !query.data) {
    return <div className="state-box state-box--error">Unable to load this resource.</div>;
  }

  const detail = query.data;
  const resource = detail.resource;
  const summary = resource.payment_summary;
  const navigationState = location.state as {
    resourceOrigin?: { label?: string; path?: string };
  } | null;
  const resourceOrigin = navigationState?.resourceOrigin;
  const backPath = resourceOrigin?.path?.startsWith('/') ? resourceOrigin.path : '/resources';
  const backLabel = resourceOrigin?.label || 'resources';
  const latestImpact = detail.impact_records[0];
  const peopleReached = latestImpact?.beneficiary_count;
  const reversedTransactionIds = new Set(
    detail.payment_transactions
      .filter((transaction) => transaction.entry_type === 'reversal' && transaction.reverses)
      .map((transaction) => transaction.reverses as number)
  );
  const tabs: Array<{ key: ResourceTab; label: string; count?: number }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'beneficiaries', label: 'Recipients & reach', count: detail.beneficiaries.length },
    { key: 'payments', label: 'Payments & costs', count: detail.payment_transactions.length },
    { key: 'history', label: 'History', count: detail.status_events.length }
  ];

  async function reverseTransaction(transactionId: number, label: string) {
    if (!window.confirm(`Reverse ${label}? The original entry will remain in the ledger.`)) {
      return;
    }
    try {
      const result = await reversePayment.mutateAsync({
        id: transactionId,
        payload: { effective_on: today(), notes: 'Full reversal requested from resource workspace.' }
      });
      setNotice(
        isApprovalSubmission(result)
          ? 'Reversal submitted for finance approval. Confirmed totals are unchanged until approval.'
          : 'Reversal recorded.'
      );
    } catch {
      // The mutation error is shown in the page alert.
    }
  }

  return (
    <article className="record-page resource-workspace">
      <header className="record-page__hero">
        <div>
          <Link className="record-page__back" to={backPath}>← Back to {backLabel}</Link>
          <span className="record-detail__eyebrow">Resource workspace</span>
          <h1>{resource.name}</h1>
          <p>
            {resource.community_name ?? `Community #${resource.community}`} · {formatLabel(resource.resource_type)}
          </p>
          <div className="resource-workspace__status-row">
            <StatusBadge status={resource.status} />
            {resource.approval_status ? <StatusBadge status={resource.approval_status} /> : null}
            <span>{resource.owner_display ?? formatLabel(resource.owner_type)}</span>
          </div>
        </div>
      </header>

      <nav className="group-workspace-tabs" aria-label="Resource workspace sections">
        {tabs.map((tab) => (
          <button
            aria-current={activeTab === tab.key ? 'page' : undefined}
            className={activeTab === tab.key ? 'is-active' : ''}
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
          </button>
        ))}
      </nav>

      {notice ? <div className="form-alert form-alert--success" role="status">{notice}</div> : null}
      <FormErrorSummary error={reversePayment.error} title="Unable to reverse payment" />

      {activeTab === 'overview' ? (
        <div className="resource-workspace__grid">
          <section className="record-detail__section">
            <h3>Resource details</h3>
            <dl className="record-detail__grid">
              <Detail label="Owner" value={resource.owner_display ?? 'Not recorded'} />
              <Detail label="Quantity" value={formatQuantity(resource.quantity, resource.unit)} />
              {resource.serial_or_tag_number ? (
                <Detail label="Asset identifier" value={resource.serial_or_tag_number} />
              ) : null}
              <Detail label="Acquired" value={formatDate(resource.acquired_on)} />
              <Detail label="Location" value={resource.location_text || 'Not recorded'} />
              <Detail label="Thematic areas" value={resource.thematic_areas?.map((area) => area.name).join(', ') || 'Not recorded'} />
            </dl>
            {resource.description ? <p className="record-detail__notes">{resource.description}</p> : null}
          </section>

          <section className="record-detail__section">
            <h3>Recipients and people reached</h3>
            <div className="record-detail__stat-grid">
              <span>
                <strong>{resource.beneficiary_summary?.count ?? detail.beneficiaries.length}</strong>
                Linked recipient entities
              </span>
              <span>
                <strong>{peopleReached ?? 'Not recorded'}</strong>
                People reached{latestImpact?.as_of_date ? ` as of ${formatDate(latestImpact.as_of_date)}` : ''}
              </span>
            </div>
            <div className="resource-party-list">
              {detail.beneficiaries.slice(0, 4).map((beneficiary) => (
                <span key={beneficiary.id}>
                  <strong>{beneficiary.beneficiary_display ?? 'Beneficiary'}</strong>
                  {formatLabel(beneficiary.benefit_scope)} · {formatLabel(beneficiary.relationship_type)}
                </span>
              ))}
              {detail.beneficiaries.length === 0 ? <p>No beneficiaries are linked yet.</p> : null}
            </div>
            {latestImpact ? (
              <p className="record-detail__notes">
                People reached is the population served by the linked beneficiary entities—for example,
                students and staff served by a school water tank.
              </p>
            ) : null}
          </section>

          {canViewFinancials ? (
            <FinancialSummary summary={summary} onOpenPayments={() => setActiveTab('payments')} />
          ) : (
            <section className="record-detail__section">
              <h3>Payments & costs</h3>
              <p>Financial details are restricted for your role.</p>
            </section>
          )}
        </div>
      ) : null}

      {activeTab === 'beneficiaries' ? (
        <section className="record-detail__section">
          <h3>Who receives or uses this resource</h3>
          <p className="record-detail__notes">
            Recipient entities identify the institution, group, household, or person receiving the resource.
            People reached is recorded separately in impact records.
          </p>
          {detail.beneficiaries.length === 0 ? <div className="state-box">No recipients are linked to this resource.</div> : null}
          <div className="resource-beneficiary-grid">
            {detail.beneficiaries.map((beneficiary) => (
              <article key={beneficiary.id}>
                <span className="record-detail__eyebrow">{formatLabel(beneficiary.beneficiary_type)}</span>
                <strong>{beneficiary.beneficiary_display ?? 'Beneficiary'}</strong>
                <span>{formatLabel(beneficiary.benefit_scope)} · {formatLabel(beneficiary.relationship_type)}</span>
                {beneficiary.notes ? <p>{beneficiary.notes}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'payments' ? (
        canViewFinancials ? (
          <div className="resource-payment-layout">
            <FinancialSummary summary={summary} />
            <section className="record-detail__section">
              <header className="resource-section-header">
                <div>
                  <span className="record-detail__eyebrow">Repayment terms</span>
                  <h3>Payment obligations</h3>
                </div>
                {canManageFinancials ? (
                  <button className="button button--secondary" type="button" onClick={() => setObligationOpen(true)}>
                    Add obligation
                  </button>
                ) : null}
              </header>
              {detail.payment_obligations.length === 0 ? (
                <div className="state-box">No repayment obligation has been recorded.</div>
              ) : (
                <div className="resource-obligation-grid">
                  {detail.payment_obligations.map((obligation) => (
                    <article key={obligation.id}>
                      <header>
                        <strong>{formatLabel(obligation.obligation_type)}</strong>
                        <StatusBadge status={obligation.financial_summary?.repayment_state ?? obligation.status} />
                      </header>
                      <span>{obligation.responsible_party_display ?? 'Responsible payer'}</span>
                      <dl>
                        <Detail label="Repayable" value={formatMoney(obligation.principal_amount, obligation.currency)} />
                        <Detail label="Deposit" value={formatMoney(obligation.deposit_required_amount, obligation.currency)} />
                        <Detail label="Installment" value={`${formatMoney(obligation.installment_amount, obligation.currency)} · ${formatLabel(obligation.payment_frequency)}`} />
                        <Detail label="Due" value={formatDate(obligation.due_on)} />
                      </dl>
                      {canManageFinancials ? (
                        <button className="button button--primary" type="button" onClick={() => setPaymentObligation(obligation)}>
                          Record payment
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="record-detail__section">
              <span className="record-detail__eyebrow">Confirmed entries only</span>
              <h3>Payment ledger</h3>
              {detail.payment_transactions.length === 0 ? <div className="state-box">No approved payments have been posted.</div> : null}
              <div className="resource-ledger">
                {detail.payment_transactions.map((transaction) => {
                  const isReversal = transaction.entry_type === 'reversal';
                  const canReverse = canManageFinancials && !isReversal && !reversedTransactionIds.has(transaction.id);
                  const obligation = detail.payment_obligations.find((item) => item.id === transaction.obligation);
                  const label = `${formatLabel(transaction.entry_type)} ${formatMoney(transaction.amount, obligation?.currency)}`;
                  return (
                    <article key={transaction.id}>
                      <div>
                        <strong>{formatLabel(transaction.entry_type)}</strong>
                        <span>{formatDate(transaction.effective_on)}{transaction.reference ? ` · ${transaction.reference}` : ''}</span>
                      </div>
                      <strong className={isReversal ? 'is-debit' : 'is-credit'}>{formatMoney(transaction.amount, obligation?.currency)}</strong>
                      {canReverse ? (
                        <button className="text-action" type="button" onClick={() => void reverseTransaction(transaction.id, label)}>
                          Reverse
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          <div className="state-box">Financial details are restricted for your role.</div>
        )
      ) : null}

      {activeTab === 'history' ? (
        <section className="record-detail__section">
          <h3>Resource lifecycle history</h3>
          {detail.status_events.length === 0 ? <div className="state-box">No status events have been recorded.</div> : null}
          <div className="resource-timeline">
            {detail.status_events.map((event) => (
              <article key={event.id}>
                <span aria-hidden="true" />
                <div>
                  <strong>{formatLabel(event.event_type)}</strong>
                  <time>{formatDateTime(event.effective_at)}</time>
                  {event.notes ? <p>{event.notes}</p> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {obligationOpen ? (
        <ObligationDialog
          beneficiaries={detail.beneficiaries}
          owner={{
            id: resource.owner_id,
            label: resource.owner_display,
            type: resource.owner_type
          }}
          resourceId={resource.id}
          onClose={() => setObligationOpen(false)}
          onSubmitted={(message) => {
            setNotice(message);
            setObligationOpen(false);
          }}
        />
      ) : null}
      {paymentObligation ? (
        <PaymentDialog
          obligation={paymentObligation}
          onClose={() => setPaymentObligation(null)}
          onSubmitted={(message) => {
            setNotice(message);
            setPaymentObligation(null);
          }}
        />
      ) : null}
    </article>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function FinancialSummary({
  summary,
  onOpenPayments
}: {
  summary?: import('../api/types').ResourceFinancialSummary | null;
  onOpenPayments?: () => void;
}) {
  if (!summary) {
    return (
      <section className="record-detail__section">
        <h3>Payments & costs</h3>
        <p>No repayment terms have been recorded for this resource.</p>
        {onOpenPayments ? <button className="text-action" type="button" onClick={onOpenPayments}>Open payments</button> : null}
      </section>
    );
  }
  const percent = Math.max(0, Math.min(100, Number(summary.percent_paid)));
  return (
    <section className="record-detail__section resource-financial-summary">
      <header className="resource-section-header">
        <div><span className="record-detail__eyebrow">Repayment</span><h3>Payment progress</h3></div>
        <StatusBadge status={summary.repayment_state} />
      </header>
      <div className="payment-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`${percent}% paid`}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <strong>{percent.toLocaleString()}% paid</strong>
      <div className="record-detail__stat-grid">
        <span><strong>{formatMoney(summary.total_paid, summary.currency)}</strong>Total paid</span>
        <span><strong>{formatMoney(summary.remaining_amount, summary.currency)}</strong>Remaining</span>
        <span><strong>{formatMoney(summary.principal_amount, summary.currency)}</strong>Repayable amount</span>
        <span><strong>{formatDate(summary.next_due_on)}</strong>Next due</span>
      </div>
      {onOpenPayments ? <button className="text-action" type="button" onClick={onOpenPayments}>View payment ledger</button> : null}
    </section>
  );
}

function ObligationDialog({
  beneficiaries,
  onClose,
  onSubmitted,
  owner,
  resourceId
}: {
  beneficiaries: ResourceBeneficiary[];
  onClose: () => void;
  onSubmitted: (message: string) => void;
  owner: { id?: number; label?: string | null; type?: string };
  resourceId: number;
}) {
  const mutation = useCreateResourcePaymentObligationMutation();
  const [beneficiaryId, setBeneficiaryId] = useState(String(beneficiaries[0]?.id ?? ''));
  const payerOptions = useMemo(() => {
    const options = beneficiaries.map((beneficiary) => ({
      key: `${beneficiary.beneficiary_type}:${beneficiary.beneficiary_id}`,
      label: beneficiary.beneficiary_display ?? 'Beneficiary',
      type: beneficiary.beneficiary_type,
      id: beneficiary.beneficiary_id
    }));
    if (owner.type && owner.id) {
      options.unshift({ key: `${owner.type}:${owner.id}`, label: owner.label ?? 'Resource owner', type: owner.type, id: owner.id });
    }
    return options.filter((option, index, all) => all.findIndex((candidate) => candidate.key === option.key) === index);
  }, [beneficiaries, owner.id, owner.label, owner.type]);
  const [payerKey, setPayerKey] = useState(payerOptions[0]?.key ?? '');
  const [principal, setPrincipal] = useState('');
  const [deposit, setDeposit] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [installment, setInstallment] = useState('');
  const [startsOn, setStartsOn] = useState(today());
  const [dueOn, setDueOn] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <FormDialog open title="Add repayment obligation" description="Record the amount this beneficiary is expected to repay. The deposit is included in this amount." onClose={onClose}>
      <form className="record-form" onSubmit={async (event) => {
        event.preventDefault();
        const payer = payerOptions.find((option) => option.key === payerKey);
        if (!payer?.id) return;
        try {
          const result = await mutation.mutateAsync({
            resource: resourceId,
            resource_beneficiary: Number(beneficiaryId),
            responsible_party_type: payer.type,
            responsible_party_id: payer.id,
            obligation_type: 'acquisition',
            principal_amount: principal,
            currency: 'UGX',
            deposit_required_amount: deposit || undefined,
            payment_frequency: frequency,
            installment_amount: installment || undefined,
            starts_on: startsOn || undefined,
            due_on: dueOn || undefined,
            status: 'active',
            terms_notes: notes || undefined
          });
          onSubmitted(isApprovalSubmission(result) ? 'Repayment terms submitted for finance approval.' : 'Repayment terms recorded.');
        } catch {
          // Error is rendered below.
        }
      }}>
        <FormErrorSummary error={mutation.error} title="Unable to add repayment terms" />
        {beneficiaries.length === 0 ? <div className="state-box state-box--error">Link a beneficiary before adding repayment terms.</div> : null}
        <div className="form-grid form-grid--two">
          <label>Beneficiary<select required value={beneficiaryId} onChange={(event) => setBeneficiaryId(event.target.value)}>{beneficiaries.map((beneficiary) => <option key={beneficiary.id} value={beneficiary.id}>{beneficiary.beneficiary_display ?? `Beneficiary ${beneficiary.id}`}</option>)}</select></label>
          <label>Responsible payer<select required value={payerKey} onChange={(event) => setPayerKey(event.target.value)}>{payerOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
          <label>Beneficiary repayable amount (UGX)<input required min="0.01" step="0.01" type="number" value={principal} onChange={(event) => setPrincipal(event.target.value)} /></label>
          <label>Required deposit (UGX)<input min="0" step="0.01" type="number" value={deposit} onChange={(event) => setDeposit(event.target.value)} /></label>
          <label>Payment frequency<select value={frequency} onChange={(event) => setFrequency(event.target.value)}><option value="one_time">One time</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom</option></select></label>
          <label>Expected installment (UGX)<input min="0.01" step="0.01" type="number" value={installment} onChange={(event) => setInstallment(event.target.value)} /></label>
          <label>Starts on<input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label>
          <label>Final due date<input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} /></label>
        </div>
        <label>Terms notes<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <div className="form-actions"><button className="button button--secondary" type="button" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={mutation.isPending || beneficiaries.length === 0 || !payerKey} type="submit">{mutation.isPending ? 'Submitting...' : 'Submit for finance approval'}</button></div>
      </form>
    </FormDialog>
  );
}

function PaymentDialog({ obligation, onClose, onSubmitted }: { obligation: ResourcePaymentObligation; onClose: () => void; onSubmitted: (message: string) => void }) {
  const mutation = useCreateResourcePaymentTransactionMutation();
  const [entryType, setEntryType] = useState<'deposit' | 'installment'>('installment');
  const [amount, setAmount] = useState('');
  const [effectiveOn, setEffectiveOn] = useState(today());
  const [reference, setReference] = useState('');
  const [voucher, setVoucher] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <FormDialog open title="Record payment" description={`Post a payment for ${obligation.responsible_party_display ?? 'the responsible payer'}. Confirmed totals update after finance approval.`} onClose={onClose}>
      <form className="record-form" onSubmit={async (event) => {
        event.preventDefault();
        try {
          const result = await mutation.mutateAsync({ obligation: obligation.id, entry_type: entryType, amount, effective_on: effectiveOn, reference: reference || undefined, voucher_number: voucher || undefined, notes: notes || undefined });
          onSubmitted(isApprovalSubmission(result) ? 'Payment submitted for finance approval. Confirmed totals are unchanged until approval.' : 'Payment recorded.');
        } catch {
          // Error is rendered below.
        }
      }}>
        <FormErrorSummary error={mutation.error} title="Unable to record payment" />
        <div className="form-grid form-grid--two">
          <label>Payment type<select value={entryType} onChange={(event) => setEntryType(event.target.value as 'deposit' | 'installment')}><option value="deposit">Deposit</option><option value="installment">Installment</option></select></label>
          <label>Amount ({obligation.currency})<input required min="0.01" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <label>Payment date<input required type="date" value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /></label>
          <label>Receipt/reference<input value={reference} onChange={(event) => setReference(event.target.value)} /></label>
          <label>Voucher number<input value={voucher} onChange={(event) => setVoucher(event.target.value)} /></label>
        </div>
        <label>Notes<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <p className="form-help">Payments require an online connection and finance approval. Do not resubmit while a request is pending.</p>
        <div className="form-actions"><button className="button button--secondary" type="button" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={mutation.isPending} type="submit">{mutation.isPending ? 'Submitting...' : 'Submit payment'}</button></div>
      </form>
    </FormDialog>
  );
}
