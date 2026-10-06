import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { jsonResponse } from '../test/mockApi';
import { renderWithProviders } from '../test/render';
import { ArchiveRecordsDialog } from './ArchiveRecordsDialog';

const target = [{ id: 7, label: 'Katosi Community' }];

describe('ArchiveRecordsDialog', () => {
  it('waits for the impact preview and archives only after explicit confirmation', async () => {
    let releasePreview: ((response: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      releasePreview = resolve;
    })));
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(
      <ArchiveRecordsDialog
        entityName="community"
        isPending={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        path="/api/v1/communities/"
        targets={target}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Checking related records');
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled();
    releasePreview?.(await jsonResponse({
      can_archive: true,
      is_reversible: true,
      related_records: [{
        type: 'impact_record',
        label: 'impact records',
        relationship: 'historical references',
        count: 2,
        consequence: 'retained',
        blocking: false
      }],
      confirmation_message: 'Archive Katosi Community?'
    }));

    expect(await screen.findByText(/2 impact records \(historical references\)/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('names blocking dependencies and prevents confirmation', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({
      can_archive: false,
      blockers: [{
        type: 'group',
        label: 'active groups',
        relationship: 'belongs to community',
        count: 3,
        consequence: 'blocks_archive',
        blocking: true
      }]
    })));

    renderWithProviders(
      <ArchiveRecordsDialog
        entityName="community"
        isPending={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        path="/api/v1/communities/"
        targets={target}
      />
    );

    expect(await screen.findByText(/3 active groups \(belongs to community\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled();
  });

  it('fails closed when the dependency preview cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ errors: [{ detail: 'Unavailable' }] }, 503)));

    renderWithProviders(
      <ArchiveRecordsDialog
        entityName="community"
        isPending={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        path="/api/v1/communities/"
        targets={target}
      />
    );

    expect(await screen.findByText('Unable to check related records')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled());
  });
});
