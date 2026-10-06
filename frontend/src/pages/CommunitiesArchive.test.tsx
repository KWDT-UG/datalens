import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { jsonResponse } from '../test/mockApi';
import { renderWithProviders } from '../test/render';
import { CommunitiesPage } from './CommunitiesPage';

vi.mock('../auth/AuthContext', () => {
  const user = {
    id: 12,
    username: 'archive.manager',
    is_staff: false,
    is_superuser: false,
    roles: ['programme_manager'],
    capabilities: ['read', 'archive_operations']
  };
  return {
    useAuth: () => ({ user }),
    useOptionalAuth: () => ({ user })
  };
});

describe('community archive actions', () => {
  it('shows an archive-only row action and opens the preview confirmation', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname === '/api/v1/communities/7/deletion-preview/') {
        return jsonResponse({
          can_archive: true,
          blockers: [],
          warnings: [],
          confirmation_message: 'Archive Katosi Community?'
        });
      }
      return jsonResponse({
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 7,
          name: 'Katosi Community',
          status: 'active',
          group_count: 0,
          member_count: 0,
          committee_count: 0,
          cooperative_count: 0,
          resource_count: 0
        }]
      });
    }));
    const user = userEvent.setup();

    renderWithProviders(<CommunitiesPage />);
    const rowActions = await screen.findByRole('button', { name: 'Actions for Katosi Community' });
    expect(screen.queryByRole('button', { name: 'Create community' })).not.toBeInTheDocument();

    await user.click(rowActions);
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Archive' }));

    expect(await screen.findByRole('alertdialog', { name: 'Archive community?' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing is permanently deleted/i)).toBeInTheDocument();
  });

  it('keeps only failed records in an open bulk dialog after partial success', async () => {
    const communities = [
      { id: 1, name: 'Community One', status: 'active' },
      { id: 2, name: 'Community Two', status: 'active' }
    ];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname.endsWith('/deletion-preview/')) {
        return jsonResponse({ can_archive: true, blockers: [], warnings: [] });
      }
      if (init?.method === 'DELETE' && url.pathname === '/api/v1/communities/2/') {
        return jsonResponse({ errors: [{ detail: 'Archive blocked by an active group.' }] }, 409);
      }
      if (init?.method === 'DELETE') return jsonResponse({}, 204);
      return jsonResponse({ count: 2, next: null, previous: null, results: communities });
    }));
    const user = userEvent.setup();

    renderWithProviders(<CommunitiesPage />);
    await user.click(await screen.findByRole('checkbox', { name: 'Select Community One' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Community Two' }));
    await user.click(screen.getAllByRole('button', { name: 'Actions' })[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Archive selected (2)' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Archive communities?' });
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Archive' })).toBeEnabled());
    await user.click(within(dialog).getByRole('button', { name: 'Archive' }));

    expect(await within(dialog).findByText(/Archive blocked by an active group/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(within(dialog).queryByText('Community One')).not.toBeInTheDocument();
      expect(within(dialog).getByText('Community Two')).toBeInTheDocument();
    });
    expect(screen.getByRole('checkbox', { name: 'Select Community One' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Community Two' })).toBeChecked();
  });
});
