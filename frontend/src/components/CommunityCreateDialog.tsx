import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import {
  useCreateCommunityMutation,
  useUpdateCommunityMutation
} from '../api/queries';
import {
  isOfflineQueuedResult,
  type Community,
  type CommunityCreateInput
} from '../api/types';
import { useOptionalAuth } from '../auth/AuthContext';
import { clearOfflineDraft, useOfflineDraft } from '../offline/drafts';
import { FormDialog, FormErrorSummary } from './FormDialog';

type CommunityCreateDialogProps = {
  community?: Community;
  onClose: () => void;
  onSaved?: (community: Community) => void;
};

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' }
];

export function CommunityCreateDialog({
  community,
  onClose,
  onSaved
}: CommunityCreateDialogProps) {
  const navigate = useNavigate();
  const userId = useOptionalAuth()?.user?.id;
  const createCommunity = useCreateCommunityMutation();
  const updateCommunity = useUpdateCommunityMutation();
  const isEditing = Boolean(community);
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    watch
  } = useForm<CommunityCreateInput>({
    defaultValues: {
      area_name: community?.area_name ?? '',
      country: community?.country ?? 'Uganda',
      district_name: community?.district_name ?? '',
      name: community?.name ?? '',
      notes: community?.notes ?? '',
      region_name: community?.region_name ?? '',
      status: community?.status ?? 'active'
    }
  });
  const mutationError = createCommunity.error ?? updateCommunity.error;
  const isPending = createCommunity.isPending || updateCommunity.isPending;
  useOfflineDraft({
    entityId: community?.id,
    entityType: 'community',
    reset,
    userId,
    watch
  });

  return (
    <FormDialog
      open
      title={isEditing ? 'Edit community' : 'Create community'}
      description={
        isEditing
          ? 'Update this community’s identifying details.'
          : 'Start the community record with its identifying details.'
      }
      onClose={onClose}
    >
      <form
        className="record-form"
        onSubmit={handleSubmit(async (values) => {
          try {
            const payload = {
              ...values,
              name: values.name.trim()
            };
            const savedCommunity = community
              ? await updateCommunity.mutateAsync({
                  id: community.id,
                  payload,
                  syncVersion: community.sync_version
                })
              : await createCommunity.mutateAsync(payload);
            await clearOfflineDraft('community', community?.id, userId);
            if (isOfflineQueuedResult(savedCommunity)) {
              onClose();
              return;
            }
            onSaved?.(savedCommunity);
            onClose();
            if (!community) {
              navigate(`/communities/${savedCommunity.id}/groups`);
            }
          } catch {
            // The mutation error state is rendered below.
          }
        })}
      >
        <FormErrorSummary error={mutationError} />

        <div className="form-grid">
          <label className="form-field">
            <span>Community name</span>
            <input
              autoFocus
              {...register('name', {
                required: 'Enter a community name.'
              })}
            />
            {errors.name ? <small>{errors.name.message}</small> : null}
          </label>

          <label className="form-field">
            <span>Area</span>
            <input {...register('area_name')} />
          </label>

          <label className="form-field">
            <span>District</span>
            <input {...register('district_name')} />
          </label>

          <label className="form-field">
            <span>Region</span>
            <input {...register('region_name')} />
          </label>

          <label className="form-field">
            <span>Country</span>
            <input {...register('country')} />
          </label>

          <label className="form-field">
            <span>Status</span>
            <select {...register('status')}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-field">
          <span>Notes</span>
          <textarea rows={3} {...register('notes')} />
        </label>

        <footer className="record-form__actions">
          <button className="button button--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button button--primary" type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : isEditing ? 'Save community' : 'Create community'}
          </button>
        </footer>
      </form>
    </FormDialog>
  );
}
