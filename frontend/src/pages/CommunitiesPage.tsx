import { SearchIcon, UploadIcon } from '@patternfly/react-icons';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useArchiveRecordsMutation, useCommunitiesQuery } from '../api/queries';
import type { Community } from '../api/types';
import { ActionMenu } from '../components/ActionMenu';
import { CommunityCreateDialog } from '../components/CommunityCreateDialog';
import { ListActionError } from '../components/ListActionError';
import { StatusBadge } from '../components/StatusBadge';
import { archivePrompt, downloadCsv, toggleVisibleSelection } from '../utils/listActions';

const pageSize = 10;

function formatLocation(community: Community) {
  return [community.area_name, community.district_name, community.region_name, community.country]
    .filter(Boolean)
    .join(', ');
}

export function CommunitiesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'table' | 'card'>('table');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const query = useCommunitiesQuery({ page, page_size: pageSize, search, ordering: 'name' });
  const archiveCommunities = useArchiveRecordsMutation('communities', '/api/v1/communities/');
  const communities = query.data?.results ?? [];
  const visibleIds = communities.map((community) => community.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const pageCount = useMemo(() => Math.max(1, Math.ceil((query.data?.count ?? 0) / pageSize)), [query.data]);
  const listActions = [
    {
      label: 'Export current page',
      disabled: communities.length === 0,
      onSelect: exportCommunities
    },
    {
      label: 'Clear selection',
      disabled: selectedIds.length === 0,
      onSelect: () => setSelectedIds([])
    },
    {
      label: `Archive selected (${selectedIds.length})`,
      disabled: selectedIds.length === 0 || archiveCommunities.isPending,
      onSelect: () => void archiveSelectedCommunities(),
      tone: 'danger' as const
    }
  ];

  function exportCommunities() {
    downloadCsv(
      'communities-current-page.csv',
      communities.map((community) => ({
        area_name: community.area_name,
        committee_count: community.committee_count,
        cooperative_count: community.cooperative_count,
        country: community.country,
        district_name: community.district_name,
        group_count: community.group_count,
        id: community.id,
        member_count: community.member_count,
        name: community.name,
        region_name: community.region_name,
        resource_count: community.resource_count,
        status: community.status,
        updated_at: community.updated_at
      }))
    );
  }

  async function archiveSelectedCommunities() {
    if (!window.confirm(archivePrompt('community', selectedIds.length))) {
      return;
    }

    try {
      await archiveCommunities.mutateAsync(selectedIds);
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
          <h1>Communities</h1>
          <p className="page-header__description">List of communities</p>
        </div>
        <div className="page-actions">
          <button className="button button--primary" type="button" onClick={() => setCreateOpen(true)}>
            Create community
          </button>
          <ActionMenu items={listActions} variant="secondary" />
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
        <button
          className={`select-button ${allVisibleSelected ? 'is-selected' : ''}`}
          type="button"
          aria-label={allVisibleSelected ? 'Clear visible rows' : 'Select visible rows'}
          aria-pressed={allVisibleSelected}
          onClick={() => setSelectedIds((current) => toggleVisibleSelection(current, visibleIds))}
        />
        <ActionMenu items={listActions} />
        <button className="text-action" type="button" onClick={exportCommunities} disabled={communities.length === 0}>
          <UploadIcon aria-hidden="true" />
          Export list
        </button>
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
          <table className="data-table">
            <thead>
              <tr>
                <th aria-label="Select community" />
                <th>Community name</th>
                <th>Area / location</th>
                <th>Members</th>
                <th>Groups</th>
                <th>Committees</th>
                <th>Cooperatives</th>
                <th>Resources</th>
                <th>Status</th>
                <th>Last updated</th>
              </tr>
            </thead>
            <tbody>
              {communities.map((community) => (
                <tr key={community.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(community.id)}
                      aria-label={`Select ${community.name}`}
                      onChange={() => toggleSelected(community.id)}
                    />
                  </td>
                  <td>
                    <Link to={`/communities/${community.id}/groups`}>{community.name}</Link>
                  </td>
                  <td>{formatLocation(community) || 'Not recorded'}</td>
                  <td>{community.member_count ?? 0}</td>
                  <td>{community.group_count ?? 0}</td>
                  <td>{community.committee_count ?? 0}</td>
                  <td>{community.cooperative_count ?? 0}</td>
                  <td>{community.resource_count ?? 0}</td>
                  <td>
                    <StatusBadge status={community.status} />
                  </td>
                  <td>{community.updated_at ? new Date(community.updated_at).toLocaleDateString() : 'Not recorded'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!query.isLoading && !query.isError && communities.length > 0 && view === 'card' ? (
        <div className="community-grid">
          {communities.map((community) => (
            <Link className="community-card" key={community.id} to={`/communities/${community.id}/groups`}>
              <span className="community-card__meta">{formatLocation(community) || 'Location not recorded'}</span>
              <strong>{community.name}</strong>
              <p>{community.notes || 'Community profile and breakdown details are ready to view.'}</p>
              <div className="community-card__counts">
                <span>{community.member_count ?? 0} members</span>
                <span>{community.group_count ?? 0} groups</span>
                <span>{community.resource_count ?? 0} resources</span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      {createOpen ? <CommunityCreateDialog onClose={() => setCreateOpen(false)} /> : null}
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
