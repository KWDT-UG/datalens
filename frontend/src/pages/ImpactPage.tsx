import { SearchIcon, UploadIcon } from '@patternfly/react-icons';
import { useEffect, useMemo, useState } from 'react';

import {
  BatchArchiveError,
  useArchiveRecordsMutation,
  useCommunitiesQuery,
  useImpactByCommunityQuery,
  useImpactByResourceQuery,
  useImpactRecordsQuery,
  useImpactSummaryQuery,
  usePermanentDeleteMutation
} from '../api/queries';
import type { ImpactRecord } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { capabilities, hasCapability } from '../auth/permissions';
import { ActionMenu } from '../components/ActionMenu';
import { ArchiveRecordsDialog, type ArchiveRecordTarget } from '../components/ArchiveRecordsDialog';
import { ImpactRecordCreateDialog } from '../components/CommunityBreakdownCreateDialogs';
import { ListActionError } from '../components/ListActionError';
import { PermanentDeleteDialog } from '../components/PermanentDeleteDialog';
import { reverseOrdering, SortableTableHeader } from '../components/SortableTableHeader';
import { downloadCsv, toggleVisibleSelection } from '../utils/listActions';
import { PaginationLabel } from './CommunitiesPage';

const pageSize = 10;

function formatCount(value?: number) {
  return new Intl.NumberFormat().format(value ?? 0);
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : 'Not recorded';
}

function formatLabel(value?: string | null) {
  return value ? value.replace(/_/g, ' ') : 'Not recorded';
}

function impactExportRows(records: ImpactRecord[]) {
  return records.map((impact) => ({
    as_of_date: impact.as_of_date,
    beneficiary_count: impact.beneficiary_count,
    beneficiary_id: impact.beneficiary_id,
    beneficiary_type: impact.beneficiary_type,
    household_count: impact.household_count,
    id: impact.id,
    institution_count: impact.institution_count,
    member_count: impact.member_count,
    method: impact.method,
    period_end: impact.period_end,
    period_start: impact.period_start,
    period_type: impact.period_type,
    resource: impact.resource,
    updated_at: impact.updated_at
  }));
}

export function ImpactPage() {
  const { user } = useAuth();
  const canManage = hasCapability(user, capabilities.manageImpact);
  const canArchive = hasCapability(user, capabilities.archiveImpact);
  const canDeletePermanently = hasCapability(user, capabilities.mvpDeletePermanently);
  const canExport = hasCapability(user, capabilities.export);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [community, setCommunity] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [ordering, setOrdering] = useState('-as_of_date');
  const [editingImpactRecord, setEditingImpactRecord] = useState<ImpactRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [archiveTargets, setArchiveTargets] = useState<ArchiveRecordTarget[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ArchiveRecordTarget | null>(null);
  const reportParams = {
    community: community || undefined,
    period_start: periodStart || undefined,
    period_end: periodEnd || undefined
  };
  const listParams = {
    ...reportParams,
    page,
    page_size: pageSize,
    search,
    ordering
  };
  const communitiesQuery = useCommunitiesQuery({ page: 1, page_size: 100, ordering: 'name' });
  const summaryQuery = useImpactSummaryQuery(reportParams);
  const byCommunityQuery = useImpactByCommunityQuery(reportParams);
  const byResourceQuery = useImpactByResourceQuery(reportParams);
  const recordsQuery = useImpactRecordsQuery(listParams);
  const archiveRecords = useArchiveRecordsMutation('impact-records', '/api/v1/impact-records/');
  const deleteRecord = usePermanentDeleteMutation('impact-records', '/api/v1/impact-records/');
  const records = recordsQuery.data?.results ?? [];
  const pageCount = useMemo(
    () => Math.max(1, Math.ceil((recordsQuery.data?.count ?? 0) / pageSize)),
    [recordsQuery.data]
  );
  const visibleIds = records.map((record) => record.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const summary = summaryQuery.data?.data;
  const listActions = [
    ...(canExport ? [{
      label: 'Export current page',
      disabled: records.length === 0,
      onSelect: exportRecords
    }] : []),
    ...(canArchive ? [{
      label: 'Clear selection',
      disabled: selectedIds.length === 0,
      onSelect: () => setSelectedIds([])
    },
    {
      label: `Archive selected (${selectedIds.length})`,
      disabled: selectedIds.length === 0 || archiveRecords.isPending,
      onSelect: openSelectedArchiveDialog,
      tone: 'danger' as const
    }] : [])
  ];

  function exportRecords() {
    downloadCsv('impact-records-current-page.csv', impactExportRows(records));
  }

  useEffect(() => {
    setSelectedIds([]);
  }, [community, ordering, page, periodEnd, periodStart, search]);

  function impactLabel(impact: ImpactRecord) {
    return `${impact.resource_name ?? 'Resource'} · ${formatDate(impact.as_of_date)}`;
  }

  function openSelectedArchiveDialog() {
    openArchiveDialog(records
      .filter((record) => selectedIds.includes(record.id))
      .map((record) => ({ id: record.id, label: impactLabel(record) })));
  }

  function openArchiveDialog(targets: ArchiveRecordTarget[]) {
    archiveRecords.reset();
    setArchiveTargets(targets);
  }

  function closeArchiveDialog() {
    archiveRecords.reset();
    setArchiveTargets([]);
  }

  async function confirmArchiveRecords() {
    try {
      await archiveRecords.mutateAsync(archiveTargets.map((target) => target.id));
      setSelectedIds([]);
      setArchiveTargets([]);
    } catch (error) {
      if (error instanceof BatchArchiveError) {
        setSelectedIds(error.failedIds);
        setArchiveTargets((current) => current.filter((target) => error.failedIds.includes(target.id)));
      }
    }
  }

  function openDeleteDialog(target: ArchiveRecordTarget) {
    deleteRecord.reset();
    setDeleteTarget(target);
  }

  async function confirmPermanentDelete() {
    if (!deleteTarget) return;
    await deleteRecord.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
    );
  }

  function changeOrdering(columnOrdering: string) {
    setOrdering((current) => current === columnOrdering ? reverseOrdering(columnOrdering) : columnOrdering);
    setPage(1);
  }

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <h1>Impact</h1>
          <p className="page-header__description">Impact records and reporting summaries from the MVP API.</p>
        </div>
        {listActions.length > 0 ? <ActionMenu items={listActions} variant="secondary" /> : null}
      </div>

      <div className="toolbar toolbar--top">
        <label className="search-field search-field--wide">
          <SearchIcon aria-hidden="true" />
          <input
            type="search"
            value={search}
            placeholder="Search impact records"
            aria-label="Search impact records"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="compact-filter">
          <span>Community</span>
          <select
            value={community}
            onChange={(event) => {
              setCommunity(event.target.value);
              setPage(1);
              setSelectedIds([]);
            }}
          >
            <option value="">All communities</option>
            {(communitiesQuery.data?.results ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="compact-filter">
          <span>From</span>
          <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
        </label>
        <label className="compact-filter">
          <span>To</span>
          <input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
        </label>
      </div>

      <div className="metric-grid">
        <article className="metric-card">
          <span>Records</span>
          <strong>{formatCount(summary?.record_count)}</strong>
        </article>
        <article className="metric-card">
          <span>People reached</span>
          <strong>{formatCount(summary?.beneficiary_count)}</strong>
        </article>
        <article className="metric-card">
          <span>Households</span>
          <strong>{formatCount(summary?.household_count)}</strong>
        </article>
        <article className="metric-card">
          <span>Members</span>
          <strong>{formatCount(summary?.member_count)}</strong>
        </article>
      </div>

      <div className="report-grid">
        <section className="content-strip">
          <h2>By community</h2>
          {byCommunityQuery.isLoading ? <p>Loading community impact...</p> : null}
          {(byCommunityQuery.data?.data ?? []).slice(0, 6).map((row) => (
            <div className="report-row" key={row.community}>
              <span>{row.community_name}</span>
              <strong>{formatCount(row.beneficiary_count)} people reached</strong>
            </div>
          ))}
        </section>
        <section className="content-strip">
          <h2>By resource</h2>
          {byResourceQuery.isLoading ? <p>Loading resource impact...</p> : null}
          {(byResourceQuery.data?.data ?? []).slice(0, 6).map((row) => (
            <div className="report-row" key={row.resource}>
              <span>{row.resource_name}</span>
              <strong>{formatCount(row.beneficiary_count)} people reached</strong>
            </div>
          ))}
        </section>
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
        {canExport ? <button className="text-action" type="button" onClick={exportRecords} disabled={records.length === 0}>
          <UploadIcon aria-hidden="true" />
          Export list
        </button> : null}
        <span className="toolbar__spacer" />
        <PaginationLabel
          page={page}
          pageCount={pageCount}
          total={recordsQuery.data?.count ?? 0}
          itemName="impact records"
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(pageCount, current + 1))}
        />
      </div>

      {recordsQuery.isLoading ? <div className="state-box">Loading impact records...</div> : null}
      {recordsQuery.isError ? <div className="state-box state-box--error">Unable to load impact records.</div> : null}
      <ListActionError error={archiveRecords.error} />
      {!recordsQuery.isLoading && !recordsQuery.isError && records.length === 0 ? (
        <div className="state-box">No impact records match these filters.</div>
      ) : null}

      {records.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th aria-label="Select impact record" />
                <SortableTableHeader currentOrdering={ordering} label="As of" onChange={changeOrdering} ordering="as_of_date" />
                <SortableTableHeader currentOrdering={ordering} label="Period" onChange={changeOrdering} ordering="period_type" />
                <SortableTableHeader currentOrdering={ordering} label="Resource" onChange={changeOrdering} ordering="resource__name" />
                <SortableTableHeader currentOrdering={ordering} label="People reached" onChange={changeOrdering} ordering="beneficiary_count" />
                <SortableTableHeader currentOrdering={ordering} label="Households" onChange={changeOrdering} ordering="household_count" />
                <SortableTableHeader currentOrdering={ordering} label="Members" onChange={changeOrdering} ordering="member_count" />
                <SortableTableHeader currentOrdering={ordering} label="Institutions" onChange={changeOrdering} ordering="institution_count" />
                <SortableTableHeader currentOrdering={ordering} label="Method" onChange={changeOrdering} ordering="method" />
                <SortableTableHeader currentOrdering={ordering} label="Updated" onChange={changeOrdering} ordering="updated_at" />
                {canManage || canArchive || canDeletePermanently ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {records.map((impact) => (
                <tr key={impact.id}>
                  <td>
                    {canArchive ? <input
                      type="checkbox"
                      checked={selectedIds.includes(impact.id)}
                      aria-label={`Select impact record ${impact.id}`}
                      onChange={() => toggleSelected(impact.id)}
                    /> : null}
                  </td>
                  <td>{formatDate(impact.as_of_date)}</td>
                  <td>{formatLabel(impact.period_type)}</td>
                  <td>{impact.resource_name ?? 'Resource'}</td>
                  <td>{formatCount(impact.beneficiary_count)}</td>
                  <td>{formatCount(impact.household_count)}</td>
                  <td>{formatCount(impact.member_count)}</td>
                  <td>{formatCount(impact.institution_count)}</td>
                  <td>{formatLabel(impact.method)}</td>
                  <td>{formatDate(impact.updated_at)}</td>
                  {canManage || canArchive || canDeletePermanently ? <td>
                    <ActionMenu
                      ariaLabel={`Actions for impact record ${impact.id}`}
                      variant="secondary"
                      items={[
                        ...(canManage ? [{ label: 'Edit', onSelect: () => setEditingImpactRecord(impact) }] : []),
                        ...(canArchive ? [{
                          label: 'Archive',
                          onSelect: () => openArchiveDialog([{ id: impact.id, label: impactLabel(impact) }]),
                          tone: 'danger' as const
                        }] : []),
                        ...(canDeletePermanently ? [{
                          label: 'Delete permanently',
                          onSelect: () => openDeleteDialog({ id: impact.id, label: impactLabel(impact) }),
                          tone: 'danger' as const
                        }] : [])
                      ]}
                    />
                  </td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {canManage && editingImpactRecord ? (
        <ImpactRecordCreateDialog
          communityId={community ? Number(community) : undefined}
          impactRecord={editingImpactRecord}
          onClose={() => setEditingImpactRecord(null)}
          onCreated={() => {
            setEditingImpactRecord(null);
          }}
        />
      ) : null}
      {archiveTargets.length > 0 ? (
        <ArchiveRecordsDialog
          entityName="impact record"
          error={archiveRecords.error}
          isPending={archiveRecords.isPending}
          onClose={closeArchiveDialog}
          onConfirm={confirmArchiveRecords}
          path="/api/v1/impact-records/"
          targets={archiveTargets}
        />
      ) : null}
      {deleteTarget ? (
        <PermanentDeleteDialog
          error={deleteRecord.error}
          isPending={deleteRecord.isPending}
          onClose={() => {
            deleteRecord.reset();
            setDeleteTarget(null);
          }}
          onConfirm={confirmPermanentDelete}
          path="/api/v1/impact-records/"
          target={deleteTarget}
        />
      ) : null}
    </section>
  );
}
