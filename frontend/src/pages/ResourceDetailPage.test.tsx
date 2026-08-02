import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ResourceDetailPage } from './ResourceDetailPage';

vi.mock('../auth/AuthContext', () => {
  const user = {
    id: 7,
    username: 'resource.officer',
    email: 'resource@example.org',
    first_name: 'Resource',
    last_name: 'Officer',
    workforce_type: 'staff',
    position_title: 'Resource Officer',
    is_active: true,
    is_staff: false,
    is_superuser: false,
    roles: ['resource_procurement_officer'],
    capabilities: ['read', 'view_resource_financials', 'manage_resource_financials']
  };
  return {
    useAuth: () => ({ user }),
    useOptionalAuth: () => ({ user })
  };
});

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    json: async () => body,
    ok: status >= 200 && status < 300,
    status
  } as Response);
}

const detail = {
  resource: {
    id: 20,
    community: 1,
    community_name: 'Katosi Community',
    owner_type: 'member',
    owner_id: 10,
    owner_display: 'Amina Kato',
    name: 'Household water tank',
    resource_type: 'other',
    status: 'active',
    quantity: '1.00',
    unit: 'tank',
    beneficiary_summary: { count: 1, items: [] },
    payment_summary: {
      obligation_count: 1,
      principal_amount: '1000000.00',
      additional_charges: '0.00',
      total_paid: '250000.00',
      total_credited: '0.00',
      remaining_amount: '750000.00',
      percent_paid: '25.00',
      repayment_state: 'on_track',
      next_due_on: '2026-09-30',
      currency: 'UGX'
    }
  },
  beneficiaries: [
    {
      id: 30,
      resource: 20,
      beneficiary_type: 'member',
      beneficiary_id: 10,
      beneficiary_display: 'Household represented by Amina Kato',
      relationship_type: 'primary',
      benefit_scope: 'household'
    }
  ],
  status_events: [],
  impact_records: [
    {
      id: 60,
      resource: 20,
      beneficiary_count: 6,
      household_count: 1,
      member_count: 0,
      institution_count: 0,
      as_of_date: '2026-07-31',
      method: 'observed'
    }
  ],
  payment_obligations: [
    {
      id: 40,
      resource: 20,
      resource_beneficiary: 30,
      responsible_party_type: 'member',
      responsible_party_id: 10,
      responsible_party_display: 'Amina Kato',
      obligation_type: 'acquisition',
      principal_amount: '1000000.00',
      currency: 'UGX',
      deposit_required_amount: '200000.00',
      payment_frequency: 'monthly',
      installment_amount: '100000.00',
      starts_on: '2026-06-01',
      due_on: '2026-09-30',
      status: 'active',
      financial_summary: {
        principal_amount: '1000000.00',
        additional_charges: '0.00',
        total_paid: '250000.00',
        total_credited: '0.00',
        remaining_amount: '750000.00',
        percent_paid: '25.00',
        repayment_state: 'on_track',
        next_due_on: '2026-09-30',
        currency: 'UGX'
      }
    }
  ],
  payment_transactions: [
    {
      id: 50,
      obligation: 40,
      entry_type: 'deposit',
      amount: '250000.00',
      effective_on: '2026-06-10',
      reference: 'RCT-10'
    }
  ]
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
  });
  return render(
    <MemoryRouter initialEntries={[{
      pathname: '/resources/20',
      state: {
        resourceOrigin: {
          label: 'Katosi Women Group',
          path: '/communities/1/groups/4'
        }
      }
    }]}>
      <QueryClientProvider client={queryClient}>
        <Routes><Route path="/resources/:resourceId" element={<ResourceDetailPage />} /></Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('ResourceDetailPage', () => {
  it('shows contextual beneficiaries and keeps pending payments out of confirmed totals', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), window.location.origin);
      if ((init?.method ?? 'GET') === 'POST') {
        return jsonResponse({
          approval_required: true,
          detail: 'Change submitted for approval.',
          approval_request: { id: 99, review_scope: 'finance', status: 'pending' }
        }, 202);
      }
      if (url.pathname === '/api/v1/resources/20/detail/') {
        return jsonResponse(detail);
      }
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Household water tank' })).toBeInTheDocument();
    expect(screen.getByText('1 tank')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Back to Katosi Women Group' })).toHaveAttribute(
      'href',
      '/communities/1/groups/4'
    );
    expect(screen.getByText('Household represented by Amina Kato')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText(/People reached as of/)).toBeInTheDocument();
    expect(screen.getByText('25% paid')).toBeInTheDocument();
    expect(screen.getByText('UGX 750,000')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Payments & costs (1)' }));
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    await user.type(screen.getByLabelText('Amount (UGX)'), '100000');
    await user.click(screen.getByRole('button', { name: 'Submit payment' }));

    expect(await screen.findByText(/Payment submitted for finance approval/)).toBeInTheDocument();
    expect(screen.getByText('UGX 750,000')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/resource-payment-transactions/'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
