import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef } from 'react';

import { apiGet } from '../api/client';
import { FormErrorSummary } from './FormDialog';

export type ArchiveRecordTarget = {
  id: number;
  label: string;
};

type PreviewItem = {
  blocking?: boolean;
  count?: number;
  consequence?: 'blocks_archive' | 'retained';
  label?: string;
  message?: string;
  relationship?: string;
  type?: string;
};

export type ArchivePreview = {
  allowed?: boolean;
  can_archive?: boolean;
  confirmation_message?: string;
  blockers?: Array<PreviewItem | string>;
  dependent_counts?: Record<string, number>;
  dependencies?: Array<PreviewItem | string> | Record<string, number>;
  impact?: Array<PreviewItem | string> | Record<string, number>;
  related_records?: Array<PreviewItem | string>;
  warnings?: Array<PreviewItem | string>;
};

type ArchiveRecordsDialogProps = {
  entityName: string;
  error?: unknown;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  path: string;
  targets: ArchiveRecordTarget[];
};

function pluralize(value: string, count: number) {
  if (count === 1) return value;
  return value.endsWith('y') ? `${value.slice(0, -1)}ies` : `${value}s`;
}

function itemMessage(item: PreviewItem | string) {
  if (typeof item === 'string') return item;
  if (item.message) return item.message;
  if (item.label && item.count !== undefined) {
    const relationship = item.relationship ? ` (${item.relationship.replace(/_/g, ' ')})` : '';
    return `${item.count} ${item.label}${relationship}`;
  }
  return item.label ?? '';
}

function recordEntries(value: ArchivePreview['dependencies'] | ArchivePreview['impact']) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(itemMessage).filter(Boolean);
  return Object.entries(value)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${count} ${label.replace(/_/g, ' ')}`);
}

function unwrapPreview(response: unknown): ArchivePreview {
  if (!response || typeof response !== 'object') return {};
  if ('data' in response && (response as { data?: unknown }).data) {
    return (response as { data: ArchivePreview }).data;
  }
  return response as ArchivePreview;
}

export function ArchiveRecordsDialog({
  entityName,
  error,
  isPending,
  onClose,
  onConfirm,
  path,
  targets
}: ArchiveRecordsDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const submissionRef = useRef(false);
  const ids = useMemo(() => targets.map((target) => target.id), [targets]);
  const previewsQuery = useQuery({
    queryKey: ['archive-preview', path, ids],
    queryFn: async () => Promise.all(
      ids.map(async (id) => unwrapPreview(await apiGet(`${path}${id}/deletion-preview/`)))
    ),
    enabled: ids.length > 0,
    retry: false
  });

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isPending) onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isPending, onClose]);

  const previews = previewsQuery.data ?? [];
  const blockers = previews.flatMap((preview) => preview.blockers ?? []).map(itemMessage).filter(Boolean);
  const warnings = previews.flatMap((preview) => preview.warnings ?? []).map(itemMessage).filter(Boolean);
  const impacts = previews.flatMap((preview) => [
    ...recordEntries(preview.dependent_counts),
    ...recordEntries(preview.dependencies),
    ...recordEntries(preview.impact),
    ...recordEntries(preview.related_records?.filter((item) =>
      typeof item === 'string' || (!item.blocking && item.consequence !== 'blocks_archive')
    ))
  ]);
  const isBlocked = blockers.length > 0 || previews.some((preview) =>
    preview.can_archive === false || preview.allowed === false
  );
  const title = `Archive ${targets.length === 1 ? entityName : pluralize(entityName, targets.length)}?`;
  const confirmationMessages = Array.from(new Set(
    previews.map((preview) => preview.confirmation_message).filter(Boolean)
  ));
  const distinctWarnings = warnings.filter((warning) => !impacts.includes(warning));

  async function confirmOnce() {
    if (submissionRef.current || isPending) return;
    submissionRef.current = true;
    try {
      await onConfirm();
    } finally {
      submissionRef.current = false;
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="form-dialog archive-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="form-dialog__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>
              Archiving removes {targets.length === 1 ? 'this record' : 'these records'} from active views.
              Nothing is permanently deleted, and an authorized user can restore it later.
            </p>
          </div>
        </header>

        <div className="archive-dialog__content">
          <div>
            <strong>{targets.length === 1 ? 'Record' : `${targets.length} selected records`}</strong>
            <ul className="archive-dialog__records">
              {targets.slice(0, 8).map((target) => <li key={target.id}>{target.label}</li>)}
              {targets.length > 8 ? <li>and {targets.length - 8} more</li> : null}
            </ul>
          </div>

          {previewsQuery.isLoading ? (
            <div className="archive-dialog__notice" role="status">Checking related records…</div>
          ) : null}
          {previewsQuery.isError ? (
            <div className="form-alert form-alert--error" role="alert">
              <strong>Unable to check related records</strong>
              <span>Archiving is unavailable until the impact check succeeds. Please try again.</span>
            </div>
          ) : null}
          {isBlocked ? (
            <div className="form-alert form-alert--error" role="alert">
              <strong>This {entityName} cannot be archived yet</strong>
              {blockers.length > 0
                ? blockers.map((message, index) => <span key={`${message}-${index}`}>{message}</span>)
                : <span>It still has active related records. Archive or reassign them first.</span>}
            </div>
          ) : null}
          {!isBlocked && impacts.length > 0 ? (
            <div className="archive-dialog__notice">
              <strong>Related records</strong>
              <span>{Array.from(new Set(impacts)).join(', ')} will remain stored and linked.</span>
            </div>
          ) : null}
          {!isBlocked && distinctWarnings.length > 0 ? (
            <div className="archive-dialog__notice">
              <strong>Before you continue</strong>
              {distinctWarnings.map((message, index) => <span key={`${message}-${index}`}>{message}</span>)}
            </div>
          ) : null}
          {!isBlocked && targets.length === 1 && confirmationMessages.length > 0 ? (
            <p className="archive-dialog__confirmation">{confirmationMessages[0]}</p>
          ) : null}
          <FormErrorSummary error={error} title="Archive failed" />
        </div>

        <div className="record-form__actions">
          <button ref={cancelRef} className="button button--secondary" type="button" disabled={isPending} onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button--danger"
            type="button"
            disabled={isPending || previewsQuery.isLoading || previewsQuery.isError || isBlocked}
            onClick={() => void confirmOnce()}
          >
            {isPending ? 'Archiving…' : 'Archive'}
          </button>
        </div>
      </section>
    </div>
  );
}
