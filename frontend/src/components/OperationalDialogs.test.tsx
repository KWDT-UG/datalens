import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type {
  Committee,
  Community,
  Cooperative,
  Group,
  ImpactRecord,
  Institution,
  Member,
  Program,
  Resource,
  ResourceCategory,
  ThematicArea
} from '../api/types';
import { installCrudFetchMock, jsonResponse, mutationCall } from '../test/mockApi';
import { renderWithProviders } from '../test/render';
import { CommunityCreateDialog } from './CommunityCreateDialog';
import {
  CommitteeCreateDialog,
  CooperativeCreateDialog,
  GroupCreateDialog,
  ImpactRecordCreateDialog,
  InstitutionCreateDialog,
  MemberCreateDialog
} from './CommunityBreakdownCreateDialogs';
import { ResourceCreateDialog } from './ResourceCreateDialog';

const community: Community = {
  id: 1,
  name: 'Core Community',
  country: 'Uganda',
  resident_count: 1200,
  subcounty_name: 'Mpunge',
  status: 'active'
};
const group: Group = {
  id: 2,
  community: community.id,
  code: 'CORE-1',
  name: 'Core Group',
  status: 'active',
  sub_county: 'Mpunge'
};
const member: Member = {
  id: 3,
  community: community.id,
  group: group.id,
  first_name: 'Grace',
  group_position: 'Treasurer',
  community_position: 'District councillor',
  last_name: 'Member',
  status: 'active'
};
const institution: Institution = {
  id: 4,
  community: community.id,
  name: 'Core School',
  institution_type: 'school',
  status: 'active'
};
const committee: Committee = {
  id: 5,
  community: community.id,
  name: 'Core Committee',
  status: 'active'
};
const cooperative: Cooperative = {
  id: 6,
  community: community.id,
  name: 'Core Cooperative',
  status: 'active'
};
const thematicArea: ThematicArea = {
  id: 9,
  code: 'WASH',
  name: 'WASH',
  status: 'active'
};
const program: Program = {
  id: 10,
  thematic_area: thematicArea.id,
  code: 'WATER',
  name: 'Water',
  status: 'active'
};
const resourceCategory: ResourceCategory = {
  id: 11,
  program: program.id,
  code: 'BOREHOLE',
  name: 'Borehole',
  status: 'active'
};
const resource: Resource = {
  id: 7,
  community: community.id,
  name: 'Core Resource',
  owner_id: community.id,
  owner_type: 'community',
  program: program.id,
  program_name: program.name,
  thematic_area_id: thematicArea.id,
  thematic_area_name: thematicArea.name,
  resource_category: resourceCategory.id,
  resource_category_name: resourceCategory.name,
  resource_type: 'other',
  status: 'active'
};
const impactRecord: ImpactRecord = {
  id: 8,
  resource: resource.id,
  resource_name: resource.name,
  community: community.id,
  period_type: 'monthly',
  as_of_date: '2026-06-01',
  method: 'observed'
};

async function selectResourceClassification(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Thematic area'), String(thematicArea.id));
  await screen.findByRole('option', { name: program.name });
  await user.selectOptions(screen.getByLabelText('Program'), String(program.id));
  await screen.findByRole('option', { name: resourceCategory.name });
  await user.selectOptions(
    screen.getByRole('combobox', { name: /Resource category/ }),
    String(resourceCategory.id)
  );
}

type DialogCase = {
  createButton: string;
  editButton: string;
  editId: number;
  fieldLabel: string;
  path: string;
  render: (editing: boolean) => ReactElement;
  updatedValue: string;
  prepareCreate?: (user: ReturnType<typeof userEvent.setup>) => Promise<void>;
  prepareEdit?: (user: ReturnType<typeof userEvent.setup>) => Promise<void>;
};

const commonCallbacks = {
  onClose: vi.fn(),
  onCreated: vi.fn()
};

const cases: DialogCase[] = [
  {
    createButton: 'Create community',
    editButton: 'Save community',
    editId: community.id,
    fieldLabel: 'Community name',
    path: '/api/v1/communities/',
    render: (editing) => (
      <CommunityCreateDialog
        community={editing ? community : undefined}
        onClose={commonCallbacks.onClose}
      />
    ),
    updatedValue: 'Updated Community'
  },
  {
    createButton: 'Create group',
    editButton: 'Save group',
    editId: group.id,
    fieldLabel: 'Group name',
    path: '/api/v1/groups/',
    render: (editing) => (
      <GroupCreateDialog
        communityId={community.id}
        group={editing ? group : undefined}
        {...commonCallbacks}
      />
    ),
    updatedValue: 'Updated Group',
    prepareCreate: async (user) => {
      await user.type(screen.getByLabelText('Group code'), 'NEW-1');
    }
  },
  {
    createButton: 'Create member',
    editButton: 'Save member',
    editId: member.id,
    fieldLabel: 'First name',
    path: '/api/v1/members/',
    render: (editing) => (
      <MemberCreateDialog
        communityId={community.id}
        member={editing ? member : undefined}
        {...commonCallbacks}
      />
    ),
    updatedValue: 'Updated Grace',
    prepareCreate: async (user) => {
      await user.type(screen.getByLabelText('Last name'), 'Member');
      await screen.findByRole('option', { name: group.name });
      await user.selectOptions(screen.getByLabelText('Group'), String(group.id));
    }
  },
  {
    createButton: 'Create institution',
    editButton: 'Save institution',
    editId: institution.id,
    fieldLabel: 'Institution name',
    path: '/api/v1/institutions/',
    render: (editing) => (
      <InstitutionCreateDialog
        communityId={community.id}
        institution={editing ? institution : undefined}
        {...commonCallbacks}
      />
    ),
    updatedValue: 'Updated School'
  },
  {
    createButton: 'Create committee',
    editButton: 'Save committee',
    editId: committee.id,
    fieldLabel: 'Name',
    path: '/api/v1/committees/',
    render: (editing) => (
      <CommitteeCreateDialog
        communityId={community.id}
        committee={editing ? committee : undefined}
        {...commonCallbacks}
      />
    ),
    updatedValue: 'Updated Committee'
  },
  {
    createButton: 'Create cooperative',
    editButton: 'Save cooperative',
    editId: cooperative.id,
    fieldLabel: 'Name',
    path: '/api/v1/cooperatives/',
    render: (editing) => (
      <CooperativeCreateDialog
        communityId={community.id}
        cooperative={editing ? cooperative : undefined}
        {...commonCallbacks}
      />
    ),
    updatedValue: 'Updated Cooperative'
  },
  {
    createButton: 'Create resource',
    editButton: 'Save resource',
    editId: resource.id,
    fieldLabel: 'Resource name',
    path: '/api/v1/resources/',
    render: (editing) => (
      <ResourceCreateDialog
        communityId={community.id}
        resource={editing ? resource : undefined}
        {...commonCallbacks}
      />
    ),
    updatedValue: 'Updated Resource',
    prepareCreate: selectResourceClassification,
    prepareEdit: selectResourceClassification
  },
  {
    createButton: 'Create impact record',
    editButton: 'Save impact record',
    editId: impactRecord.id,
    fieldLabel: 'Period type',
    path: '/api/v1/impact-records/',
    render: (editing) => (
      <ImpactRecordCreateDialog
        communityId={community.id}
        impactRecord={editing ? impactRecord : undefined}
        {...commonCallbacks}
      />
    ),
    updatedValue: 'quarterly',
    prepareCreate: async (user) => {
      await screen.findByRole('option', { name: resource.name });
      await user.selectOptions(screen.getByLabelText('Resource'), String(resource.id));
    }
  }
];

describe.each(cases)('$path dialog', (dialogCase) => {
  it('creates a record through the collection endpoint', async () => {
    const fetchMock = installCrudFetchMock({
      groups: [group],
      programs: [program],
      resourceCategories: [resourceCategory],
      resources: [resource],
      thematicAreas: [thematicArea]
    });
    const user = userEvent.setup();
    renderWithProviders(dialogCase.render(false));

    await user.type(screen.getByLabelText(dialogCase.fieldLabel), dialogCase.updatedValue);
    await dialogCase.prepareCreate?.(user);
    await user.click(screen.getByRole('button', { name: dialogCase.createButton }));

    await waitFor(() => {
      const call = mutationCall(fetchMock);
      expect(call.method).toBe('POST');
      expect(call.path).toBe(dialogCase.path);
    });
  });

  it('prefills and updates a record through the detail endpoint', async () => {
    const fetchMock = installCrudFetchMock({
      groups: [group],
      programs: [program],
      resourceCategories: [resourceCategory],
      resources: [resource],
      thematicAreas: [thematicArea]
    });
    const user = userEvent.setup();
    renderWithProviders(dialogCase.render(true));

    const field = screen.getByLabelText(dialogCase.fieldLabel);
    expect(field).not.toHaveValue('');
    await user.clear(field);
    await user.type(field, dialogCase.updatedValue);
    await dialogCase.prepareEdit?.(user);
    await user.click(screen.getByRole('button', { name: dialogCase.editButton }));

    await waitFor(() => {
      const call = mutationCall(fetchMock);
      expect(call.method).toBe('PATCH');
      expect(call.path).toBe(`${dialogCase.path}${dialogCase.editId}/`);
      expect(Object.values(call.body)).toContain(dialogCase.updatedValue);
    });
  });
});

it('creates a group-owned resource with inherited community location context', async () => {
  commonCallbacks.onCreated.mockClear();
  const fetchMock = installCrudFetchMock({
    communities: [community],
    programs: [program],
    resourceCategories: [resourceCategory],
    thematicAreas: [thematicArea]
  });
  const user = userEvent.setup();

  renderWithProviders(
    <ResourceCreateDialog
      communityId={community.id}
      fixedOwner={{ id: group.id, label: group.name, type: 'group' }}
      {...commonCallbacks}
    />
  );

  expect(screen.getByRole('heading', { name: 'Add group-owned resource' })).toBeInTheDocument();
  expect(await screen.findByText('Mpunge, Uganda')).toBeInTheDocument();
  expect(screen.getByText('Inherited from the selected community.')).toBeInTheDocument();
  expect(screen.getByText(group.name)).toBeInTheDocument();
  expect(screen.getByLabelText(/Site \/ location details/)).toBeInTheDocument();

  await user.type(screen.getByLabelText('Resource name'), 'Group water tank');
  await selectResourceClassification(user);
  await user.type(screen.getByLabelText(/Site \/ location details/), 'Landing site store');
  await user.click(screen.getByRole('button', { name: 'Create resource' }));

  await waitFor(() => expect(commonCallbacks.onCreated).toHaveBeenCalled());
  const mutation = mutationCall(fetchMock);
  expect(mutation.body).toMatchObject({
    community: community.id,
    location_text: 'Landing site store',
    owner_id: group.id,
    owner_type: 'group'
  });
});

it('captures subcounty in the group create and edit form', async () => {
  const fetchMock = installCrudFetchMock({ groups: [group], resources: [resource] });
  const user = userEvent.setup();

  renderWithProviders(
    <GroupCreateDialog
      communityId={community.id}
      {...commonCallbacks}
    />
  );

  expect(screen.queryByLabelText('Meeting day')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Group name'), 'Subcounty Group');
  await user.type(screen.getByLabelText('Group code'), 'SUB-1');
  await user.type(screen.getByLabelText('Subcounty'), 'Ntenjeru');
  await user.click(screen.getByRole('button', { name: 'Create group' }));

  await waitFor(() => {
    const call = mutationCall(fetchMock);
    expect(call.method).toBe('POST');
    expect(call.path).toBe('/api/v1/groups/');
    expect(call.body.sub_county).toBe('Ntenjeru');
  });
});

it('captures group and community positions in the member form', async () => {
  const fetchMock = installCrudFetchMock({ groups: [group], resources: [resource] });
  const user = userEvent.setup();

  renderWithProviders(
    <MemberCreateDialog
      communityId={community.id}
      {...commonCallbacks}
    />
  );

  await user.type(screen.getByLabelText('First name'), 'Sarah');
  await user.type(screen.getByLabelText('Last name'), 'Member');
  await screen.findByRole('option', { name: group.name });
  await user.selectOptions(screen.getByLabelText('Group'), String(group.id));
  await user.type(screen.getByLabelText('Group position'), 'Secretary');
  await user.type(
    screen.getByLabelText('Community / political position'),
    'Village representative'
  );
  await user.click(screen.getByRole('button', { name: 'Create member' }));

  await waitFor(() => {
    const call = mutationCall(fetchMock);
    expect(call.body.group_position).toBe('Secretary');
    expect(call.body.community_position).toBe('Village representative');
  });
});

it('fixes the group when creating a member from a group workspace', async () => {
  const fetchMock = installCrudFetchMock({ groups: [group], resources: [resource] });
  const user = userEvent.setup();

  renderWithProviders(
    <MemberCreateDialog
      communityId={community.id}
      fixedGroup={{ id: group.id, name: group.name }}
      {...commonCallbacks}
    />
  );

  expect(screen.getByLabelText('Group')).toHaveValue(group.name);
  expect(screen.getByLabelText('Group')).toHaveAttribute('readonly');
  await user.type(screen.getByLabelText('First name'), 'Sarah');
  await user.type(screen.getByLabelText('Last name'), 'Member');
  await user.click(screen.getByRole('button', { name: 'Create member' }));

  await waitFor(() => {
    const call = mutationCall(fetchMock);
    expect(call.method).toBe('POST');
    expect(call.path).toBe('/api/v1/members/');
    expect(call.body.group).toBe(group.id);
  });
});

it('captures subcounty and resident count in the community form', async () => {
  const fetchMock = installCrudFetchMock();
  const user = userEvent.setup();

  renderWithProviders(
    <CommunityCreateDialog onClose={commonCallbacks.onClose} />
  );

  await user.type(screen.getByLabelText('Community name'), 'Katosi');
  await user.type(screen.getByLabelText('Subcounty'), 'Ntenjeru');
  await user.type(screen.getByLabelText('Number of residents'), '2450');
  await user.click(screen.getByRole('button', { name: 'Create community' }));

  await waitFor(() => {
    const call = mutationCall(fetchMock);
    expect(call.body.subcounty_name).toBe('Ntenjeru');
    expect(call.body.resident_count).toBe(2450);
    expect(call.body.area_name).toBeUndefined();
  });
});

it('prefills and updates group subcounty', async () => {
  const fetchMock = installCrudFetchMock({ groups: [group], resources: [resource] });
  const user = userEvent.setup();

  renderWithProviders(
    <GroupCreateDialog
      communityId={community.id}
      group={group}
      {...commonCallbacks}
    />
  );

  const subCountyField = screen.getByLabelText('Subcounty');
  expect(subCountyField).toHaveValue('Mpunge');
  await user.clear(subCountyField);
  await user.type(subCountyField, 'Nakisunga');
  await user.click(screen.getByRole('button', { name: 'Save group' }));

  await waitFor(() => {
    const call = mutationCall(fetchMock);
    expect(call.method).toBe('PATCH');
    expect(call.path).toBe('/api/v1/groups/2/');
    expect(call.body.sub_county).toBe('Nakisunga');
  });
});

it('shows a pending approval result instead of treating it as a saved resource', async () => {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input), window.location.origin);
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        if (url.pathname === '/api/v1/thematic-areas/') {
          return jsonResponse({ count: 1, next: null, previous: null, results: [thematicArea] });
        }
        if (url.pathname === '/api/v1/programs/') {
          return jsonResponse({ count: 1, next: null, previous: null, results: [program] });
        }
        if (url.pathname === '/api/v1/resource-categories/') {
          return jsonResponse({ count: 1, next: null, previous: null, results: [resourceCategory] });
        }
        return jsonResponse({ count: 0, next: null, previous: null, results: [] });
      }
      return jsonResponse(
        {
          approval_required: true,
          detail: 'Change submitted for approval.',
          approval_request: {
            id: 71,
            community: community.id,
            entity_type: 'resource',
            entity_id: 0,
            action_type: 'create',
            review_scope: 'standard',
            status: 'pending'
          }
        },
        202
      );
    }
  );
  vi.stubGlobal('fetch', fetchMock);
  commonCallbacks.onCreated.mockClear();
  const user = userEvent.setup();

  renderWithProviders(
    <ResourceCreateDialog
      communityId={community.id}
      {...commonCallbacks}
    />
  );
  await user.type(screen.getByLabelText('Resource name'), 'Approval Resource');
  await selectResourceClassification(user);
  await user.click(screen.getByRole('button', { name: 'Create resource' }));

  expect(await screen.findByText('Submitted for approval')).toBeInTheDocument();
  expect(screen.getByText(/Request #71 requires standard review/)).toBeInTheDocument();
  expect(commonCallbacks.onCreated).not.toHaveBeenCalled();
});
