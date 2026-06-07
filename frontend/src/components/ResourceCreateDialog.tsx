import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  useCommunitiesQuery,
  useCooperativesQuery,
  useCreateResourceMutation,
  useGroupsQuery,
  useInstitutionsQuery,
  useMembersQuery,
  useUpdateResourceMutation
} from '../api/queries';
import { useOptionalAuth } from '../auth/AuthContext';
import { capabilities, hasCapability } from '../auth/permissions';
import {
  isApprovalSubmission,
  type ApprovalSubmission,
  type Community,
  type Cooperative,
  type Group,
  type Institution,
  type Member,
  type Resource,
  type ResourceCreateInput
} from '../api/types';
import { FormDialog, FormErrorSummary } from './FormDialog';

type ResourceCreateDialogProps = {
  communityId?: number;
  onClose: () => void;
  onCreated: (resource: Resource) => void;
  resource?: Resource;
};

type ResourceFormValues = {
  acquired_on: string;
  community: string;
  description: string;
  location_text: string;
  name: string;
  owner_id: string;
  owner_type: 'community' | 'group' | 'cooperative' | 'member' | 'institution';
  quantity: string;
  resource_type: string;
  serial_or_tag_number: string;
  source_notes: string;
  status: string;
  unit: string;
  value_amount: string;
  value_currency: string;
};

type OwnerOption = {
  id: number;
  label: string;
};

const ownerTypeOptions = [
  { value: 'community', label: 'Community' },
  { value: 'group', label: 'Group' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'member', label: 'Member' },
  { value: 'institution', label: 'Institution' }
] as const;

const resourceTypeOptions = [
  { value: 'livestock', label: 'Livestock' },
  { value: 'tool', label: 'Tool' },
  { value: 'machinery', label: 'Machinery' },
  { value: 'land_plot', label: 'Land plot' },
  { value: 'grant', label: 'Grant' },
  { value: 'cash_asset', label: 'Cash asset' },
  { value: 'building_material', label: 'Building material' },
  { value: 'other', label: 'Other' }
];

const resourceStatusOptions = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'disposed', label: 'Disposed' }
];

function omitBlank(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function ownerTypeValue(value?: string): ResourceFormValues['owner_type'] {
  return ownerTypeOptions.some((option) => option.value === value)
    ? (value as ResourceFormValues['owner_type'])
    : 'community';
}

function defaultValuesFor(resource?: Resource, communityId?: number): ResourceFormValues {
  const community = resource?.community ?? communityId;

  return {
    acquired_on: resource?.acquired_on ?? '',
    community: community ? String(community) : '',
    description: resource?.description ?? '',
    location_text: resource?.location_text ?? '',
    name: resource?.name ?? '',
    owner_id: resource?.owner_type === 'community' ? '' : String(resource?.owner_id ?? ''),
    owner_type: ownerTypeValue(resource?.owner_type),
    quantity: resource?.quantity ?? '',
    resource_type: resource?.resource_type ?? 'other',
    serial_or_tag_number: resource?.serial_or_tag_number ?? '',
    source_notes: resource?.source_notes ?? '',
    status: resource?.status ?? 'planned',
    unit: resource?.unit ?? '',
    value_amount: resource?.value_amount ?? '',
    value_currency: resource?.value_currency ?? 'UGX'
  };
}

function memberLabel(member: Member) {
  return [member.preferred_name || member.first_name, member.last_name].filter(Boolean).join(' ');
}

function ownerOptionsFor(
  ownerType: ResourceFormValues['owner_type'],
  records: {
    cooperatives: Cooperative[];
    groups: Group[];
    institutions: Institution[];
    members: Member[];
  }
): OwnerOption[] {
  if (ownerType === 'group') {
    return records.groups.map((group) => ({ id: group.id, label: group.name }));
  }
  if (ownerType === 'cooperative') {
    return records.cooperatives.map((cooperative) => ({ id: cooperative.id, label: cooperative.name }));
  }
  if (ownerType === 'member') {
    return records.members.map((member) => ({ id: member.id, label: memberLabel(member) }));
  }
  if (ownerType === 'institution') {
    return records.institutions.map((institution) => ({ id: institution.id, label: institution.name }));
  }
  return [];
}

export function ResourceCreateDialog({ communityId, onClose, onCreated, resource }: ResourceCreateDialogProps) {
  const auth = useOptionalAuth();
  const canManageFinancials = auth
    ? hasCapability(auth.user, capabilities.manageResourceFinancials)
    : true;
  const createResource = useCreateResourceMutation();
  const updateResource = useUpdateResourceMutation();
  const [approvalSubmission, setApprovalSubmission] =
    useState<ApprovalSubmission | null>(null);
  const hasMounted = useRef(false);
  const isEditing = Boolean(resource);
  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch
  } = useForm<ResourceFormValues>({
    defaultValues: defaultValuesFor(resource, communityId)
  });
  const selectedCommunity = watch('community');
  const selectedOwnerType = watch('owner_type');
  const listParams = {
    community: selectedCommunity || undefined,
    page: 1,
    page_size: 100
  };
  const communitiesQuery = useCommunitiesQuery({ page: 1, page_size: 100, ordering: 'name' });
  const groupsQuery = useGroupsQuery(
    { ...listParams, ordering: 'name' },
    Boolean(selectedCommunity && selectedOwnerType === 'group')
  );
  const cooperativesQuery = useCooperativesQuery(
    { ...listParams, ordering: 'name' },
    Boolean(selectedCommunity && selectedOwnerType === 'cooperative')
  );
  const membersQuery = useMembersQuery(
    { ...listParams, ordering: 'last_name' },
    Boolean(selectedCommunity && selectedOwnerType === 'member')
  );
  const institutionsQuery = useInstitutionsQuery(
    { ...listParams, ordering: 'name' },
    Boolean(selectedCommunity && selectedOwnerType === 'institution')
  );

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    setValue('owner_id', '');
  }, [selectedCommunity, selectedOwnerType, setValue]);

  const ownerOptions = ownerOptionsFor(selectedOwnerType, {
    cooperatives: cooperativesQuery.data?.results ?? [],
    groups: groupsQuery.data?.results ?? [],
    institutions: institutionsQuery.data?.results ?? [],
    members: membersQuery.data?.results ?? []
  });
  const ownerQuery = {
    cooperative: cooperativesQuery,
    group: groupsQuery,
    institution: institutionsQuery,
    member: membersQuery
  }[selectedOwnerType as Exclude<ResourceFormValues['owner_type'], 'community'>];
  const ownerSelectDisabled = !selectedCommunity || Boolean(ownerQuery?.isLoading);
  const mutationError = createResource.error ?? updateResource.error;
  const isPending = createResource.isPending || updateResource.isPending;

  return (
    <FormDialog
      open
      title={isEditing ? 'Edit resource' : 'Create resource'}
      description="Save a resource under a community and select its current owner."
      onClose={onClose}
    >
      <form
        className="record-form"
        onSubmit={handleSubmit(async (values) => {
          const communityId = Number(values.community);
          const payload: ResourceCreateInput = {
            acquired_on: omitBlank(values.acquired_on),
            community: communityId,
            description: omitBlank(values.description),
            location_text: omitBlank(values.location_text),
            name: values.name.trim(),
            owner_id: values.owner_type === 'community' ? communityId : Number(values.owner_id),
            owner_type: values.owner_type,
            quantity: omitBlank(values.quantity),
            resource_type: values.resource_type,
            serial_or_tag_number: omitBlank(values.serial_or_tag_number),
            source_notes: omitBlank(values.source_notes),
            status: values.status,
            unit: omitBlank(values.unit),
            ...(canManageFinancials
              ? {
                  value_amount: omitBlank(values.value_amount),
                  value_currency: omitBlank(values.value_currency)
                }
              : {})
          };

          try {
            const savedResource = resource
              ? await updateResource.mutateAsync({ id: resource.id, payload })
              : await createResource.mutateAsync(payload);
            if (isApprovalSubmission(savedResource)) {
              setApprovalSubmission(savedResource);
            } else {
              onCreated(savedResource);
              onClose();
            }
          } catch {
            // The mutation error state is rendered below.
          }
        })}
      >
        <FormErrorSummary error={mutationError} />
        {approvalSubmission ? (
          <div className="form-alert" role="status">
            <strong>Submitted for approval</strong>
            <span>
              Request #{approvalSubmission.approval_request.id} requires{' '}
              {approvalSubmission.approval_request.review_scope.replace(/_/g, ' ')} review.
            </span>
          </div>
        ) : null}

        <div className="form-grid">
          <label className="form-field">
            <span>Community</span>
            {communityId ? (
              <div className="form-field--readout">
                <input type="hidden" {...register('community')} />
                <strong>
                  {(communitiesQuery.data?.results ?? []).find((community: Community) => community.id === communityId)
                    ?.name ?? 'Current community'}
                </strong>
              </div>
            ) : (
              <select
                autoFocus
                {...register('community', {
                  required: 'Select a community.'
                })}
              >
                <option value="">Select community</option>
                {(communitiesQuery.data?.results ?? []).map((community: Community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            )}
            {errors.community ? <small>{errors.community.message}</small> : null}
          </label>

          <label className="form-field">
            <span>Resource name</span>
            <input
              autoFocus={Boolean(communityId)}
              {...register('name', {
                required: 'Enter a resource name.'
              })}
            />
            {errors.name ? <small>{errors.name.message}</small> : null}
          </label>

          <label className="form-field">
            <span>Resource type</span>
            <select {...register('resource_type')}>
              {resourceTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Status</span>
            <select {...register('status')}>
              {resourceStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Owner type</span>
            <select {...register('owner_type')}>
              {ownerTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {selectedOwnerType === 'community' ? (
            <div className="form-field form-field--readout">
              <span>Owner</span>
              <strong>{selectedCommunity ? 'Selected community' : 'Select a community first'}</strong>
            </div>
          ) : (
            <label className="form-field">
              <span>Owner</span>
              <select
                disabled={ownerSelectDisabled}
                {...register('owner_id', {
                  required: 'Select an owner.'
                })}
              >
                <option value="">
                  {ownerQuery?.isLoading ? 'Loading owners...' : `Select ${selectedOwnerType}`}
                </option>
                {ownerOptions.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.label}
                  </option>
                ))}
              </select>
              {errors.owner_id ? <small>{errors.owner_id.message}</small> : null}
            </label>
          )}

          <label className="form-field">
            <span>Quantity</span>
            <input inputMode="decimal" {...register('quantity')} />
          </label>

          <label className="form-field">
            <span>Unit</span>
            <input {...register('unit')} />
          </label>

          {canManageFinancials ? (
            <>
              <label className="form-field">
                <span>Value amount</span>
                <input inputMode="decimal" {...register('value_amount')} />
              </label>

              <label className="form-field">
                <span>Currency</span>
                <input maxLength={3} {...register('value_currency')} />
              </label>
            </>
          ) : null}

          <label className="form-field">
            <span>Acquired on</span>
            <input type="date" {...register('acquired_on')} />
          </label>

          <label className="form-field">
            <span>Tag or serial number</span>
            <input {...register('serial_or_tag_number')} />
          </label>
        </div>

        <label className="form-field">
          <span>Description</span>
          <textarea rows={2} {...register('description')} />
        </label>

        <label className="form-field">
          <span>Location</span>
          <textarea rows={2} {...register('location_text')} />
        </label>

        <label className="form-field">
          <span>Source notes</span>
          <textarea rows={2} {...register('source_notes')} />
        </label>

        <footer className="record-form__actions">
          <button className="button button--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={isPending || Boolean(approvalSubmission)}
          >
            {isPending
              ? 'Saving...'
              : approvalSubmission
                ? 'Awaiting approval'
                : isEditing
                  ? 'Save resource'
                  : 'Create resource'}
          </button>
        </footer>
      </form>
    </FormDialog>
  );
}
