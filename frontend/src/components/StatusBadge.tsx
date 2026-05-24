import type { ApprovalStatus, RecordStatus, SyncStatus } from '../api/types';

type StatusBadgeProps = {
  status?: ApprovalStatus | RecordStatus | SyncStatus;
};

const labels: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  archived: 'Archived',
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  needs_changes: 'Needs Changes',
  synced: 'Synced',
  pending_sync: 'Pending Sync',
  sync_failed: 'Sync Failed',
  conflict: 'Conflict'
};

export function StatusBadge({ status = 'active' }: StatusBadgeProps) {
  const normalized = String(status).toLowerCase();
  return <span className={`status-badge status-badge--${normalized}`}>{labels[normalized] ?? status}</span>;
}
