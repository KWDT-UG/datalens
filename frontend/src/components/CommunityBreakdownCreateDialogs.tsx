import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  useCreateCommitteeMutation,
  useCreateCooperativeMutation,
  useCreateGroupMutation,
  useCreateImpactRecordMutation,
  useCreateInstitutionMutation,
  useCreateMemberMutation,
  useGroupsQuery,
  useResourcesQuery,
  useUpdateCommitteeMutation,
  useUpdateCooperativeMutation,
  useUpdateGroupMutation,
  useUpdateImpactRecordMutation,
  useUpdateInstitutionMutation,
  useUpdateMemberMutation
} from '../api/queries';
import type {
  ApprovalSubmission,
  Committee,
  CommitteeCreateInput,
  Cooperative,
  CooperativeCreateInput,
  Group,
  GroupCreateInput,
  ImpactRecord,
  ImpactRecordCreateInput,
  Institution,
  InstitutionCreateInput,
  Member,
  MemberCreateInput
} from '../api/types';
import { isApprovalSubmission, isOfflineQueuedResult } from '../api/types';
import { useOptionalAuth } from '../auth/AuthContext';
import { clearOfflineDraft, useOfflineDraft } from '../offline/drafts';
import { FormDialog, FormErrorSummary } from './FormDialog';

type CommunityScopedDialogProps = {
  communityId: number;
  onClose: () => void;
  onCreated: () => void;
};

type GroupDialogProps = CommunityScopedDialogProps & { group?: Group };
type MemberDialogProps = CommunityScopedDialogProps & { member?: Member };
type InstitutionDialogProps = CommunityScopedDialogProps & {
  institution?: Institution;
};
type ParticipationDialogProps = CommunityScopedDialogProps & {
  committee?: Committee;
  cooperative?: Cooperative;
  kind: 'committee' | 'cooperative';
};

type ImpactRecordDialogProps = {
  communityId?: number;
  impactRecord?: ImpactRecord;
  onClose: () => void;
  onCreated: () => void;
};

type StringFields<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends string ? K : never;
}[keyof T];

const recordStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' }
];

const memberStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'exited', label: 'Exited' }
];

const institutionTypeOptions = [
  { value: 'school', label: 'School' },
  { value: 'church', label: 'Church' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'community_center', label: 'Community center' },
  { value: 'cooperative_partner', label: 'Cooperative partner' },
  { value: 'other', label: 'Other' }
];

const impactMethodOptions = [
  { value: 'observed', label: 'Observed' },
  { value: 'estimated', label: 'Estimated' },
  { value: 'derived', label: 'Derived' }
];

function omitBlank(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function optionalTextFields<T extends object>(values: T, fields: Array<StringFields<T>>) {
  return fields.reduce(
    (payload, field) => ({
      ...payload,
      [field]: omitBlank(values[field] as string | undefined)
    }),
    {} as Record<string, string | undefined>
  );
}

function Actions({
  isPending,
  label,
  onClose
}: {
  isPending: boolean;
  label: string;
  onClose: () => void;
}) {
  return (
    <footer className="record-form__actions">
      <button className="button button--secondary" type="button" onClick={onClose}>
        Cancel
      </button>
      <button className="button button--primary" type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : label}
      </button>
    </footer>
  );
}

export function GroupCreateDialog({
  communityId,
  group,
  onClose,
  onCreated
}: GroupDialogProps) {
  const createGroup = useCreateGroupMutation();
  const userId = useOptionalAuth()?.user?.id;
  const updateGroup = useUpdateGroupMutation();
  const isEditing = Boolean(group);
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    watch
  } = useForm<GroupCreateInput>({
    defaultValues: {
      closed_on: group?.closed_on ?? '',
      code: group?.code ?? '',
      community: communityId,
      formed_on: group?.formed_on ?? '',
      meeting_day: group?.meeting_day ?? '',
      name: group?.name ?? '',
      notes: group?.notes ?? '',
      status: group?.status ?? 'active'
    }
  });
  const mutationError = createGroup.error ?? updateGroup.error;
  const isPending = createGroup.isPending || updateGroup.isPending;
  useOfflineDraft({
    entityId: group?.id,
    entityType: 'group',
    reset,
    userId,
    watch
  });

  return (
    <FormDialog
      open
      title={isEditing ? 'Edit group' : 'Create group'}
      description={isEditing ? 'Update this group.' : 'Add a group to this community.'}
      onClose={onClose}
    >
      <form
        className="record-form"
        onSubmit={handleSubmit(async (values) => {
          try {
            const payload = {
              ...values,
              code: values.code.trim(),
              name: values.name.trim(),
              ...optionalTextFields(values, ['closed_on', 'formed_on', 'meeting_day', 'notes'])
            };
            if (group) {
              await updateGroup.mutateAsync({
                id: group.id,
                payload,
                syncVersion: group.sync_version
              });
            } else {
              await createGroup.mutateAsync(payload);
            }
            await clearOfflineDraft('group', group?.id, userId);
            onCreated();
            onClose();
          } catch {
            // Mutation errors render below.
          }
        })}
      >
        <FormErrorSummary error={mutationError} />
        <div className="form-grid">
          <label className="form-field">
            <span>Group name</span>
            <input autoFocus {...register('name', { required: 'Enter a group name.' })} />
            {errors.name ? <small>{errors.name.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Group code</span>
            <input {...register('code', { required: 'Enter a group code.' })} />
            {errors.code ? <small>{errors.code.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Meeting day</span>
            <input {...register('meeting_day')} />
          </label>
          <label className="form-field">
            <span>Status</span>
            <select {...register('status')}>
              {recordStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Formed on</span>
            <input type="date" {...register('formed_on')} />
          </label>
          <label className="form-field">
            <span>Closed on</span>
            <input type="date" {...register('closed_on')} />
          </label>
        </div>
        <label className="form-field">
          <span>Notes</span>
          <textarea rows={3} {...register('notes')} />
        </label>
        <Actions
          isPending={isPending}
          label={isEditing ? 'Save group' : 'Create group'}
          onClose={onClose}
        />
      </form>
    </FormDialog>
  );
}

export function MemberCreateDialog({
  communityId,
  member,
  onClose,
  onCreated
}: MemberDialogProps) {
  const createMember = useCreateMemberMutation();
  const userId = useOptionalAuth()?.user?.id;
  const updateMember = useUpdateMemberMutation();
  const isEditing = Boolean(member);
  const groupsQuery = useGroupsQuery({ community: communityId, page: 1, page_size: 100, ordering: 'name' });
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch
  } = useForm<Omit<MemberCreateInput, 'group'> & { group: string }>({
    defaultValues: {
      address_text: member?.address_text ?? '',
      community: communityId,
      date_of_birth: member?.date_of_birth ?? '',
      deceased_on: member?.deceased_on ?? '',
      email: member?.email ?? '',
      first_name: member?.first_name ?? '',
      gender: member?.gender ?? '',
      group: member ? String(member.group) : '',
      joined_on: member?.joined_on ?? '',
      last_name: member?.last_name ?? '',
      left_on: member?.left_on ?? '',
      member_number: member?.member_number ?? '',
      middle_name: member?.middle_name ?? '',
      notes: member?.notes ?? '',
      phone: member?.phone ?? '',
      preferred_name: member?.preferred_name ?? '',
      status: member?.status ?? 'active'
    }
  });
  const mutationError = createMember.error ?? updateMember.error;
  const isPending = createMember.isPending || updateMember.isPending;
  useOfflineDraft({
    entityId: member?.id,
    entityType: 'member',
    reset,
    userId,
    watch
  });

  useEffect(() => {
    if (
      member &&
      (groupsQuery.data?.results ?? []).some(
        (availableGroup) => availableGroup.id === member.group
      )
    ) {
      setValue('group', String(member.group));
    }
  }, [groupsQuery.data, member, setValue]);

  return (
    <FormDialog
      open
      title={isEditing ? 'Edit member' : 'Create member'}
      description={
        isEditing
          ? 'Update this member’s details and current group.'
          : 'Add a member to one group in this community.'
      }
      onClose={onClose}
    >
      <form
        className="record-form"
        onSubmit={handleSubmit(async (values) => {
          try {
            const payload = {
              ...values,
              first_name: values.first_name.trim(),
              group: Number(values.group),
              last_name: values.last_name.trim(),
              ...optionalTextFields(values, [
                'address_text',
                'date_of_birth',
                'deceased_on',
                'email',
                'gender',
                'joined_on',
                'left_on',
                'member_number',
                'middle_name',
                'notes',
                'phone',
                'preferred_name'
              ])
            };
            if (member) {
              await updateMember.mutateAsync({
                id: member.id,
                payload,
                syncVersion: member.sync_version
              });
            } else {
              await createMember.mutateAsync(payload);
            }
            await clearOfflineDraft('member', member?.id, userId);
            onCreated();
            onClose();
          } catch {
            // Mutation errors render below.
          }
        })}
      >
        <FormErrorSummary error={mutationError} />
        <div className="form-grid">
          <label className="form-field">
            <span>First name</span>
            <input autoFocus {...register('first_name', { required: 'Enter a first name.' })} />
            {errors.first_name ? <small>{errors.first_name.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Last name</span>
            <input {...register('last_name', { required: 'Enter a last name.' })} />
            {errors.last_name ? <small>{errors.last_name.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Middle name</span>
            <input {...register('middle_name')} />
          </label>
          <label className="form-field">
            <span>Group</span>
            <select {...register('group', { required: 'Select a group.' })}>
              <option value="">{groupsQuery.isLoading ? 'Loading groups...' : 'Select group'}</option>
              {member &&
              !(groupsQuery.data?.results ?? []).some(
                (availableGroup) => availableGroup.id === member.group
              ) ? (
                <option value={member.group}>{member.group_name ?? 'Current group'}</option>
              ) : null}
              {(groupsQuery.data?.results ?? []).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            {errors.group ? <small>{errors.group.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Member number</span>
            <input {...register('member_number')} />
          </label>
          <label className="form-field">
            <span>Preferred name</span>
            <input {...register('preferred_name')} />
          </label>
          <label className="form-field">
            <span>Status</span>
            <select {...register('status')}>
              {memberStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Email</span>
            <input type="email" {...register('email')} />
          </label>
          <label className="form-field">
            <span>Phone</span>
            <input {...register('phone')} />
          </label>
          <label className="form-field">
            <span>Gender</span>
            <input {...register('gender')} />
          </label>
          <label className="form-field">
            <span>Date of birth</span>
            <input type="date" {...register('date_of_birth')} />
          </label>
          <label className="form-field">
            <span>Joined on</span>
            <input type="date" {...register('joined_on')} />
          </label>
          <label className="form-field">
            <span>Left on</span>
            <input type="date" {...register('left_on')} />
          </label>
          <label className="form-field">
            <span>Deceased on</span>
            <input type="date" {...register('deceased_on')} />
          </label>
        </div>
        <label className="form-field">
          <span>Address</span>
          <textarea rows={2} {...register('address_text')} />
        </label>
        <label className="form-field">
          <span>Notes</span>
          <textarea rows={3} {...register('notes')} />
        </label>
        <Actions
          isPending={isPending}
          label={isEditing ? 'Save member' : 'Create member'}
          onClose={onClose}
        />
      </form>
    </FormDialog>
  );
}

export function InstitutionCreateDialog({
  communityId,
  institution,
  onClose,
  onCreated
}: InstitutionDialogProps) {
  const createInstitution = useCreateInstitutionMutation();
  const userId = useOptionalAuth()?.user?.id;
  const updateInstitution = useUpdateInstitutionMutation();
  const isEditing = Boolean(institution);
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    watch
  } = useForm<InstitutionCreateInput>({
    defaultValues: {
      code: institution?.code ?? '',
      community: communityId,
      contact_name: institution?.contact_name ?? '',
      email: institution?.email ?? '',
      institution_type: institution?.institution_type ?? 'other',
      location_text: institution?.location_text ?? '',
      name: institution?.name ?? '',
      notes: institution?.notes ?? '',
      phone: institution?.phone ?? '',
      status: institution?.status ?? 'active'
    }
  });
  const mutationError = createInstitution.error ?? updateInstitution.error;
  const isPending = createInstitution.isPending || updateInstitution.isPending;
  useOfflineDraft({
    entityId: institution?.id,
    entityType: 'institution',
    reset,
    userId,
    watch
  });

  return (
    <FormDialog
      open
      title={isEditing ? 'Edit institution' : 'Create institution'}
      description={
        isEditing ? 'Update this institution.' : 'Add an institution to this community.'
      }
      onClose={onClose}
    >
      <form
        className="record-form"
        onSubmit={handleSubmit(async (values) => {
          try {
            const payload = {
              ...values,
              name: values.name.trim(),
              ...optionalTextFields(values, ['code', 'contact_name', 'email', 'location_text', 'notes', 'phone'])
            };
            if (institution) {
              await updateInstitution.mutateAsync({
                id: institution.id,
                payload,
                syncVersion: institution.sync_version
              });
            } else {
              await createInstitution.mutateAsync(payload);
            }
            await clearOfflineDraft('institution', institution?.id, userId);
            onCreated();
            onClose();
          } catch {
            // Mutation errors render below.
          }
        })}
      >
        <FormErrorSummary error={mutationError} />
        <div className="form-grid">
          <label className="form-field">
            <span>Institution name</span>
            <input autoFocus {...register('name', { required: 'Enter an institution name.' })} />
            {errors.name ? <small>{errors.name.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Type</span>
            <select {...register('institution_type')}>
              {institutionTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Code</span>
            <input {...register('code')} />
          </label>
          <label className="form-field">
            <span>Contact</span>
            <input {...register('contact_name')} />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input type="email" {...register('email')} />
          </label>
          <label className="form-field">
            <span>Phone</span>
            <input {...register('phone')} />
          </label>
        </div>
        <label className="form-field">
          <span>Location</span>
          <textarea rows={2} {...register('location_text')} />
        </label>
        <label className="form-field">
          <span>Notes</span>
          <textarea rows={2} {...register('notes')} />
        </label>
        <Actions
          isPending={isPending}
          label={isEditing ? 'Save institution' : 'Create institution'}
          onClose={onClose}
        />
      </form>
    </FormDialog>
  );
}

function ParticipationCreateDialog({
  committee,
  cooperative,
  kind,
  communityId,
  onClose,
  onCreated
}: ParticipationDialogProps) {
  const createCommittee = useCreateCommitteeMutation();
  const userId = useOptionalAuth()?.user?.id;
  const createCooperative = useCreateCooperativeMutation();
  const updateCommittee = useUpdateCommitteeMutation();
  const updateCooperative = useUpdateCooperativeMutation();
  const createRecord = kind === 'committee' ? createCommittee : createCooperative;
  const record = kind === 'committee' ? committee : cooperative;
  const isEditing = Boolean(record);
  const typeField = kind === 'committee' ? 'committee_type' : 'cooperative_type';
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    watch
  } = useForm<CommitteeCreateInput & CooperativeCreateInput>({
    defaultValues: {
      closed_on: record?.closed_on ?? '',
      community: communityId,
      description: record?.description ?? '',
      formed_on: record?.formed_on ?? '',
      name: record?.name ?? '',
      status: record?.status ?? 'active',
      [typeField]:
        kind === 'committee'
          ? committee?.committee_type ?? ''
          : cooperative?.cooperative_type ?? ''
    }
  });
  const title = kind === 'committee' ? 'committee' : 'cooperative';
  const mutationError =
    createCommittee.error ??
    createCooperative.error ??
    updateCommittee.error ??
    updateCooperative.error;
  const isPending =
    createCommittee.isPending ||
    createCooperative.isPending ||
    updateCommittee.isPending ||
    updateCooperative.isPending;
  useOfflineDraft({
    entityId: record?.id,
    entityType: kind,
    reset,
    userId,
    watch
  });

  return (
    <FormDialog
      open
      title={`${isEditing ? 'Edit' : 'Create'} ${title}`}
      description={
        isEditing ? `Update this ${title}.` : `Add a ${title} to this community.`
      }
      onClose={onClose}
    >
      <form
        className="record-form"
        onSubmit={handleSubmit(async (values) => {
          const payload = {
            community: values.community,
            name: values.name.trim(),
            status: values.status,
            description: omitBlank(values.description),
            formed_on: omitBlank(values.formed_on),
            closed_on: omitBlank(values.closed_on),
            [typeField]: omitBlank(values[typeField])
          };

          try {
            if (kind === 'committee' && committee) {
              await updateCommittee.mutateAsync({
                id: committee.id,
                payload: payload as CommitteeCreateInput,
                syncVersion: committee.sync_version
              });
            } else if (kind === 'cooperative' && cooperative) {
              await updateCooperative.mutateAsync({
                id: cooperative.id,
                payload: payload as CooperativeCreateInput,
                syncVersion: cooperative.sync_version
              });
            } else {
              await createRecord.mutateAsync(
                payload as CommitteeCreateInput & CooperativeCreateInput
              );
            }
            await clearOfflineDraft(kind, record?.id, userId);
            onCreated();
            onClose();
          } catch {
            // Mutation errors render below.
          }
        })}
      >
        <FormErrorSummary error={mutationError} />
        <div className="form-grid">
          <label className="form-field">
            <span>Name</span>
            <input autoFocus {...register('name', { required: `Enter a ${title} name.` })} />
            {errors.name ? <small>{errors.name.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Type</span>
            <input {...register(typeField)} />
          </label>
          <label className="form-field">
            <span>Status</span>
            <select {...register('status')}>
              {recordStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Formed on</span>
            <input type="date" {...register('formed_on')} />
          </label>
          <label className="form-field">
            <span>Closed on</span>
            <input type="date" {...register('closed_on')} />
          </label>
        </div>
        <label className="form-field">
          <span>Description</span>
          <textarea rows={3} {...register('description')} />
        </label>
        <Actions
          isPending={isPending}
          label={`${isEditing ? 'Save' : 'Create'} ${title}`}
          onClose={onClose}
        />
      </form>
    </FormDialog>
  );
}

export function CommitteeCreateDialog(
  props: CommunityScopedDialogProps & { committee?: Committee }
) {
  return <ParticipationCreateDialog {...props} kind="committee" />;
}

export function CooperativeCreateDialog(
  props: CommunityScopedDialogProps & { cooperative?: Cooperative }
) {
  return <ParticipationCreateDialog {...props} kind="cooperative" />;
}

export function ImpactRecordCreateDialog({
  communityId,
  impactRecord,
  onClose,
  onCreated
}: ImpactRecordDialogProps) {
  const createImpact = useCreateImpactRecordMutation();
  const userId = useOptionalAuth()?.user?.id;
  const updateImpact = useUpdateImpactRecordMutation();
  const [approvalSubmission, setApprovalSubmission] =
    useState<ApprovalSubmission | null>(null);
  const isEditing = Boolean(impactRecord);
  const resourcesQuery = useResourcesQuery({
    community: communityId,
    page: 1,
    page_size: 100,
    ordering: 'name'
  });
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch
  } = useForm<Omit<ImpactRecordCreateInput, 'resource'> & { resource: string }>({
    defaultValues: {
      as_of_date: impactRecord?.as_of_date ?? '',
      beneficiary_count: impactRecord?.beneficiary_count ?? 0,
      household_count: impactRecord?.household_count ?? 0,
      institution_count: impactRecord?.institution_count ?? 0,
      member_count: impactRecord?.member_count ?? 0,
      method: impactRecord?.method ?? 'observed',
      notes: impactRecord?.notes ?? '',
      period_end: impactRecord?.period_end ?? '',
      period_start: impactRecord?.period_start ?? '',
      period_type: impactRecord?.period_type ?? '',
      resource: impactRecord ? String(impactRecord.resource) : ''
    }
  });
  const mutationError = createImpact.error ?? updateImpact.error;
  const isPending = createImpact.isPending || updateImpact.isPending;
  useOfflineDraft({
    entityId: impactRecord?.id,
    entityType: 'impact_record',
    reset,
    userId,
    watch
  });

  useEffect(() => {
    if (
      impactRecord &&
      (resourcesQuery.data?.results ?? []).some(
        (availableResource) => availableResource.id === impactRecord.resource
      )
    ) {
      setValue('resource', String(impactRecord.resource));
    }
  }, [impactRecord, resourcesQuery.data, setValue]);

  return (
    <FormDialog
      open
      title={isEditing ? 'Edit impact record' : 'Create impact record'}
      description="Record impact for a community resource."
      onClose={onClose}
    >
      <form
        className="record-form"
        onSubmit={handleSubmit(async (values) => {
          const payload: ImpactRecordCreateInput = {
            ...values,
            as_of_date: omitBlank(values.as_of_date),
            notes: omitBlank(values.notes),
            period_end: omitBlank(values.period_end),
            period_start: omitBlank(values.period_start),
            period_type: omitBlank(values.period_type),
            resource: Number(values.resource)
          };

          try {
            const result = impactRecord
              ? await updateImpact.mutateAsync({
                  id: impactRecord.id,
                  payload,
                  syncVersion: impactRecord.sync_version
                })
              : await createImpact.mutateAsync(payload);
            await clearOfflineDraft('impact_record', impactRecord?.id, userId);
            if (isOfflineQueuedResult(result)) {
              onCreated();
              onClose();
              return;
            }
            if (isApprovalSubmission(result)) {
              setApprovalSubmission(result);
            } else {
              onCreated();
              onClose();
            }
          } catch {
            // Mutation errors render below.
          }
        })}
      >
        <FormErrorSummary error={mutationError} />
        {approvalSubmission ? (
          <div className="form-alert" role="status">
            <strong>Submitted for approval</strong>
            <span>
              Request #{approvalSubmission.approval_request.id} is awaiting impact review.
            </span>
          </div>
        ) : null}
        <div className="form-grid">
          <label className="form-field">
            <span>Resource</span>
            <select autoFocus {...register('resource', { required: 'Select a resource.' })}>
              <option value="">{resourcesQuery.isLoading ? 'Loading resources...' : 'Select resource'}</option>
              {impactRecord &&
              !(resourcesQuery.data?.results ?? []).some((resource) => resource.id === impactRecord.resource) ? (
                <option value={impactRecord.resource}>
                  {impactRecord.resource_name ?? 'Current resource'}
                </option>
              ) : null}
              {(resourcesQuery.data?.results ?? []).map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name}
                </option>
              ))}
            </select>
            {errors.resource ? <small>{errors.resource.message}</small> : null}
          </label>
          <label className="form-field">
            <span>As of date</span>
            <input type="date" {...register('as_of_date')} />
          </label>
          <label className="form-field">
            <span>Period type</span>
            <input {...register('period_type')} />
          </label>
          <label className="form-field">
            <span>Method</span>
            <select {...register('method')}>
              {impactMethodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Period start</span>
            <input type="date" {...register('period_start')} />
          </label>
          <label className="form-field">
            <span>Period end</span>
            <input type="date" {...register('period_end')} />
          </label>
          <label className="form-field">
            <span>Beneficiaries</span>
            <input type="number" min={0} {...register('beneficiary_count', { valueAsNumber: true })} />
          </label>
          <label className="form-field">
            <span>Households</span>
            <input type="number" min={0} {...register('household_count', { valueAsNumber: true })} />
          </label>
          <label className="form-field">
            <span>Members</span>
            <input type="number" min={0} {...register('member_count', { valueAsNumber: true })} />
          </label>
          <label className="form-field">
            <span>Institutions</span>
            <input type="number" min={0} {...register('institution_count', { valueAsNumber: true })} />
          </label>
        </div>
        <label className="form-field">
          <span>Notes</span>
          <textarea rows={3} {...register('notes')} />
        </label>
        <Actions
          isPending={isPending || Boolean(approvalSubmission)}
          label={
            approvalSubmission
              ? 'Awaiting approval'
              : isEditing
                ? 'Save impact record'
                : 'Create impact record'
          }
          onClose={onClose}
        />
      </form>
    </FormDialog>
  );
}
