import { useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  useCreateCommitteeMembershipMutation,
  useCreateCooperativeMembershipMutation,
  useMembersQuery,
  useUpdateCommitteeMembershipMutation,
  useUpdateCooperativeMembershipMutation
} from '../api/queries';
import type {
  CommitteeMembership,
  CommitteeMembershipInput,
  CooperativeMembership,
  CooperativeMembershipInput
} from '../api/types';
import { FormDialog, FormErrorSummary } from './FormDialog';

type Membership = CommitteeMembership | CooperativeMembership;
type MembershipKind = 'committee' | 'cooperative';
type FormValues = {
  member: number | '';
  role_name: string;
  status: string;
  start_date: string;
  end_date: string;
  notes: string;
};

export function ParticipationMembershipDialog({
  community,
  kind,
  membership,
  onClose,
  parentId
}: {
  community: number;
  kind: MembershipKind;
  membership?: Membership;
  onClose: () => void;
  parentId: number;
}) {
  const [memberSearch, setMemberSearch] = useState('');
  const membersQuery = useMembersQuery({
    community,
    page: 1,
    page_size: 200,
    search: memberSearch || undefined,
    ordering: 'last_name,first_name'
  });
  const createCommittee = useCreateCommitteeMembershipMutation();
  const updateCommittee = useUpdateCommitteeMembershipMutation();
  const createCooperative = useCreateCooperativeMembershipMutation();
  const updateCooperative = useUpdateCooperativeMembershipMutation();
  const createMutation = kind === 'committee' ? createCommittee : createCooperative;
  const updateMutation = kind === 'committee' ? updateCommittee : updateCooperative;
  const { formState: { errors }, handleSubmit, register } = useForm<FormValues>({
    defaultValues: {
      member: membership?.member ?? '',
      role_name: membership?.role_name ?? '',
      status: membership?.status ?? 'active',
      start_date: membership?.start_date ?? '',
      end_date: membership?.end_date ?? '',
      notes: membership?.notes ?? ''
    }
  });
  const mutationError = createMutation.error ?? updateMutation.error;
  const isPending = createMutation.isPending || updateMutation.isPending;
  const entityLabel = kind === 'committee' ? 'committee' : 'cooperative';

  return (
    <FormDialog
      description={`Record a member's participation in this ${entityLabel}.`}
      onClose={onClose}
      open
      title={membership ? `Edit ${entityLabel} membership` : `Add ${entityLabel} member`}
    >
      <form
        className="record-form"
        onSubmit={handleSubmit(async (values) => {
          const common = {
            member: membership?.member ?? Number(values.member),
            role_name: values.role_name.trim(),
            status: values.status,
            start_date: values.start_date || null,
            end_date: values.end_date || null,
            notes: values.notes.trim()
          };
          const payload = kind === 'committee'
            ? { ...common, committee: parentId } as CommitteeMembershipInput
            : { ...common, cooperative: parentId } as CooperativeMembershipInput;
          try {
            if (kind === 'committee') {
              const committeePayload = payload as CommitteeMembershipInput;
              if (membership) {
                await updateCommittee.mutateAsync({
                  id: membership.id,
                  payload: committeePayload,
                  syncVersion: membership.sync_version
                });
              } else {
                await createCommittee.mutateAsync(committeePayload);
              }
            } else if (membership) {
              await updateCooperative.mutateAsync({
                id: membership.id,
                payload: payload as CooperativeMembershipInput,
                syncVersion: membership.sync_version
              });
            } else {
              await createCooperative.mutateAsync(payload as CooperativeMembershipInput);
            }
            onClose();
          } catch {
            // Mutation feedback renders in the dialog.
          }
        })}
      >
        <FormErrorSummary error={mutationError} />
        <div className="form-grid">
          <div className="form-field form-field--wide">
            <label htmlFor="participation-member">Member</label>
            {membership ? (
              <>
                <input type="hidden" {...register('member')} />
                <input id="participation-member" readOnly value={membership.member_name || `Member #${membership.member}`} />
              </>
            ) : (
              <>
                <input
                  aria-label="Search members"
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Search by name or member number"
                  value={memberSearch}
                />
                <select id="participation-member" {...register('member', { required: 'Choose a member.' })}>
                  <option value="">Choose member</option>
                  {(membersQuery.data?.results ?? []).map((member) => (
                    <option key={member.id} value={member.id}>
                      {[member.preferred_name || member.first_name, member.last_name].filter(Boolean).join(' ')}
                      {member.member_number ? ` · ${member.member_number}` : ''}
                    </option>
                  ))}
                </select>
                {(membersQuery.data?.count ?? 0) > (membersQuery.data?.results.length ?? 0) ? (
                  <small>Refine the search to find members outside the first 200 results.</small>
                ) : null}
              </>
            )}
            {errors.member ? <small>{errors.member.message}</small> : null}
          </div>
          <label className="form-field">
            <span>Role</span>
            <input {...register('role_name')} />
          </label>
          <label className="form-field">
            <span>Status</span>
            <select {...register('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="ended">Ended</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="form-field">
            <span>Start date</span>
            <input type="date" {...register('start_date')} />
          </label>
          <label className="form-field">
            <span>End date</span>
            <input type="date" {...register('end_date')} />
          </label>
          <label className="form-field form-field--wide">
            <span>Notes</span>
            <textarea rows={3} {...register('notes')} />
          </label>
        </div>
        <footer className="record-form__actions">
          <button className="button button--secondary" onClick={onClose} type="button">Cancel</button>
          <button className="button button--primary" disabled={isPending} type="submit">
            {isPending ? 'Saving…' : 'Save membership'}
          </button>
        </footer>
      </form>
    </FormDialog>
  );
}
