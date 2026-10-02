import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
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
    subcounty_name: 'Mpunge',
    district_name: 'Mukono',
    region_name: 'Central',
    country: 'Uganda',
    resident_count: 2450,
    group_count: 1,
    member_count: 27,
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
    member_count: 27,
    female_count: 22,
    male_count: 5,
    notes: 'Coordinates local water access work.',
    sub_county: 'Mpunge',
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
    },
    ...Array.from({ length: 25 }, (_, index) => {
      const memberId = index + 12;
      return {
        id: memberId,
        community: community.id,
        group: group.id,
        first_name: 'Member',
        last_name: String(memberId),
        member_number: `MEM-${memberId}`,
        status: memberId === 36 ? 'inactive' : 'active',
        joined_on: '2024-03-01'
      };
    })
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
      start_date: '2024-02-01',
      member_name: 'Amina Kato',
      member_number: 'MEM-10',
      member_gender: 'female',
      member_group_id: group.id,
      member_group_name: group.name
    },
    {
      id: 42,
      committee: 40,
      member: 11,
      role_name: 'Secretary',
      status: 'active',
      start_date: '2024-02-01',
      member_name: 'Beatrice Naki',
      member_number: 'MEM-11',
      member_gender: 'female',
      member_group_id: group.id,
      member_group_name: group.name
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
  const activityDate = (day: number, hour = 10) => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), day, hour).toISOString();
  };
  const activities = [
    {
      id: 51,
      community: community.id,
      group: group.id,
      activity_type: 'meeting',
      title: 'Monthly Savings and Loans Meeting',
      starts_at: activityDate(3),
      status: 'completed',
      location_text: 'KWDT Demo Community Center',
      facilitator_name: 'Group chairperson',
      women_attendance_count: 19,
      men_attendance_count: 5,
      agenda: 'Savings updates, loan repayments, and upcoming group activities',
      record_status: 'needs_attention'
    },
    {
      id: 52,
      community: community.id,
      group: group.id,
      activity_type: 'training',
      title: 'Water Committee Operations',
      starts_at: activityDate(8),
      status: 'completed',
      location_text: 'Central Demo Parish Hall',
      facilitator_name: 'Ruth Field Office',
      women_attendance_count: 24,
      men_attendance_count: 6,
      objectives: 'Committee roles, maintenance planning, and reporting',
      record_status: 'needs_attention'
    },
    {
      id: 53,
      community: community.id,
      group: group.id,
      committee: 40,
      activity_type: 'meeting',
      title: 'WASH Committee Review',
      starts_at: activityDate(14),
      status: 'completed',
      location_text: 'Group office',
      facilitator_name: 'Committee secretary',
      women_attendance_count: 6,
      men_attendance_count: 2,
      agenda: 'Review water-point maintenance and committee actions',
      minutes: 'WASH review minutes',
      record_status: 'complete'
    },
    {
      id: 55,
      community: community.id,
      group: group.id,
      activity_type: 'training',
      title: 'Record Keeping Refresher',
      starts_at: activityDate(22),
      status: 'planned',
      location_text: 'KWDT Demo Community Center',
      facilitator_name: 'Joan Programme',
      expected_participant_count: 26,
      objectives: 'Member registers, savings records, and loan tracking',
      record_status: 'planned'
    },
    {
      id: 54,
      community: community.id,
      group: group.id,
      activity_type: 'training',
      title: 'Savings Records and Loan Tracking',
      starts_at: '2024-06-10T10:00:00Z',
      ends_at: '2024-06-12T15:00:00Z',
      status: 'completed',
      location_text: 'KWDT Demo Community Center',
      facilitator_name: 'Joan Programme',
      women_attendance_count: 18,
      men_attendance_count: 4,
      objectives: 'Bookkeeping, loan register updates, arrears follow-up',
      report_notes: 'Savings training report',
      record_status: 'complete'
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
      if (url.pathname === '/api/v1/members/10/') {
        return jsonResponse(members[0]);
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
      if (url.pathname === '/api/v1/committees/40/') {
        return jsonResponse(committees[0]);
      }
      if (url.pathname === '/api/v1/committee-memberships/') {
        return jsonResponse(paginated(committeeMemberships));
      }
      if (url.pathname === '/api/v1/impact-records/') {
        return jsonResponse(paginated(impactRecords));
      }
      if (url.pathname === '/api/v1/group-activities/') {
        return jsonResponse(paginated(activities));
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

function renderCommunityDetail() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  return render(
    <MemoryRouter initialEntries={['/communities/1/groups']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/communities/:communityId/:section" element={<CommunityDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('CommunityDetailPage community summary', () => {
  it('shows subcounty, residents, resources, and groups', async () => {
    installGroupWorkspaceFetchMock();
    renderCommunityDetail();

    expect(await screen.findByRole('heading', { name: 'Katosi Community' })).toBeInTheDocument();
    expect(screen.getByText('Subcounty')).toBeInTheDocument();
    expect(screen.getAllByText('Mpunge').length).toBeGreaterThan(0);
    const summaryCard = within(
      screen.getByRole('heading', { name: 'Community summary' }).parentElement!
    );
    expect(summaryCard.getByText('Residents')).toBeInTheDocument();
    expect(summaryCard.getByText('2,450')).toBeInTheDocument();
    expect(summaryCard.getByText('Resources')).toBeInTheDocument();
    expect(summaryCard.getByText('Groups')).toBeInTheDocument();
    const groupsTable = screen.getByRole('table');
    expect(within(groupsTable).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      '',
      'Group name',
      'Code',
      'Formed',
      'Status',
      'Members',
      'Female',
      'Male',
      'Actions'
    ]);
    expect(within(groupsTable).getByText('27')).toBeInTheDocument();
    expect(within(groupsTable).getByText('22')).toBeInTheDocument();
    expect(within(groupsTable).getByText('5')).toBeInTheDocument();
  });
});

describe('CommunityDetailPage group workspace', () => {
  it('renders group summary data and tabbed workspace sections', async () => {
    installGroupWorkspaceFetchMock();
    const user = userEvent.setup();
    renderGroupWorkspace();

    expect(await screen.findByRole('heading', { name: 'Demo Savings Group' })).toBeInTheDocument();
    expect(screen.getByText('Group workspace')).toBeInTheDocument();
    expect(screen.getByText('Active members')).toBeInTheDocument();
    expect(screen.getByText('Group resources')).toBeInTheDocument();
    expect(screen.getAllByText('Mpunge').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    const workspaceTabs = within(screen.getByRole('navigation', { name: 'Group workspace sections' }));
    expect(
      workspaceTabs.getAllByRole('button').map((button) => button.textContent)
    ).toEqual(['Overview', 'Members', 'Resources', 'Trainings & Meetings', 'Committees']);
    expect(screen.getByRole('button', { name: 'Trainings & Meetings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Committees' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trainings & meetings' })).toBeInTheDocument();
    expect(screen.getByText('Schedule and attendance')).toBeInTheDocument();
    expect(screen.getByText('Monthly Savings and Loans Meeting')).toBeInTheDocument();
    expect(screen.getByText('Water Committee Operations')).toBeInTheDocument();
    expect(screen.queryByText('Context')).not.toBeInTheDocument();
    expect(screen.queryByText('Meeting day')).not.toBeInTheDocument();
    expect(screen.queryByText('Savings Records and Loan Tracking')).not.toBeInTheDocument();
    expect(screen.getByText('Demo Savings Group Leadership Committee')).toBeInTheDocument();
    expect(screen.getByText('Irrigation Pump')).toBeInTheDocument();
    expect(screen.queryByText('Record Coverage')).not.toBeInTheDocument();
    expect(screen.queryByText('Operating Rhythm')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Members' }));
    expect(screen.getByText('Amina Kato')).toBeInTheDocument();
    expect(screen.getByText('Beatrice Naki')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
    expect(screen.queryByRole('link', { name: 'Member 36' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByRole('link', { name: 'Member 36' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Filter group members by status'), 'inactive');
    expect(await screen.findByRole('link', { name: 'Member 36' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Filter group members by status'), 'all');
    await user.type(screen.getByLabelText('Search group members'), 'Amina');
    expect(screen.getByRole('link', { name: 'Amina Kato' })).toBeInTheDocument();
    expect(screen.queryByText('Beatrice Naki')).not.toBeInTheDocument();
    await user.click(screen.getByText('Amina Kato'));
    const parentGroupBackLink = await screen.findByRole('link', { name: '← Back to Demo Savings Group' });
    expect(parentGroupBackLink).toHaveAttribute('href', '/communities/1/groups/2');

    await user.click(parentGroupBackLink);
    await user.click(await screen.findByRole('button', { name: 'Resources' }));
    expect(screen.getByText('Irrigation Pump')).toBeInTheDocument();
    expect(screen.getByText('UGX 1,200,000')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Trainings & Meetings' }));
    expect(screen.getByRole('heading', { name: /Activity in/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add activity/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Add activity/ }));
    expect(screen.getByRole('dialog', { name: 'Add activity' })).toBeInTheDocument();
    expect(screen.getByLabelText('Activity type')).toHaveValue('meeting');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Monthly Savings and Loans Meeting/ })).toBeInTheDocument();
    expect(screen.queryByText('Savings Records and Loan Tracking')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Trainings' }));
    expect(screen.getByRole('button', { name: /Water Committee Operations/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /WASH Committee Review/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All' }));
    await user.type(screen.getByLabelText('Search trainings and meetings'), 'WASH');
    expect(screen.getByRole('button', { name: /WASH Committee Review/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Water Committee Operations/ })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Search trainings and meetings'));
    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(screen.getByLabelText(/activity calendar/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Agenda' }));
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.selectOptions(screen.getByLabelText('Filter activities by record status'), 'needs_attention');
    expect(screen.getByRole('button', { name: /Monthly Savings and Loans Meeting/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /WASH Committee Review/ })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Filter activities by record status'), 'all');
    await user.click(screen.getByRole('button', { name: 'Browse all history' }));
    expect(screen.getByRole('heading', { name: 'All activity history' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Savings Records and Loan Tracking' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Savings Records and Loan Tracking' }));
    expect(screen.getByText('Demo Savings Group attendees')).toBeInTheDocument();
    expect(screen.getByText('22 total participants from this group')).toBeInTheDocument();
    expect(screen.getByText('Savings training report')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit activity' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedule next' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit activity' }));
    expect(screen.getByRole('dialog', { name: 'Edit activity' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Savings Records and Loan Tracking')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Close details' }));
    expect(screen.queryByText('Demo Savings Group attendees')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Committees' }));
    expect(screen.getByText('Demo Savings Group Leadership Committee')).toBeInTheDocument();
    expect(screen.getByText(/Chairperson · since/)).toBeInTheDocument();
  });

  it('opens a committee and shows its member roster', async () => {
    installGroupWorkspaceFetchMock();
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    });

    render(
      <MemoryRouter initialEntries={['/communities/1/committees/40']}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/communities/:communityId/:section/:recordId" element={<CommunityDetailPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Demo Savings Group Leadership Committee' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Committee members' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Amina Kato' })).toHaveAttribute(
      'href',
      '/communities/1/members/10'
    );
    expect(screen.getAllByRole('link', { name: 'Demo Savings Group' })).toHaveLength(2);
    screen.getAllByRole('link', { name: 'Demo Savings Group' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/communities/1/groups/2');
    });
    expect(screen.getByText('Chairperson')).toBeInTheDocument();
  });
});
