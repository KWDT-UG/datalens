import { SearchIcon, UploadIcon } from '@patternfly/react-icons';
import { useMemo, useState } from 'react';

import { useArchiveRecordsMutation, useResourcesQuery } from '../api/queries';
import type { Resource } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { capabilities, hasCapability } from '../auth/permissions';
import { ActionMenu } from '../components/ActionMenu';
import { ListActionError } from '../components/ListActionError';
import { ResourceCreateDialog } from '../components/ResourceCreateDialog';
import { StatusBadge } from '../components/StatusBadge';
import { archivePrompt, downloadCsv, toggleVisibleSelection } from '../utils/listActions';
import { PaginationLabel } from './CommunitiesPage';

const pageSize = 10;

function formatLabel(value?: string | null) {
  return value ? value.replace(/_/g, ' ') : 'Not recorded';
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : 'Not recorded';
}

function formatMoney(resource: Resource) {
  if (!resource.value_amount) {
    return 'Not recorded';
  }
  return `${resource.value_currency ?? 'UGX'} ${Number(resource.value_amount).toLocaleString()}`;
}

function formatQuantity(resource: Resource) {
  return [resource.quantity, resource.unit].filter(Boolean).join(' ') || 'Not recorded';
}

function formatThemes(resource: Resource) {
  return resource.thematic_areas?.map((area) => area.code).join(', ') || 'Not recorded';
}

export function ResourcesPage() {
  const { user } = useAuth();
  const canManage = hasCapability(user, capabilities.manageResources);
  const canArchive = hasCapability(user, capabilities.archiveResources);
  const canExport = hasCapability(user, capabilities.export);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const query = useResourcesQuery({
    page,
    page_size: pageSize,
    search,
    ordering: 'name'
  });
  const archiveResources = useArchiveRecordsMutation('resources', '/api/v1/resources/');
  const resources = query.data?.results ?? [];
  const visibleIds = resources.map((resource) => resource.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const pageCount = useMemo(() => Math.max(1, Math.ceil((query.data?.count ?? 0) / pageSize)), [query.data]);
  const listActions = [
    ...(canExport ? [{
      label: 'Export current page',
      disabled: resources.length === 0,
      onSelect: exportResources
    }] : []),
    ...(canArchive ? [{
      label: 'Clear selection',
      disabled: selectedIds.length === 0,
      onSelect: () => setSelectedIds([])
    }] : []),
    ...(canArchive ? [{
      label: `Archive selected (${selectedIds.length})`,
      disabled: selectedIds.length === 0 || archiveResources.isPending,
      onSelect: () => void archiveSelectedResources(),
      tone: 'danger' as const
    }] : [])
  ];

  function exportResources() {
    downloadCsv(
      'resources-current-page.csv',
      resources.map((resource) => ({
        acquired_on: resource.acquired_on,
        community: resource.community,
        id: resource.id,
        name: resource.name,
        owner_id: resource.owner_id,
        owner_type: resource.owner_type,
        quantity: resource.quantity,
        resource_type: resource.resource_type,
        status: resource.status,
        thematic_areas: resource.thematic_areas?.map((area) => area.code).join('; '),
        unit: resource.unit,
        updated_at: resource.updated_at,
        value_amount: resource.value_amount,
        value_currency: resource.value_currency
      }))
    );
  }

  async function archiveSelectedResources() {
    if (!window.confirm(archivePrompt('resource', selectedIds.length))) {
      return;
    }

    try {
      await archiveResources.mutateAsync(selectedIds);
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
          <h1>Resources</h1>
          <p className="page-header__description">Resource records loaded from the MVP API.</p>
        </div>
        <div className="page-actions">
          {canManage ? (
            <button className="button button--primary" type="button" onClick={() => setCreateOpen(true)}>
              Create resource
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
            placeholder="Search resources"
            aria-label="Search resources"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
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
        {canExport ? <button className="text-action" type="button" onClick={exportResources} disabled={resources.length === 0}>
          <UploadIcon aria-hidden="true" />
          Export list
        </button> : null}
        <span className="toolbar__spacer" />
        <PaginationLabel
          page={page}
          pageCount={pageCount}
          total={query.data?.count ?? 0}
          itemName="resources"
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(pageCount, current + 1))}
        />
      </div>

      {query.isLoading ? <div className="state-box">Loading resources...</div> : null}
      {query.isError ? <div className="state-box state-box--error">Unable to load resources.</div> : null}
      <ListActionError error={archiveResources.error} />
      {!query.isLoading && !query.isError && resources.length === 0 ? (
        <div className="state-box">No resources match this search.</div>
      ) : null}

      {!query.isLoading && !query.isError && resources.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th aria-label="Select resource" />
                <th>Resource name</th>
                <th>Community</th>
                <th>Type</th>
                <th>Owner</th>
                <th>Quantity</th>
                <th>Value</th>
                <th>Themes</th>
                <th>Status</th>
                <th>Acquired</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => (
                <tr key={resource.id}>
                  <td>
                    {canArchive ? <input
                      type="checkbox"
                      checked={selectedIds.includes(resource.id)}
                      aria-label={`Select ${resource.name}`}
                      onChange={() => toggleSelected(resource.id)}
                    /> : null}
                  </td>
                  <td>{resource.name}</td>
                  <td>{resource.community}</td>
                  <td>{formatLabel(resource.resource_type)}</td>
                  <td>{`${formatLabel(resource.owner_type)} #${resource.owner_id ?? 'unknown'}`}</td>
                  <td>{formatQuantity(resource)}</td>
                  <td>{formatMoney(resource)}</td>
                  <td>{formatThemes(resource)}</td>
                  <td>
                    <StatusBadge status={resource.status} />
                  </td>
                  <td>{formatDate(resource.acquired_on)}</td>
                  <td>
                    <div className="row-actions">
                      {canManage ? <button
                        className="button button--secondary"
                        type="button"
                        onClick={() => setEditingResource(resource)}
                      >
                        Edit
                      </button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {canManage && createOpen ? (
        <ResourceCreateDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setSearch('');
            setPage(1);
          }}
        />
      ) : null}

      {canManage && editingResource ? (
        <ResourceCreateDialog
          resource={editingResource}
          onClose={() => setEditingResource(null)}
          onCreated={() => {
            setEditingResource(null);
          }}
        />
      ) : null}
    </section>
  );
}
