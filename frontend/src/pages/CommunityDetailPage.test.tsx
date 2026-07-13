import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { CommunityDetailPage } from './CommunityDetailPage';

vi.mock('../auth/AuthContext', () => {
  const user = {
    id: 1,
    username: 'program.manager',
    email: 'manager@example.org',
    first_name: 'Program',
    last_name: 'Manager',
    workforce_type: 'staff',
    position_title: 'Program Manager',
    is_active: true,
    is_staff: true,
    is_superuser: false,
    roles: [],
    capabilities: []
  };

  return {
    useAuth: () => ({
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      user
    }),
    useOptionalAuth: () => ({ user })
  };
});

function paginated<T>(results: T[]) {
  return {
    count: results.length,
    next: null,
    previous: null,
    results
  };
}

function jsonResponse(body: unknown) {
  return Promise.resolve({
    json: async () => body,
    ok: true,
    status: 200
  } as Response);
}

function installGroupWorkspaceFetchMock() {
  const community = {
    id: 1,
    name: 'Katosi Community',
    status: 'active',
    group_count: 1,
    member_count: 2,
    resource_count: 1
  };
  const group = {
    id: 2,
    community: community.id,
    community_name: community.name,
    code: 'KWDT-DEMO-GRP',
    name: 'Demo Savings Group',
    status: 'active',
    formed_on: '2024-01-15',
    meeting_day: 'Thursday',
    notes: 'Coordinates local water access work.',
    updated_at: '2026-06-15T10:30:00Z'
  };
  const members = [
    {
      id: 10,
      community: community.id,
      group: group.id,
      first_name: 'Amina',
      last_name: 'Kato',
      member_number: 'MEM-10',
      phone: '0700000000',
      status: 'active',
      joined_on: '2024-02-01'
    },
    {
      id: 11,
      community: community.id,
      group: group.id,
      first_name: 'Beatrice',
      last_name: 'Naki',
      member_number: 'MEM-11',
      status: 'active',
      joined_on: '2024-02-15'
    }
  ];
  const resources = [
    {
      id: 20,
      community: community.id,
      owner_type: 'group',
      owner_id: group.id,
      name: 'Irrigation Pump',
      resource_type: 'equipment',
      quantity: '1',
      unit: 'unit',
      value_amount: '1200000',
      value_currency: 'UGX',
      status: 'active'
    }
  ];
  const committees = [
    {
      id: 40,
      community: community.id,
      name: 'Demo Savings Group Leadership Committee',
      committee_type: 'group_leadership',
      status: 'active',
      formed_on: '2024-02-01'
    }
  ];
  const committeeMemberships = [
    {
      id: 41,
      committee: 40,
      member: 10,
      role_name: 'Chairperson',
      status: 'active',
      start_date: '2024-02-01'
    },
    {
      id: 42,
      committee: 40,
      member: 11,
      role_name: 'Secretary',
      status: 'active',
      start_date: '2024-02-01'
    }
  ];
  const impactRecords = [
    {
      id: 30,
      resource: 20,
      resource_name: 'Irrigation Pump',
      community: community.id,
      beneficiary_type: 'group',
      beneficiary_id: group.id,
      period_type: 'monthly',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      as_of_date: '2026-06-30',
      beneficiary_count: 40,
      household_count: 18,
      member_count: 32,
      method: 'field_visit'
    }
  ];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), window.location.origin);

      if (url.pathname === '/api/v1/communities/1/') {
        return jsonResponse(community);
      }
      if (url.pathname === '/api/v1/groups/2/') {
        return jsonResponse(group);
      }
      if (url.pathname === '/api/v1/groups/2/members/') {
        return jsonResponse(members);
      }
      if (url.pathname === '/api/v1/groups/') {
        return jsonResponse(paginated([group]));
      }
      if (url.pathname === '/api/v1/resources/') {
        return jsonResponse(paginated(resources));
      }
      if (url.pathname === '/api/v1/committees/') {
        return jsonResponse(paginated(committees));
      }
      if (url.pathname === '/api/v1/committee-memberships/') {
        return jsonResponse(paginated(committeeMemberships));
      }
      if (url.pathname === '/api/v1/impact-records/') {
        return jsonResponse(paginated(impactRecords));
      }

      return jsonResponse(paginated([]));
    })
  );
}

function renderGroupWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  return render(
    <MemoryRouter initialEntries={['/communities/1/groups/2']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/communities/:communityId/:section/:recordId" element={<CommunityDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('CommunityDetailPage group workspace', () => {
  it('renders group summary data and tabbed workspace sections', async () => {
    installGroupWorkspaceFetchMock();
    const user = userEvent.setup();
    renderGroupWorkspace();

    expect(await screen.findByRole('heading', { name: 'Demo Savings Group' })).toBeInTheDocument();
    expect(screen.getByText('Group workspace')).toBeInTheDocument();
    expect(screen.getByText('Active members')).toBeInTheDocument();
    expect(screen.getByText('Group resources')).toBeInTheDocument();
    expect(screen.getByText('Coordinates local water access work.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trainings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Committees' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Upcoming trainings' })).toBeInTheDocument();
    expect(screen.getByText('Training schedule')).toBeInTheDocument();
    expect(screen.getByText('Savings Records and Loan Tracking')).toBeInTheDocument();
    expect(screen.getByText('Demo Savings Group Leadership Committee')).toBeInTheDocument();
    expect(screen.getByText('Irrigation Pump')).toBeInTheDocument();
    expect(screen.queryByText('Record Coverage')).not.toBeInTheDocument();
    expect(screen.queryByText('Operating Rhythm')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Members' }));
    expect(screen.getByText('Amina Kato')).toBeInTheDocument();
    expect(screen.getByText('Beatrice Naki')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Resources' }));
    expect(screen.getByText('Irrigation Pump')).toBeInTheDocument();
    expect(screen.getByText('UGX 1,200,000')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Trainings' }));
    expect(screen.getAllByText('Savings Records and Loan Tracking').length).toBeGreaterThan(1);
    expect(screen.getByText('Enterprise Planning for Group Assets')).toBeInTheDocument();
    expect(screen.getByText('Demo Savings Group attendees')).toBeInTheDocument();
    expect(screen.getByText('22 total participants from this group')).toBeInTheDocument();
    expect(screen.getByText('Attendance by age band')).toBeInTheDocument();
    expect(screen.getByText('Participants, split by gender')).toBeInTheDocument();
    expect(screen.getByLabelText('Training attendance by age and gender')).toBeInTheDocument();
    expect(screen.getByText('Savings training report')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Committees' }));
    expect(screen.getByText('Demo Savings Group Leadership Committee')).toBeInTheDocument();
    expect(screen.getByText(/Chairperson · since/)).toBeInTheDocument();
  });
});
