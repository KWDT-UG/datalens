import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

import { apiGet } from '../api/client';
import { FormErrorSummary } from './FormDialog';

type DeleteBlocker = {
  count: number;
  label: string;
  relationship?: string;
};

type PermanentDeletePreview = {
  can_delete: boolean;
  confirmation_message?: string;
  blockers?: DeleteBlocker[];
};

type PermanentDeleteDialogProps = {
  error?: unknown;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  path: string;
  target: { id: number; label: string };
};

export function PermanentDeleteDialog({
  error,
  isPending,
  onClose,
  onConfirm,
  path,
  target
}: PermanentDeleteDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const submissionRef = useRef(false);
  const [confirmation, setConfirmation] = useState('');
  const preview = useQuery({
    queryKey: ['permanent-delete-preview', path, target.id],
    queryFn: () => apiGet<PermanentDeletePreview>(
      `${path}${target.id}/permanent-delete-preview/`
    ),
    retry: false
  });

  useEffect(() => cancelRef.current?.focus(), []);
  useEffect(() => {
    setConfirmation('');
    submissionRef.current = false;
  }, [path, target.id]);
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isPending) onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isPending, onClose]);

  const blockers = preview.data?.blockers ?? [];
  const blocked = preview.data?.can_delete === false || blockers.length > 0;

  async function confirmOnce() {
    if (submissionRef.current || isPending || confirmation !== 'DELETE') return;
    submissionRef.current = true;
    try {
      await onConfirm();
    } catch {
      // The mutation owns and renders its API error through the `error` prop.
      // Do not leak a rejected event-handler promise to the browser.
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
            <h2 id={titleId}>Delete permanently?</h2>
            <p id={descriptionId}>
              This permanently removes <strong>{target.label}</strong>. It cannot be restored.
            </p>
          </div>
        </header>

        <div className="archive-dialog__content">
          {preview.isLoading ? <div role="status">Checking related records…</div> : null}
          {preview.isError ? (
            <div className="form-alert form-alert--error" role="alert">
              <strong>Unable to verify deletion safety</strong>
              <span>Deletion is unavailable until this check succeeds.</span>
            </div>
          ) : null}
          {blocked ? (
            <div className="form-alert form-alert--error" role="alert">
              <strong>This record cannot be deleted</strong>
              {blockers.map((blocker, index) => (
                <span key={`${blocker.label}-${index}`}>
                  {blocker.count} {blocker.label}
                  {blocker.relationship ? ` (${blocker.relationship.replace(/_/g, ' ')})` : ''}
                </span>
              ))}
              <span>Remove or reassign these records first. Nothing will be cascaded.</span>
            </div>
          ) : null}
          {!blocked && preview.data?.confirmation_message ? (
            <p>{preview.data.confirmation_message}</p>
          ) : null}
          {!blocked && preview.isSuccess ? (
            <label className="form-field">
              <span>Type DELETE to confirm</span>
              <input
                autoComplete="off"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
          ) : null}
          <FormErrorSummary error={error} title="Delete failed" />
        </div>

        <div className="record-form__actions">
          <button ref={cancelRef} className="button button--secondary" type="button" disabled={isPending} onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button--danger"
            type="button"
            disabled={
              isPending || preview.isLoading || preview.isError || blocked || confirmation !== 'DELETE'
            }
            onClick={() => void confirmOnce()}
          >
            {isPending ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </section>
    </div>
  );
}
