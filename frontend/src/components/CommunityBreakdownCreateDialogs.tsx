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
  useUpdateImpactRecordMutation
} from '../api/queries';
import type {
  CommitteeCreateInput,
  CooperativeCreateInput,
  GroupCreateInput,
  ImpactRecord,
  ImpactRecordCreateInput,
  InstitutionCreateInput,
  MemberCreateInput
} from '../api/types';
import { FormDialog, FormErrorSummary } from './FormDialog';

type CommunityScopedDialogProps = {
  communityId: number;
  onClose: () => void;
  onCreated: () => void;
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

export function GroupCreateDialog({ communityId, onClose, onCreated }: CommunityScopedDialogProps) {
  const createGroup = useCreateGroupMutation();
  const {
    formState: { errors },
    handleSubmit,
    register
  } = useForm<GroupCreateInput>({
    defaultValues: { community: communityId, status: 'active' }
  });

  return (
    <FormDialog open title="Create group" description="Add a group to this community." onClose={onClose}>
      <form
        className="record-form"
        onSubmit={handleSubmit(async (values) => {
          try {
            await createGroup.mutateAsync({
              ...values,
              code: values.code.trim(),
              name: values.name.trim(),
              ...optionalTextFields(values, ['closed_on', 'formed_on', 'meeting_day', 'notes'])
            });
            onCreated();
            onClose();
          } catch {
            // Mutation errors render below.
          }
        })}
      >
        <FormErrorSummary error={createGroup.error} />
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
        <Actions isPending={createGroup.isPending} label="Create group" onClose={onClose} />
      </form>
    </FormDialog>
  );
}

export function MemberCreateDialog({ communityId, onClose, onCreated }: CommunityScopedDialogProps) {
  const createMember = useCreateMemberMutation();
  const groupsQuery = useGroupsQuery({ community: communityId, page: 1, page_size: 100, ordering: 'name' });
  const {
    formState: { errors },
    handleSubmit,
    register
  } = useForm<Omit<MemberCreateInput, 'group'> & { group: string }>({
    defaultValues: { community: communityId, group: '', status: 'active' }
  });

  return (
    <FormDialog open title="Create member" description="Add a member to one group in this community." onClose={onClose}>
      <form
        className="record-form"
        onSubmit={handleSubmit(async (values) => {
          try {
            await createMember.mutateAsync({
              ...values,
              first_name: values.first_name.trim(),
              group: Number(values.group),
              last_name: values.last_name.trim(),
              ...optionalTextFields(values, [
                'address_text',
                'date_of_birth',
                'email',
                'gender',
                'joined_on',
                'member_number',
                'middle_name',
                'notes',
                'phone',
                'preferred_name'
              ])
            });
            onCreated();
            onClose();
          } catch {
            // Mutation errors render below.
          }
        })}
      >
        <FormErrorSummary error={createMember.error} />
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
            <span>Group</span>
            <select {...register('group', { required: 'Select a group.' })}>
              <option value="">{groupsQuery.isLoading ? 'Loading groups...' : 'Select group'}</option>
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
            <span>Joined on</span>
            <input type="date" {...register('joined_on')} />
          </label>
        </div>
        <label className="form-field">
          <span>Notes</span>
          <textarea rows={3} {...register('notes')} />
        </label>
        <Actions isPending={createMember.isPending} label="Create member" onClose={onClose} />
      </form>
    </FormDialog>
  );
}

export function InstitutionCreateDialog({ communityId, onClose, onCreated }: CommunityScopedDialogProps) {
  const createInstitution = useCreateInstitutionMutation();
  const {
    formState: { errors },
    handleSubmit,
    register
  } = useForm<InstitutionCreateInput>({
    defaultValues: { community: communityId, institution_type: 'other', status: 'active' }
  });

  return (
    <FormDialog open title="Create institution" description="Add an institution to this community." onClose={onClose}>
      <form
        className="record-form"
        onSubmit={handleSubmit(async (values) => {
          try {
            await createInstitution.mutateAsync({
              ...values,
              name: values.name.trim(),
              ...optionalTextFields(values, ['code', 'contact_name', 'email', 'location_text', 'notes', 'phone'])
            });
            onCreated();
            onClose();
          } catch {
            // Mutation errors render below.
          }
        })}
      >
        <FormErrorSummary error={createInstitution.error} />
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
        <Actions isPending={createInstitution.isPending} label="Create institution" onClose={onClose} />
      </form>
    </FormDialog>
  );
}

function ParticipationCreateDialog({
  kind,
  communityId,
  onClose,
  onCreated
}: CommunityScopedDialogProps & { kind: 'committee' | 'cooperative' }) {
  const createCommittee = useCreateCommitteeMutation();
  const createCooperative = useCreateCooperativeMutation();
  const createRecord = kind === 'committee' ? createCommittee : createCooperative;
  const typeField = kind === 'committee' ? 'committee_type' : 'cooperative_type';
  const {
    formState: { errors },
    handleSubmit,
    register
  } = useForm<CommitteeCreateInput & CooperativeCreateInput>({
    defaultValues: { community: communityId, status: 'active' }
  });
  const title = kind === 'committee' ? 'committee' : 'cooperative';

  return (
    <FormDialog open title={`Create ${title}`} description={`Add a ${title} to this community.`} onClose={onClose}>
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
            await createRecord.mutateAsync(payload as CommitteeCreateInput & CooperativeCreateInput);
            onCreated();
            onClose();
          } catch {
            // Mutation errors render below.
          }
        })}
      >
        <FormErrorSummary error={createRecord.error} />
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
        <Actions isPending={createRecord.isPending} label={`Create ${title}`} onClose={onClose} />
      </form>
    </FormDialog>
  );
}

export function CommitteeCreateDialog(props: CommunityScopedDialogProps) {
  return <ParticipationCreateDialog {...props} kind="committee" />;
}

export function CooperativeCreateDialog(props: CommunityScopedDialogProps) {
  return <ParticipationCreateDialog {...props} kind="cooperative" />;
}

export function ImpactRecordCreateDialog({
  communityId,
  impactRecord,
  onClose,
  onCreated
}: ImpactRecordDialogProps) {
  const createImpact = useCreateImpactRecordMutation();
  const updateImpact = useUpdateImpactRecordMutation();
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
    register
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
            if (impactRecord) {
              await updateImpact.mutateAsync({ id: impactRecord.id, payload });
            } else {
              await createImpact.mutateAsync(payload);
            }
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
            <span>Resource</span>
            <select autoFocus {...register('resource', { required: 'Select a resource.' })}>
              <option value="">{resourcesQuery.isLoading ? 'Loading resources...' : 'Select resource'}</option>
              {impactRecord &&
              !(resourcesQuery.data?.results ?? []).some((resource) => resource.id === impactRecord.resource) ? (
                <option value={impactRecord.resource}>Resource #{impactRecord.resource}</option>
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
          isPending={isPending}
          label={isEditing ? 'Save impact record' : 'Create impact record'}
          onClose={onClose}
        />
      </form>
    </FormDialog>
  );
}
