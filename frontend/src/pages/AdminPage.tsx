import { SearchIcon } from '@patternfly/react-icons';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  useAdminInvitationsQuery,
  useAdminRolesQuery,
  useAdminUsersQuery,
  useCommunitiesQuery,
  useCreateAdminInvitationMutation,
  useCreateAdminUserMutation,
  useResendAdminInvitationMutation,
  useRevokeAdminInvitationMutation,
  useUpdateAdminUserMutation,
  useThematicAreasQuery
} from '../api/queries';
import type {
  AdminAccount,
  AdminAccountCreateInput,
  AdminAccountUpdateInput,
  AdminInvitationCreateInput,
  AdminRoleDefinition,
  Community,
  ThematicArea
} from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { FormDialog, FormErrorSummary } from '../components/FormDialog';

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : 'Never';
}

function formatCapability(value: string) {
  return value.replace(/_/g, ' ');
}

const workforceOptions = [
  { value: 'staff', label: 'Staff' },
  { value: 'intern', label: 'Intern' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'other', label: 'Other' }
];

type AdminAccountForm = {
  username: string;
  email: string;
  password: string;
  role: string;
  first_name: string;
  last_name: string;
  workforce_type: string;
  position_title: string;
  is_active: boolean;
  assigned_districts: string;
  assigned_community_ids: string[];
  assigned_thematic_area_ids: string[];
};

type AccountDialogProps = {
  account?: AdminAccount;
  currentUserId?: number;
  onClose: () => void;
  roles: AdminRoleDefinition[];
  communities: Community[];
  thematicAreas: ThematicArea[];
};

function AccountDialog({
  account,
  communities,
  currentUserId,
  onClose,
  roles,
  thematicAreas
}: AccountDialogProps) {
  const createUser = useCreateAdminUserMutation();
  const updateUser = useUpdateAdminUserMutation();
  const isEditing = Boolean(account);
  const isCurrentUser = account?.id === currentUserId;
  const mutationError = createUser.error ?? updateUser.error;
  const {
    formState: { errors },
    handleSubmit,
    register
  } = useForm<AdminAccountForm>({
    defaultValues: {
      username: account?.username ?? '',
      email: account?.email ?? '',
      password: '',
      role: account?.role ?? roles[0]?.value ?? '',
      first_name: account?.first_name ?? '',
      last_name: account?.last_name ?? '',
      workforce_type: account?.workforce_type ?? 'staff',
      position_title: account?.position_title ?? '',
      is_active: account?.is_active ?? true,
      assigned_districts: account?.assigned_districts?.join(', ') ?? '',
      assigned_community_ids:
        account?.assigned_community_ids?.map(String) ?? [],
      assigned_thematic_area_ids:
        account?.assigned_thematic_area_ids?.map(String) ?? []
    }
  });

  return (
    <FormDialog
      open
      title={isEditing ? `Edit ${account?.username}` : 'Create user'}
      description={
        isEditing
          ? 'Update account access, role, or password.'
          : 'Create a login and assign one primary MVP role.'
      }
      onClose={onClose}
    >
      <form
        className="record-form"
        onSubmit={handleSubmit(async (values) => {
          try {
            if (account) {
              const payload: AdminAccountUpdateInput = {
                email: values.email.trim(),
                first_name: values.first_name.trim(),
                last_name: values.last_name.trim(),
                workforce_type: values.workforce_type,
                position_title: values.position_title.trim(),
                assigned_districts: values.assigned_districts
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
                assigned_community_ids: values.assigned_community_ids.map(Number),
                assigned_thematic_area_ids:
                  values.assigned_thematic_area_ids.map(Number),
                ...(values.password ? { password: values.password } : {}),
                ...(!isCurrentUser
                  ? { role: values.role, is_active: values.is_active }
                  : {})
              };
              await updateUser.mutateAsync({ id: account.id, payload });
            } else {
              const payload: AdminAccountCreateInput = {
                username: values.username.trim(),
                email: values.email.trim(),
                password: values.password,
                role: values.role,
                first_name: values.first_name.trim(),
                last_name: values.last_name.trim(),
                workforce_type: values.workforce_type,
                position_title: values.position_title.trim(),
                is_active: values.is_active,
                assigned_districts: values.assigned_districts
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
                assigned_community_ids: values.assigned_community_ids.map(Number),
                assigned_thematic_area_ids:
                  values.assigned_thematic_area_ids.map(Number)
              };
              await createUser.mutateAsync(payload);
            }
            onClose();
          } catch {
            // The mutation error is rendered below.
          }
        })}
      >
        <FormErrorSummary error={mutationError} />
        <div className="form-grid">
          <label className="form-field">
            <span>Username</span>
            <input
              autoFocus={!isEditing}
              disabled={isEditing}
              {...register('username', {
                required: 'Enter a username.'
              })}
            />
            {errors.username ? <small>{errors.username.message}</small> : null}
          </label>

          <label className="form-field">
            <span>First name</span>
            <input {...register('first_name')} />
          </label>

          <label className="form-field">
            <span>Last name</span>
            <input {...register('last_name')} />
          </label>

          <label className="form-field">
            <span>Email</span>
            <input type="email" {...register('email')} />
          </label>

          <label className="form-field">
            <span>{isEditing ? 'New password' : 'Password'}</span>
            <input
              type="password"
              autoComplete="new-password"
              {...register('password', {
                required: isEditing ? false : 'Enter an initial password.',
                minLength: {
                  value: 8,
                  message: 'Use at least 8 characters.'
                }
              })}
            />
            {isEditing ? <small>Leave blank to keep the current password.</small> : null}
            {errors.password ? <small>{errors.password.message}</small> : null}
          </label>

          <label className="form-field">
            <span>Primary role</span>
            <select disabled={isCurrentUser} {...register('role', { required: true })}>
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            {isCurrentUser ? <small>Your own administrator role is protected.</small> : null}
          </label>

          <label className="form-field">
            <span>Workforce type</span>
            <select {...register('workforce_type')}>
              {workforceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Position / title</span>
            <input {...register('position_title')} />
          </label>

          <label className="form-field">
            <span>Assigned districts</span>
            <input
              placeholder="District A, District B"
              {...register('assigned_districts')}
            />
            <small>Comma-separated. Empty assignments retain organization-wide access.</small>
          </label>

          <label className="form-field">
            <span>Assigned communities</span>
            <select multiple size={5} {...register('assigned_community_ids')}>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Assigned thematic areas</span>
            <select multiple size={5} {...register('assigned_thematic_area_ids')}>
              {thematicAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name} ({area.code})
                </option>
              ))}
            </select>
          </label>

          <label className="form-field form-field--checkbox">
            <input type="checkbox" disabled={isCurrentUser} {...register('is_active')} />
            <span>Account is active</span>
          </label>
        </div>

        <footer className="record-form__actions">
          <button className="button button--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={createUser.isPending || updateUser.isPending}
          >
            {createUser.isPending || updateUser.isPending ? 'Saving...' : 'Save account'}
          </button>
        </footer>
      </form>
    </FormDialog>
  );
}

type InviteDialogProps = {
  onClose: () => void;
  onInvited: (url: string) => void;
  roles: AdminRoleDefinition[];
};

function InviteDialog({ onClose, onInvited, roles }: InviteDialogProps) {
  const inviteUser = useCreateAdminInvitationMutation();
  const {
    formState: { errors },
    handleSubmit,
    register
  } = useForm<AdminInvitationCreateInput>({
    defaultValues: {
      workforce_type: 'staff',
      role: roles[0]?.value ?? ''
    }
  });

  return (
    <FormDialog
      open
      title="Invite user"
      description="Send a single-use invitation that expires in seven days."
      onClose={onClose}
    >
      <form
        className="record-form"
        onSubmit={handleSubmit(async (values) => {
          try {
            const response = await inviteUser.mutateAsync({
              ...values,
              email: values.email.trim(),
              first_name: values.first_name?.trim(),
              last_name: values.last_name?.trim(),
              position_title: values.position_title?.trim()
            });
            onInvited(response.data.invitation_url);
            onClose();
          } catch {
            // The mutation error is rendered below.
          }
        })}
      >
        <FormErrorSummary error={inviteUser.error} />
        <div className="form-grid">
          <label className="form-field">
            <span>Email</span>
            <input
              autoFocus
              type="email"
              {...register('email', { required: 'Enter an email address.' })}
            />
            {errors.email ? <small>{errors.email.message}</small> : null}
          </label>
          <label className="form-field">
            <span>First name</span>
            <input {...register('first_name')} />
          </label>
          <label className="form-field">
            <span>Last name</span>
            <input {...register('last_name')} />
          </label>
          <label className="form-field">
            <span>Workforce type</span>
            <select {...register('workforce_type')}>
              {workforceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Position / title</span>
            <input {...register('position_title')} />
          </label>
          <label className="form-field">
            <span>Primary role</span>
            <select {...register('role', { required: true })}>
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <footer className="record-form__actions">
          <button className="button button--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button button--primary" disabled={inviteUser.isPending}>
            {inviteUser.isPending ? 'Sending...' : 'Send invitation'}
          </button>
        </footer>
      </form>
    </FormDialog>
  );
}

export function AdminPage() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [invitationUrl, setInvitationUrl] = useState('');
  const usersQuery = useAdminUsersQuery(search);
  const rolesQuery = useAdminRolesQuery();
  const communitiesQuery = useCommunitiesQuery({
    page: 1,
    page_size: 200,
    ordering: 'name'
  });
  const thematicAreasQuery = useThematicAreasQuery();
  const invitationsQuery = useAdminInvitationsQuery();
  const resendInvitation = useResendAdminInvitationMutation();
  const revokeInvitation = useRevokeAdminInvitationMutation();
  const updateUser = useUpdateAdminUserMutation();
  const accounts = usersQuery.data?.data.users ?? [];
  const roles = rolesQuery.data?.data.roles ?? [];
  const communities = communitiesQuery.data?.results ?? [];
  const thematicAreas = thematicAreasQuery.data?.results ?? [];
  const invitations = invitationsQuery.data?.data.invitations ?? [];
  const pendingInvitations = invitations.filter((invitation) => invitation.status === 'pending');
  const activeCount = accounts.filter((account) => account.is_active).length;

  async function toggleAccount(account: AdminAccount) {
    const action = account.is_active ? 'deactivate' : 'activate';
    if (!window.confirm(`${action === 'activate' ? 'Activate' : 'Deactivate'} ${account.username}?`)) {
      return;
    }
    await updateUser.mutateAsync({
      id: account.id,
      payload: { is_active: !account.is_active }
    });
  }

  async function revoke(invitationId: number) {
    if (!window.confirm('Revoke this pending invitation?')) {
      return;
    }
    await revokeInvitation.mutateAsync(invitationId);
  }

  async function resend(invitationId: number) {
    if (!window.confirm('Resend this expired invitation?')) {
      return;
    }
    const response = await resendInvitation.mutateAsync(invitationId);
    setInvitationUrl(response.data.invitation_url);
  }

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <h1>Admin</h1>
          <p className="page-header__description">
            Manage Data Lens accounts and review the MVP role definitions.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="button button--primary"
            type="button"
            onClick={() => setInviteOpen(true)}
            disabled={roles.length === 0}
          >
            Invite user
          </button>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={roles.length === 0}
          >
            Create account directly
          </button>
        </div>
      </div>

      <div className="metric-grid">
        <article className="metric-card">
          <span>Total users</span>
          <strong>{accounts.length}</strong>
        </article>
        <article className="metric-card">
          <span>Active users</span>
          <strong>{activeCount}</strong>
        </article>
        <article className="metric-card">
          <span>Inactive users</span>
          <strong>{accounts.length - activeCount}</strong>
        </article>
        <article className="metric-card">
          <span>Pending invitations</span>
          <strong>{pendingInvitations.length}</strong>
        </article>
      </div>

      {invitationUrl ? (
        <div className="invite-link-panel">
          <div>
            <strong>Invitation sent</strong>
            <span>Local email uses the console backend. The link is available here for testing.</span>
          </div>
          <code>{invitationUrl}</code>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void navigator.clipboard.writeText(invitationUrl)}
          >
            Copy link
          </button>
        </div>
      ) : null}

      <div className="toolbar toolbar--top">
        <label className="search-field search-field--wide">
          <SearchIcon aria-hidden="true" />
          <input
            type="search"
            value={search}
            placeholder="Search users"
            aria-label="Search users"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      {usersQuery.isLoading ? <div className="state-box">Loading users...</div> : null}
      {usersQuery.isError ? <div className="state-box state-box--error">Unable to load users.</div> : null}
      {updateUser.isError ? (
        <div className="state-box state-box--error">{updateUser.error.message}</div>
      ) : null}
      {resendInvitation.isError ? (
        <div className="state-box state-box--error">{resendInvitation.error.message}</div>
      ) : null}
      {revokeInvitation.isError ? (
        <div className="state-box state-box--error">{revokeInvitation.error.message}</div>
      ) : null}

      {!usersQuery.isLoading && accounts.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Workforce</th>
                <th>Position</th>
                <th>Assignments</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const role = roles.find((item) => item.value === account.role);
                const isCurrentUser = account.id === currentUser?.id;
                return (
                  <tr key={account.id}>
                    <td>
                      {account.username}
                      {isCurrentUser ? <span className="table-note">You</span> : null}
                    </td>
                    <td>{[account.first_name, account.last_name].filter(Boolean).join(' ') || 'Not recorded'}</td>
                    <td>{account.email || 'Not recorded'}</td>
                    <td>{role?.label ?? account.role ?? 'No role'}</td>
                    <td>{formatCapability(account.workforce_type ?? 'not recorded')}</td>
                    <td>{account.position_title || 'Not recorded'}</td>
                    <td>
                      {[
                        ...(account.assigned_districts ?? []),
                        ...(account.assigned_community_ids ?? []).map(
                          (id) => communities.find((item) => item.id === id)?.name ?? `Community ${id}`
                        ),
                        ...(account.assigned_thematic_area_ids ?? []).map(
                          (id) => thematicAreas.find((item) => item.id === id)?.code ?? `Theme ${id}`
                        )
                      ].join(', ') || 'Organization-wide'}
                    </td>
                    <td>
                      <span className={`account-status account-status--${account.is_active ? 'active' : 'inactive'}`}>
                        {account.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{formatDate(account.last_login)}</td>
                    <td>{formatDate(account.date_joined)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="button button--secondary"
                          type="button"
                          onClick={() => setEditingAccount(account)}
                        >
                          Edit
                        </button>
                        <button
                          className="button button--muted"
                          type="button"
                          disabled={isCurrentUser || updateUser.isPending}
                          onClick={() => void toggleAccount(account)}
                        >
                          {account.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <section className="admin-roles">
        <div>
          <h2>Invitations</h2>
          <p className="page-header__description">
            Pending invitations expire after seven days. Recently expired invitations remain visible for resend.
          </p>
        </div>
        {invitationsQuery.isLoading ? <div className="state-box">Loading invitations...</div> : null}
        {invitations.length === 0 && !invitationsQuery.isLoading ? (
          <div className="state-box">No invitations have been sent yet.</div>
        ) : null}
        {invitations.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Workforce</th>
                  <th>Position</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td>{invitation.email}</td>
                    <td>{[invitation.first_name, invitation.last_name].filter(Boolean).join(' ') || 'Not recorded'}</td>
                    <td>{formatCapability(invitation.workforce_type)}</td>
                    <td>{invitation.position_title || 'Not recorded'}</td>
                    <td>{roles.find((role) => role.value === invitation.role)?.label ?? invitation.role}</td>
                    <td>{formatCapability(invitation.status)}</td>
                    <td>{formatDate(invitation.expires_at)}</td>
                    <td>
                      <div className="row-actions">
                        {invitation.can_resend ? (
                          <button
                            className="button button--primary"
                            type="button"
                            disabled={resendInvitation.isPending}
                            onClick={() => void resend(invitation.id)}
                          >
                            Resend
                          </button>
                        ) : null}
                        <button
                          className="button button--secondary"
                          type="button"
                          disabled={invitation.status !== 'pending' || revokeInvitation.isPending}
                          onClick={() => void revoke(invitation.id)}
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="admin-roles">
        <div>
          <h2>MVP roles</h2>
          <p className="page-header__description">
            Capabilities are enforced by the backend and returned with each authenticated session.
          </p>
        </div>
        {rolesQuery.isLoading ? <div className="state-box">Loading roles...</div> : null}
        <div className="admin-role-grid">
          {roles.map((role) => (
            <article className="admin-role-card" key={role.value}>
              <h3>{role.label}</h3>
              <code>{role.value}</code>
              <div className="capability-list">
                {role.capabilities.map((capability) => (
                  <span key={capability}>{formatCapability(capability)}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {createOpen ? (
        <AccountDialog
          currentUserId={currentUser?.id}
          communities={communities}
          roles={roles}
          thematicAreas={thematicAreas}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}
      {inviteOpen ? (
        <InviteDialog
          roles={roles}
          onClose={() => setInviteOpen(false)}
          onInvited={setInvitationUrl}
        />
      ) : null}
      {editingAccount ? (
        <AccountDialog
          account={editingAccount}
          communities={communities}
          currentUserId={currentUser?.id}
          roles={roles}
          thematicAreas={thematicAreas}
          onClose={() => setEditingAccount(null)}
        />
      ) : null}
    </section>
  );
}
