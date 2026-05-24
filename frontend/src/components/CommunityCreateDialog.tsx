import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { useCreateCommunityMutation } from '../api/queries';
import type { CommunityCreateInput } from '../api/types';
import { FormDialog, FormErrorSummary } from './FormDialog';

type CommunityCreateDialogProps = {
  onClose: () => void;
};

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' }
];

export function CommunityCreateDialog({ onClose }: CommunityCreateDialogProps) {
  const navigate = useNavigate();
  const createCommunity = useCreateCommunityMutation();
  const {
    formState: { errors },
    handleSubmit,
    register
  } = useForm<CommunityCreateInput>({
    defaultValues: {
      country: 'Uganda',
      status: 'active'
    }
  });

  return (
    <FormDialog
      open
      title="Create community"
      description="Start the community record with its identifying details."
      onClose={onClose}
    >
      <form
        className="record-form"
        onSubmit={handleSubmit(async (values) => {
          try {
            const community = await createCommunity.mutateAsync({
              ...values,
              name: values.name.trim()
            });
            onClose();
            navigate(`/communities/${community.id}/groups`);
          } catch {
            // The mutation error state is rendered below.
          }
        })}
      >
        <FormErrorSummary error={createCommunity.error} />

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
          <button className="button button--primary" type="submit" disabled={createCommunity.isPending}>
            {createCommunity.isPending ? 'Saving...' : 'Create community'}
          </button>
        </footer>
      </form>
    </FormDialog>
  );
}
