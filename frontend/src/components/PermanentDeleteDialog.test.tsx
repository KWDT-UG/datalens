import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { jsonResponse } from '../test/mockApi';
import { renderWithProviders } from '../test/render';
import { PermanentDeleteDialog } from './PermanentDeleteDialog';

describe('PermanentDeleteDialog', () => {
  it('requires an exact typed confirmation before permanent deletion', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({
      can_delete: true,
      blockers: [],
      confirmation_message: 'Permanently delete this community?'
    })));
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(
      <PermanentDeleteDialog
        isPending={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        path="/api/v1/communities/"
        target={{ id: 7, label: 'Duplicate community' }}
      />
    );

    const input = await screen.findByLabelText('Type DELETE to confirm');
    const button = screen.getByRole('button', { name: 'Delete permanently' });
    expect(button).toBeDisabled();
    await user.type(input, 'DELETE');
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('blocks deletion when any related record exists', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({
      can_delete: false,
      blockers: [{ count: 2, label: 'members', relationship: 'members' }]
    })));

    renderWithProviders(
      <PermanentDeleteDialog
        isPending={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        path="/api/v1/groups/"
        target={{ id: 8, label: 'Duplicate group' }}
      />
    );

    expect(await screen.findByText(/2 members/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Type DELETE to confirm')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeDisabled();
  });

  it('contains a failed delete request so the dialog can render the mutation error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({
      can_delete: true,
      blockers: []
    })));
    const onConfirm = vi.fn().mockRejectedValue(new Error('Relationship added'));
    const user = userEvent.setup();

    renderWithProviders(
      <PermanentDeleteDialog
        isPending={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        path="/api/v1/communities/"
        target={{ id: 9, label: 'Concurrent community' }}
      />
    );

    await user.type(await screen.findByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
