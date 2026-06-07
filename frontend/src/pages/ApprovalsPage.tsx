import { SearchIcon, UploadIcon } from '@patternfly/react-icons';
import { useMemo, useState } from 'react';

import {
  useApprovalRequestsQuery,
  useArchiveRecordsMutation
} from '../api/queries';
import type { ApprovalRequest, ApprovalStatus } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { capabilities, hasCapability } from '../auth/permissions';
import { ActionMenu } from '../components/ActionMenu';
import {
  ApprovalReviewDialog,
  type ApprovalReviewAction
} from '../components/ApprovalReviewDialog';
import { ListActionError } from '../components/ListActionError';
import { StatusBadge } from '../components/StatusBadge';
import { archivePrompt, downloadCsv, toggleVisibleSelection } from '../utils/listActions';
import { PaginationLabel } from './CommunitiesPage';

const pageSize = 10;
const statusFilters: Array<{ label: string; value: ApprovalStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Superseded', value: 'superseded' }
];

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

function formatLabel(value?: string | null) {
  return value ? value.replace(/_/g, ' ') : 'Not recorded';
}

function summarizePayload(value?: Record<string, unknown> | null) {
  const keys = Object.keys(value ?? {});
  if (keys.length === 0) {
    return 'No payload';
  }
  return keys.slice(0, 4).join(', ');
}

function approvalExportRows(records: ApprovalRequest[]) {
  return records.map((approval) => ({
    action_type: approval.action_type,
    applied_at: approval.applied_at,
    community: approval.community,
    entity_id: approval.entity_id,
    entity_type: approval.entity_type,
    id: approval.id,
    reviewed_at: approval.reviewed_at,
    reviewed_by_user_id: approval.reviewed_by_user_id,
    status: approval.status,
    submitted_at: approval.submitted_at,
    submitted_by_user_id: approval.submitted_by_user_id
  }));
}

export function ApprovalsPage() {
  const { user } = useAuth();
  const canReviewAll = hasCapability(user, capabilities.reviewApprovals);
  const canReviewImpact = hasCapability(user, capabilities.reviewImpactApprovals);
  const canArchive = hasCapability(user, capabilities.archiveOperations);
  const canExport = hasCapability(user, capabilities.export);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ApprovalStatus | 'all'>('pending');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [reviewTarget, setReviewTarget] = useState<{
    action: ApprovalReviewAction;
    approval: ApprovalRequest;
  } | null>(null);
  const query = useApprovalRequestsQuery({
    page,
    page_size: pageSize,
    search,
    status: status === 'all' ? undefined : status,
    ordering: '-submitted_at'
  });
  const archiveApprovals = useArchiveRecordsMutation('approval-requests', '/api/v1/approval-requests/');
  const approvals = query.data?.results ?? [];
  const pendingCount = approvals.filter((approval) => approval.status === 'pending').length;
  const visibleIds = approvals.map((approval) => approval.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const pageCount = useMemo(() => Math.max(1, Math.ceil((query.data?.count ?? 0) / pageSize)), [query.data]);
  const actionError = archiveApprovals.error;
  const listActions = [
    ...(canExport ? [{
      label: 'Export current page',
      disabled: approvals.length === 0,
      onSelect: exportApprovals
    }] : []),
    ...(canArchive ? [{
      label: 'Clear selection',
      disabled: selectedIds.length === 0,
      onSelect: () => setSelectedIds([])
    },
    {
      label: `Archive selected (${selectedIds.length})`,
      disabled: selectedIds.length === 0 || archiveApprovals.isPending,
      onSelect: () => void archiveSelectedApprovals(),
      tone: 'danger' as const
    }] : [])
  ];

  function exportApprovals() {
    downloadCsv('approval-requests-current-page.csv', approvalExportRows(approvals));
  }

  async function archiveSelectedApprovals() {
    if (!window.confirm(archivePrompt('approval request', selectedIds.length))) {
      return;
    }

    try {
      await archiveApprovals.mutateAsync(selectedIds);
      setSelectedIds([]);
    } catch {
      // The archive error state is rendered below.
    }
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
    );
  }

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <h1>Approvals</h1>
          <p className="page-header__description">Review queued create, update, and archive requests.</p>
        </div>
        {listActions.length > 0 ? <ActionMenu items={listActions} variant="secondary" /> : null}
      </div>

      <div className="metric-grid">
        <article className="metric-card">
          <span>Visible requests</span>
          <strong>{query.data?.count ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>Pending on page</span>
          <strong>{pendingCount}</strong>
        </article>
        <article className="metric-card">
          <span>Selected</span>
          <strong>{selectedIds.length}</strong>
        </article>
        <article className="metric-card">
          <span>Status filter</span>
          <strong>{formatLabel(status)}</strong>
        </article>
      </div>

      <div className="toolbar toolbar--top">
        <label className="search-field search-field--wide">
          <SearchIcon aria-hidden="true" />
          <input
            type="search"
            value={search}
            placeholder="Search approvals"
            aria-label="Search approvals"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className="segmented-control" aria-label="Approval status">
          {statusFilters.map((option) => (
            <button
              className={status === option.value ? 'is-active' : ''}
              key={option.value}
              type="button"
              onClick={() => {
                setStatus(option.value);
                setPage(1);
                setSelectedIds([]);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar">
        {canArchive ? <button
          className={`select-button ${allVisibleSelected ? 'is-selected' : ''}`}
          type="button"
          aria-label={allVisibleSelected ? 'Clear visible rows' : 'Select visible rows'}
          aria-pressed={allVisibleSelected}
          onClick={() => setSelectedIds((current) => toggleVisibleSelection(current, visibleIds))}
        /> : null}
        {listActions.length > 0 ? <ActionMenu items={listActions} /> : null}
        {canExport ? <button className="text-action" type="button" onClick={exportApprovals} disabled={approvals.length === 0}>
          <UploadIcon aria-hidden="true" />
          Export list
        </button> : null}
        <span className="toolbar__spacer" />
        <PaginationLabel
          page={page}
          pageCount={pageCount}
          total={query.data?.count ?? 0}
          itemName="approval requests"
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(pageCount, current + 1))}
        />
      </div>

      {query.isLoading ? <div className="state-box">Loading approval requests...</div> : null}
      {query.isError ? <div className="state-box state-box--error">Unable to load approval requests.</div> : null}
      <ListActionError error={actionError} />
      {!query.isLoading && !query.isError && approvals.length === 0 ? (
        <div className="state-box">No approval requests match these filters.</div>
      ) : null}

      {approvals.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th aria-label="Select approval request" />
                <th>Submitted item</th>
                <th>Action</th>
                <th>Community</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Reviewed</th>
                <th>Payload</th>
                <th>Review actions</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((approval) => {
                const isPending = approval.status === 'pending';
                const canReview =
                  canReviewAll || (canReviewImpact && approval.entity_type === 'impact_record');
                return (
                  <tr key={approval.id}>
                    <td>
                      {canArchive ? <input
                        type="checkbox"
                        checked={selectedIds.includes(approval.id)}
                        aria-label={`Select approval request ${approval.id}`}
                        onChange={() => toggleSelected(approval.id)}
                      /> : null}
                    </td>
                    <td>
                      {formatLabel(approval.entity_type)} #{approval.entity_id ?? 'new'}
                    </td>
                    <td>{formatLabel(approval.action_type)}</td>
                    <td>{approval.community_name ?? 'Not recorded'}</td>
                    <td>
                      <StatusBadge status={approval.status} />
                    </td>
                    <td>{formatDate(approval.submitted_at)}</td>
                    <td>{formatDate(approval.reviewed_at)}</td>
                    <td>{summarizePayload(approval.submitted_payload)}</td>
                    <td>
                      {canReview ? <div className="row-actions">
                        <button
                          className="button button--muted"
                          type="button"
                          disabled={!isPending}
                          onClick={() => setReviewTarget({ action: 'approve', approval })}
                        >
                          Approve
                        </button>
                        <button
                          className="button button--secondary"
                          type="button"
                          disabled={!isPending}
                          onClick={() => setReviewTarget({ action: 'reject', approval })}
                        >
                          Reject
                        </button>
                        <button
                          className="button button--secondary"
                          type="button"
                          disabled={!isPending}
                          onClick={() => setReviewTarget({ action: 'supersede', approval })}
                        >
                          Supersede
                        </button>
                      </div> : <span>View only</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {reviewTarget ? (
        <ApprovalReviewDialog
          key={`${reviewTarget.approval.id}-${reviewTarget.action}`}
          action={reviewTarget.action}
          approval={reviewTarget.approval}
          onClose={() => setReviewTarget(null)}
        />
      ) : null}
    </section>
  );
}
