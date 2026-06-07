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
  Resource
} from '../api/types';
import { installCrudFetchMock, mutationCall } from '../test/mockApi';
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
  status: 'active'
};
const group: Group = {
  id: 2,
  community: community.id,
  code: 'CORE-1',
  name: 'Core Group',
  status: 'active'
};
const member: Member = {
  id: 3,
  community: community.id,
  group: group.id,
  first_name: 'Grace',
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
const resource: Resource = {
  id: 7,
  community: community.id,
  name: 'Core Resource',
  owner_id: community.id,
  owner_type: 'community',
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

type DialogCase = {
  createButton: string;
  editButton: string;
  editId: number;
  fieldLabel: string;
  path: string;
  render: (editing: boolean) => ReactElement;
  updatedValue: string;
  prepareCreate?: (user: ReturnType<typeof userEvent.setup>) => Promise<void>;
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
    updatedValue: 'Updated Resource'
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
    const fetchMock = installCrudFetchMock({ groups: [group], resources: [resource] });
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
    const fetchMock = installCrudFetchMock({ groups: [group], resources: [resource] });
    const user = userEvent.setup();
    renderWithProviders(dialogCase.render(true));

    const field = screen.getByLabelText(dialogCase.fieldLabel);
    expect(field).not.toHaveValue('');
    await user.clear(field);
    await user.type(field, dialogCase.updatedValue);
    await user.click(screen.getByRole('button', { name: dialogCase.editButton }));

    await waitFor(() => {
      const call = mutationCall(fetchMock);
      expect(call.method).toBe('PATCH');
      expect(call.path).toBe(`${dialogCase.path}${dialogCase.editId}/`);
      expect(Object.values(call.body)).toContain(dialogCase.updatedValue);
    });
  });
});
