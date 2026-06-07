import { TimesIcon } from '@patternfly/react-icons';
import type { ReactNode } from 'react';

import { ApiClientError } from '../api/client';

type FormDialogProps = {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
};

export function FormDialog({ children, description, onClose, open, title }: FormDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="form-dialog-title">
        <header className="form-dialog__header">
          <div>
            <h2 id="form-dialog-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="icon-button" type="button" aria-label={`Close ${title}`} title="Close" onClick={onClose}>
            <TimesIcon aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

type FormErrorSummaryProps = {
  error: unknown;
  title?: string;
};

export function FormErrorSummary({ error, title = 'Save failed' }: FormErrorSummaryProps) {
  if (!error) {
    return null;
  }

  const items =
    error instanceof ApiClientError && error.errors.length > 0
      ? error.errors
      : [{ detail: error instanceof Error ? error.message : 'Unable to save this record.' }];

  return (
    <div className="form-alert form-alert--error" role="alert">
      <strong>{title}</strong>
      {items.map((item) => (
        <span key={`${item.attr ?? 'record'}-${item.detail}`}>
          {item.attr ? `${item.attr}: ` : ''}
          {item.detail}
        </span>
      ))}
    </div>
  );
}
