import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../test/render';
import { CommunitiesPage } from './CommunitiesPage';
import { ImpactPage } from './ImpactPage';
import { ApprovalsPage } from './ApprovalsPage';
import { ResourcesPage } from './ResourcesPage';

vi.mock('../auth/AuthContext', () => {
  const user = {
    id: 1,
    username: 'admin',
    email: 'admin@example.org',
    first_name: 'Admin',
    last_name: 'User',
    workforce_type: 'staff',
    position_title: 'Administrator',
    is_active: true,
    is_staff: true,
    is_superuser: false,
    roles: [],
    capabilities: []
  };
  return {
    useAuth: () => ({ user }),
    useOptionalAuth: () => ({ user })
  };
});

function jsonResponse(body: unknown) {
  return Promise.resolve({
    json: async () => body,
    ok: true,
    status: 200
  } as Response);
}

function paginated(results: object[]) {
  return { count: results.length, next: null, previous: null, results };
}

describe('operational list sorting', () => {
  it('places resource classification after identity and sorts through the API', async () => {
    const resource = {
      id: 20,
      community: 1,
      community_name: 'Katosi Community',
      name: 'Borehole',
      resource_type: 'water_infrastructure',
      owner_type: 'community',
      owner_id: 1,
      owner_display: 'Katosi Community',
      thematic_area_name: 'WASH',
      program_name: 'Water',
      resource_category_name: 'Borehole',
      quantity: '1',
      unit: 'site',
      status: 'active'
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname === '/api/v1/resources/') return jsonResponse(paginated([resource]));
      return jsonResponse(paginated([]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    renderWithProviders(<ResourcesPage />);
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      '',
      'Resource name',
      'Community',
      'Thematic area',
      'Program',
      'Category',
      'Type',
      'Owner',
      'Quantity',
      'Financial position',
      'Status',
      'Acquired',
      'Actions'
    ]);

    fetchMock.mockClear();
    await user.click(within(table).getByRole('button', { name: 'Sort by Thematic area' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => {
      const url = new URL(String(input), window.location.origin);
      return url.pathname === '/api/v1/resources/'
        && url.searchParams.get('ordering') === 'program__thematic_area__name';
    })).toBe(true));

    await user.click(screen.getByRole('button', {
      name: 'Sort by Thematic area, currently ascending'
    }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => {
      const url = new URL(String(input), window.location.origin);
      return url.searchParams.get('ordering') === '-program__thematic_area__name';
    })).toBe(true));
  });

  it('sorts community count and location columns through the API', async () => {
    const community = {
      id: 1,
      name: 'Katosi Community',
      subcounty_name: 'Mpunge',
      resident_count: 2450,
      group_count: 3,
      member_count: 54,
      committee_count: 2,
      cooperative_count: 1,
      resource_count: 8,
      status: 'active',
      updated_at: '2026-10-03T10:00:00Z'
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => jsonResponse(paginated([community])));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    renderWithProviders(<CommunitiesPage />);
    const table = await screen.findByRole('table');
    fetchMock.mockClear();
    await user.click(within(table).getByRole('button', { name: 'Sort by Resources' }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => {
      const url = new URL(String(input), window.location.origin);
      return url.searchParams.get('ordering') === 'resource_count';
    })).toBe(true));
    expect(screen.getByRole('button', {
      name: 'Sort by Resources, currently ascending'
    }).closest('th')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('sorts impact records through the API', async () => {
    const impact = {
      id: 60,
      resource: 20,
      resource_name: 'Borehole',
      period_type: 'annual',
      as_of_date: '2026-09-30',
      beneficiary_count: 120,
      household_count: 45,
      member_count: 30,
      institution_count: 1,
      method: 'survey',
      updated_at: '2026-10-03T10:00:00Z'
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname === '/api/v1/impact-records/') return jsonResponse(paginated([impact]));
      if (url.pathname === '/api/v1/impact-records/summary/') {
        return jsonResponse({ data: {}, meta: {}, errors: [] });
      }
      if (url.pathname.startsWith('/api/v1/impact-records/by-')) {
        return jsonResponse({ data: [], meta: {}, errors: [] });
      }
      return jsonResponse(paginated([]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    renderWithProviders(<ImpactPage />);
    const table = await screen.findByRole('table');
    fetchMock.mockClear();
    await user.click(within(table).getByRole('button', { name: 'Sort by People reached' }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => {
      const url = new URL(String(input), window.location.origin);
      return url.pathname === '/api/v1/impact-records/'
        && url.searchParams.get('ordering') === 'beneficiary_count';
    })).toBe(true));
  });

  it('sorts approval requests through the API', async () => {
    const approval = {
      id: 80,
      community: 1,
      community_name: 'Katosi Community',
      entity_type: 'resource',
      entity_id: 20,
      action_type: 'update',
      review_scope: 'standard',
      status: 'pending',
      submitted_payload: { name: 'Borehole' },
      submitted_by_user_id: 1,
      submitted_at: '2026-10-03T10:00:00Z'
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => jsonResponse(paginated([approval])));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    renderWithProviders(<ApprovalsPage />);
    const table = await screen.findByRole('table');
    fetchMock.mockClear();
    await user.click(within(table).getByRole('button', { name: 'Sort by Community' }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => {
      const url = new URL(String(input), window.location.origin);
      return url.searchParams.get('ordering') === 'community__name';
    })).toBe(true));
  });
});
