import { describe, expect, it } from 'vitest';

import type { AuthUser } from '../api/types';
import { capabilities, hasCapability } from './permissions';

const baseUser: AuthUser = {
  id: 1,
  username: 'staff.user',
  email: 'staff@example.org',
  first_name: 'Staff',
  last_name: 'User',
  workforce_type: 'staff',
  position_title: '',
  is_active: true,
  is_staff: false,
  is_superuser: false,
  roles: [],
  capabilities: []
};

describe('permission helpers', () => {
  it('treats Django staff users as MVP admins for frontend capability gates', () => {
    expect(
      hasCapability(
        {
          ...baseUser,
          is_staff: true
        },
        capabilities.manageUsers
      )
    ).toBe(true);
    expect(
      hasCapability(
        {
          ...baseUser,
          is_staff: true
        },
        capabilities.manageOperations
      )
    ).toBe(true);
  });

  it('does not grant unassigned non-staff users implicit product capabilities', () => {
    expect(hasCapability(baseUser, capabilities.read)).toBe(false);
  });
});
