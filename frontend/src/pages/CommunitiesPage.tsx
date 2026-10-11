import { SearchIcon, UploadIcon } from '@patternfly/react-icons';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { BatchArchiveError, useArchiveRecordsMutation, useCommunitiesQuery, usePermanentDeleteMutation } from '../api/queries';
import type { Community } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { capabilities, hasCapability } from '../auth/permissions';
import { ActionMenu } from '../components/ActionMenu';
import { ArchiveRecordsDialog, type ArchiveRecordTarget } from '../components/ArchiveRecordsDialog';
import { CommunityCreateDialog } from '../components/CommunityCreateDialog';
import { ListActionError } from '../components/ListActionError';
import { PermanentDeleteDialog } from '../components/PermanentDeleteDialog';
import { StatusBadge } from '../components/StatusBadge';
import { reverseOrdering, SortableTableHeader } from '../components/SortableTableHeader';
import { downloadCsv, toggleVisibleSelection } from '../utils/listActions';

const pageSize = 10;

function formatLocation(community: Community) {
  return [community.subcounty_name, community.district_name, community.region_name, community.country]
    .filter(Boolean)
    .join(', ');
}

export function CommunitiesPage() {
  const { user } = useAuth();
  const canManage = hasCapability(user, capabilities.manageOperations);
  const canArchive = hasCapability(user, capabilities.archiveOperations);
  const canDeletePermanently = hasCapability(user, capabilities.mvpDeletePermanently);
  const canExport = hasCapability(user, capabilities.export);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'table' | 'card'>('table');
  const [ordering, setOrdering] = useState('name');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<Community | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [archiveTargets, setArchiveTargets] = useState<ArchiveRecordTarget[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ArchiveRecordTarget | null>(null);
  const query = useCommunitiesQuery({ page, page_size: pageSize, search, ordering });
  const archiveCommunities = useArchiveRecordsMutation('communities', '/api/v1/communities/');
  const deleteCommunity = usePermanentDeleteMutation('communities', '/api/v1/communities/');
  const communities = query.data?.results ?? [];
  const visibleIds = communities.map((community) => community.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const pageCount = useMemo(() => Math.max(1, Math.ceil((query.data?.count ?? 0) / pageSize)), [query.data]);
  const listActions = [
    ...(canExport ? [{
      label: 'Export current page',
      disabled: communities.length === 0,
      onSelect: exportCommunities
    }] : []),
    ...(canArchive ? [{
      label: 'Clear selection',
      disabled: selectedIds.length === 0,
      onSelect: () => setSelectedIds([])
    }] : []),
    ...(canArchive ? [{
      label: `Archive selected (${selectedIds.length})`,
      disabled: selectedIds.length === 0 || archiveCommunities.isPending,
      onSelect: openSelectedArchiveDialog,
      tone: 'danger' as const
    }] : [])
  ];

  function exportCommunities() {
    downloadCsv(
      'communities-current-page.csv',
      communities.map((community) => ({
        committee_count: community.committee_count,
        cooperative_count: community.cooperative_count,
        country: community.country,
        district_name: community.district_name,
        group_count: community.group_count,
        id: community.id,
        member_count: community.member_count,
        name: community.name,
        resident_count: community.resident_count,
        region_name: community.region_name,
        resource_count: community.resource_count,
        status: community.status,
        subcounty_name: community.subcounty_name,
        updated_at: community.updated_at
      }))
    );
  }

  useEffect(() => {
    setSelectedIds([]);
  }, [ordering, page, search]);

  function openSelectedArchiveDialog() {
    openArchiveDialog(communities
      .filter((community) => selectedIds.includes(community.id))
      .map((community) => ({ id: community.id, label: community.name })));
  }

  function openArchiveDialog(targets: ArchiveRecordTarget[]) {
    archiveCommunities.reset();
    setArchiveTargets(targets);
  }

  function closeArchiveDialog() {
    archiveCommunities.reset();
    setArchiveTargets([]);
  }

  function openDeleteDialog(target: ArchiveRecordTarget) {
    deleteCommunity.reset();
    setDeleteTarget(target);
  }

  async function confirmPermanentDelete() {
    if (!deleteTarget) return;
    await deleteCommunity.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function confirmArchiveCommunities() {
    const ids = archiveTargets.map((target) => target.id);
    try {
      await archiveCommunities.mutateAsync(ids);
      setSelectedIds([]);
      setArchiveTargets([]);
    } catch (error) {
      if (error instanceof BatchArchiveError) {
        setSelectedIds(error.failedIds);
        setArchiveTargets((current) => current.filter((target) => error.failedIds.includes(target.id)));
      }
    }
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
          <h1>Communities</h1>
          <p className="page-header__description">List of communities</p>
        </div>
        <div className="page-actions">
          {canManage ? (
            <button className="button button--primary" type="button" onClick={() => setCreateOpen(true)}>
              Create community
            </button>
          ) : null}
          {listActions.length > 0 ? <ActionMenu items={listActions} variant="secondary" /> : null}
        </div>
      </div>

      <div className="toolbar toolbar--top">
        <label className="search-field search-field--wide">
          <SearchIcon aria-hidden="true" />
          <input
            type="search"
            value={search}
            placeholder="Search by community"
            aria-label="Search by community"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className="segmented-control" aria-label="View mode">
          <button
            className={view === 'table' ? 'is-active' : ''}
            type="button"
            onClick={() => setView('table')}
          >
            Table
          </button>
          <button
            className={view === 'card' ? 'is-active' : ''}
            type="button"
            onClick={() => setView('card')}
          >
            Card
          </button>
        </div>
      </div>

      <div className="toolbar">
        {canArchive ? (
          <button
            className={`select-button ${allVisibleSelected ? 'is-selected' : ''}`}
            type="button"
            aria-label={allVisibleSelected ? 'Clear visible rows' : 'Select visible rows'}
            aria-pressed={allVisibleSelected}
            onClick={() => setSelectedIds((current) => toggleVisibleSelection(current, visibleIds))}
          />
        ) : null}
        {listActions.length > 0 ? <ActionMenu items={listActions} /> : null}
        {canExport ? (
          <button className="text-action" type="button" onClick={exportCommunities} disabled={communities.length === 0}>
            <UploadIcon aria-hidden="true" />
            Export list
          </button>
        ) : null}
        <span className="toolbar__spacer" />
        <PaginationLabel
          page={page}
          pageCount={pageCount}
          total={query.data?.count ?? 0}
          itemName="communities"
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(pageCount, current + 1))}
        />
      </div>

      {query.isLoading ? <div className="state-box">Loading communities...</div> : null}
      {query.isError ? <div className="state-box state-box--error">Unable to load communities.</div> : null}
      <ListActionError error={archiveCommunities.error} />
      {!query.isLoading && !query.isError && communities.length === 0 ? (
        <div className="state-box">No communities match this search.</div>
      ) : null}

      {!query.isLoading && !query.isError && communities.length > 0 && view === 'table' ? (
        <div className="table-wrap">
          <table className="data-table data-table--sticky-identity data-table--selectable">
            <thead>
              <tr>
                <th aria-label="Select community" className="data-table__select" />
                <SortableTableHeader className="data-table__identity" currentOrdering={ordering} label="Community name" onChange={changeOrdering} ordering="name" />
                <SortableTableHeader currentOrdering={ordering} label="Subcounty" onChange={changeOrdering} ordering="subcounty_name" />
                <SortableTableHeader currentOrdering={ordering} label="Residents" onChange={changeOrdering} ordering="resident_count" />
                <SortableTableHeader currentOrdering={ordering} label="Groups" onChange={changeOrdering} ordering="group_count" />
                <SortableTableHeader currentOrdering={ordering} label="Members" onChange={changeOrdering} ordering="member_count" />
                <SortableTableHeader currentOrdering={ordering} label="Committees" onChange={changeOrdering} ordering="committee_count" />
                <SortableTableHeader currentOrdering={ordering} label="Cooperatives" onChange={changeOrdering} ordering="cooperative_count" />
                <SortableTableHeader currentOrdering={ordering} label="Resources" onChange={changeOrdering} ordering="resource_count" />
                <SortableTableHeader currentOrdering={ordering} label="Status" onChange={changeOrdering} ordering="status" />
                <SortableTableHeader currentOrdering={ordering} label="Last updated" onChange={changeOrdering} ordering="updated_at" />
                {canManage || canArchive || canDeletePermanently ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {communities.map((community) => (
                <tr key={community.id}>
                  <td className="data-table__select">
                    {canArchive ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(community.id)}
                        aria-label={`Select ${community.name}`}
                        onChange={() => toggleSelected(community.id)}
                      />
                    ) : null}
                  </td>
                  <td className="data-table__identity">
                    <Link to={`/communities/${community.id}/groups`}>{community.name}</Link>
                  </td>
                  <td>{community.subcounty_name || 'Not recorded'}</td>
                  <td>{community.resident_count?.toLocaleString() ?? 'Not recorded'}</td>
                  <td>{community.group_count ?? 0}</td>
                  <td>{community.member_count ?? 0}</td>
                  <td>{community.committee_count ?? 0}</td>
                  <td>{community.cooperative_count ?? 0}</td>
                  <td>{community.resource_count ?? 0}</td>
                  <td>
                    <StatusBadge status={community.status} />
                  </td>
                  <td>{community.updated_at ? new Date(community.updated_at).toLocaleDateString() : 'Not recorded'}</td>
                  {canManage || canArchive || canDeletePermanently ? (
                    <td>
                      <ActionMenu
                        ariaLabel={`Actions for ${community.name}`}
                        variant="secondary"
                        items={[
                          ...(canManage ? [{ label: 'Edit', onSelect: () => setEditingCommunity(community) }] : []),
                          ...(canArchive ? [{
                            label: 'Archive',
                            onSelect: () => openArchiveDialog([{ id: community.id, label: community.name }]),
                            tone: 'danger' as const
                          }] : []),
                          ...(canDeletePermanently ? [{
                            label: 'Delete permanently',
                            onSelect: () => openDeleteDialog({ id: community.id, label: community.name }),
                            tone: 'danger' as const
                          }] : [])
                        ]}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!query.isLoading && !query.isError && communities.length > 0 && view === 'card' ? (
        <div className="community-grid">
          {communities.map((community) => (
            <article className="community-card" key={community.id}>
              <Link className="community-card__link" to={`/communities/${community.id}/groups`}>
                <span className="community-card__meta">{formatLocation(community) || 'Location not recorded'}</span>
                <strong>{community.name}</strong>
                <p>{community.notes || 'Community profile and breakdown details are ready to view.'}</p>
                <div className="community-card__counts">
                  <span>
                    {community.resident_count == null
                      ? 'Residents not recorded'
                      : `${community.resident_count.toLocaleString()} residents`}
                  </span>
                  <span>{community.member_count ?? 0} members</span>
                  <span>{community.group_count ?? 0} groups</span>
                  <span>{community.resource_count ?? 0} resources</span>
                </div>
              </Link>
              {canManage || canArchive || canDeletePermanently ? (
                <div className="community-card__actions">
                  <ActionMenu
                    ariaLabel={`Actions for ${community.name}`}
                    variant="secondary"
                    items={[
                      ...(canManage ? [{ label: 'Edit', onSelect: () => setEditingCommunity(community) }] : []),
                      ...(canArchive ? [{
                        label: 'Archive',
                        onSelect: () => openArchiveDialog([{ id: community.id, label: community.name }]),
                        tone: 'danger' as const
                      }] : []),
                      ...(canDeletePermanently ? [{
                        label: 'Delete permanently',
                        onSelect: () => openDeleteDialog({ id: community.id, label: community.name }),
                        tone: 'danger' as const
                      }] : [])
                    ]}
                  />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {canManage && createOpen ? <CommunityCreateDialog onClose={() => setCreateOpen(false)} /> : null}
      {canManage && editingCommunity ? (
        <CommunityCreateDialog
          community={editingCommunity}
          onClose={() => setEditingCommunity(null)}
          onSaved={() => setEditingCommunity(null)}
        />
      ) : null}
      {archiveTargets.length > 0 ? (
        <ArchiveRecordsDialog
          entityName="community"
          error={archiveCommunities.error}
          isPending={archiveCommunities.isPending}
          onClose={closeArchiveDialog}
          onConfirm={confirmArchiveCommunities}
          path="/api/v1/communities/"
          targets={archiveTargets}
        />
      ) : null}
      {deleteTarget ? (
        <PermanentDeleteDialog
          error={deleteCommunity.error}
          isPending={deleteCommunity.isPending}
          onClose={() => {
            deleteCommunity.reset();
            setDeleteTarget(null);
          }}
          onConfirm={confirmPermanentDelete}
          path="/api/v1/communities/"
          target={deleteTarget}
        />
      ) : null}
    </section>
  );
}

type PaginationLabelProps = {
  page: number;
  pageCount: number;
  total: number;
  itemName: string;
  onPrevious: () => void;
  onNext: () => void;
};

export function PaginationLabel({
  page,
  pageCount,
  total,
  itemName,
  onPrevious,
  onNext
}: PaginationLabelProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="pagination-label">
      <span>
        {start} - {end} of {total} {itemName}
      </span>
      <button type="button" disabled={page <= 1} onClick={onPrevious} aria-label="Previous page">
        ‹
      </button>
      <span>
        {page} of {pageCount}
      </span>
      <button type="button" disabled={page >= pageCount} onClick={onNext} aria-label="Next page">
        ›
      </button>
    </div>
  );
}
