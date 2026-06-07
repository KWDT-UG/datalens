import { useForm } from 'react-hook-form';

import { useReviewApprovalMutation } from '../api/queries';
import type { ApprovalRequest } from '../api/types';
import { FormDialog, FormErrorSummary } from './FormDialog';

export type ApprovalReviewAction = 'approve' | 'reject' | 'supersede';

type ApprovalReviewDialogProps = {
  action: ApprovalReviewAction;
  approval: ApprovalRequest;
  onClose: () => void;
};

type ReviewFormValues = {
  review_notes: string;
};

const actionContent: Record<
  ApprovalReviewAction,
  { buttonLabel: string; description: string; title: string }
> = {
  approve: {
    buttonLabel: 'Approve request',
    description: 'Confirm that this proposed change is ready to be applied.',
    title: 'Approve request'
  },
  reject: {
    buttonLabel: 'Reject request',
    description: 'Reject this proposed change and optionally explain the decision.',
    title: 'Reject request'
  },
  supersede: {
    buttonLabel: 'Supersede request',
    description: 'Mark this request as replaced by a newer or corrected proposal.',
    title: 'Supersede request'
  }
};

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

export function ApprovalReviewDialog({
  action,
  approval,
  onClose
}: ApprovalReviewDialogProps) {
  const mutation = useReviewApprovalMutation(action);
  const content = actionContent[action];
  const { handleSubmit, register } = useForm<ReviewFormValues>({
    defaultValues: { review_notes: '' }
  });

  return (
    <FormDialog
      open
      title={content.title}
      description={content.description}
      onClose={onClose}
    >
      <form
        className="record-form"
        onSubmit={handleSubmit(async ({ review_notes }) => {
          try {
            await mutation.mutateAsync({
              id: approval.id,
              review_notes: review_notes.trim()
            });
            onClose();
          } catch {
            // The mutation error is rendered in the dialog.
          }
        })}
      >
        <FormErrorSummary error={mutation.error} title="Review failed" />

        <dl className="review-summary">
          <div>
            <dt>Request</dt>
            <dd>
              {formatLabel(approval.entity_type)} #{approval.entity_id ?? 'new'}
            </dd>
          </div>
          <div>
            <dt>Submitted action</dt>
            <dd>{formatLabel(approval.action_type)}</dd>
          </div>
          <div>
            <dt>Community</dt>
            <dd>{approval.community_name ?? 'Not recorded'}</dd>
          </div>
        </dl>

        <label className="form-field">
          <span>Review notes (optional)</span>
          <textarea
            autoFocus
            rows={5}
            placeholder="Add context for the submitter and future reviewers."
            {...register('review_notes')}
          />
        </label>

        <footer className="record-form__actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </button>
          <button
            className={action === 'approve' ? 'button button--primary' : 'button button--muted'}
            type="submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Submitting...' : content.buttonLabel}
          </button>
        </footer>
      </form>
    </FormDialog>
  );
}
