import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ApprovalRequest } from '../api/types';
import { installCrudFetchMock, mutationCall } from '../test/mockApi';
import { renderWithProviders } from '../test/render';
import { ApprovalReviewDialog } from './ApprovalReviewDialog';

const approval: ApprovalRequest = {
  id: 17,
  community: 4,
  community_name: 'North Community',
  entity_type: 'resource',
  entity_id: 23,
  action_type: 'update',
  review_scope: 'standard',
  status: 'pending'
};

describe('ApprovalReviewDialog', () => {
  it.each([
    ['approve', 'Approve request'],
    ['reject', 'Reject request'],
    ['supersede', 'Supersede request']
  ] as const)('submits %s review notes through the styled dialog', async (action, buttonLabel) => {
    const fetchMock = installCrudFetchMock();
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <ApprovalReviewDialog action={action} approval={approval} onClose={onClose} />
    );

    expect(screen.getByText('resource #23')).toBeInTheDocument();
    expect(screen.getByText('North Community')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Review notes (optional)'), 'Reviewed in the UI');
    await user.click(screen.getByRole('button', { name: buttonLabel }));

    await waitFor(() => {
      const call = mutationCall(fetchMock);
      expect(call.method).toBe('POST');
      expect(call.path).toBe(`/api/v1/approval-requests/${approval.id}/${action}/`);
      expect(call.body).toEqual({ review_notes: 'Reviewed in the UI' });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
