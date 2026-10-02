import { useMemo } from 'react';
import { useForm } from 'react-hook-form';

import {
  useCreateGroupActivityMutation,
  useUpdateGroupActivityMutation
} from '../api/queries';
import type {
  Committee,
  Group,
  GroupActivity,
  GroupActivityCreateInput
} from '../api/types';
import { FormDialog, FormErrorSummary } from './FormDialog';

type ActivityFormValues = Omit<
  GroupActivityCreateInput,
  | 'committee'
  | 'expected_participant_count'
  | 'women_attendance_count'
  | 'men_attendance_count'
> & {
  committee: number | '';
  expected_participant_count: number | '';
  women_attendance_count: number | '';
  men_attendance_count: number | '';
};

function localDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function nextOccurrence(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  date.setMonth(date.getMonth() + 1);
  return localDateTime(date.toISOString());
}

function optionalNumber(value: number | '') {
  return value === '' || Number.isNaN(Number(value)) ? null : Number(value);
}

export function GroupActivityDialog({
  activity,
  committees,
  group,
  onClose,
  template
}: {
  activity?: GroupActivity;
  committees: Committee[];
  group: Group;
  onClose: () => void;
  template?: GroupActivity;
}) {
  const source = activity ?? template;
  const createActivity = useCreateGroupActivityMutation();
  const updateActivity = useUpdateGroupActivityMutation();
  const isEditing = Boolean(activity);
  const defaultValues = useMemo<ActivityFormValues>(() => ({
    activity_type: source?.activity_type ?? 'meeting',
    agenda: source?.agenda ?? '',
    committee: source?.activity_type === 'meeting' ? source.committee ?? '' : '',
    community: group.community,
    decisions_actions: isEditing ? source?.decisions_actions ?? '' : '',
    ends_at: template ? '' : localDateTime(source?.ends_at),
    expected_participant_count: source?.expected_participant_count ?? '',
    facilitator_name: source?.facilitator_name ?? '',
    group: group.id,
    location_text: source?.location_text ?? '',
    men_attendance_count: isEditing ? source?.men_attendance_count ?? '' : '',
    minutes: isEditing ? source?.minutes ?? '' : '',
    notes: source?.notes ?? '',
    objectives: source?.objectives ?? '',
    report_notes: isEditing ? source?.report_notes ?? '' : '',
    starts_at: template ? nextOccurrence(source?.starts_at) : localDateTime(source?.starts_at),
    status: isEditing ? source?.status ?? 'planned' : 'planned',
    title: source?.title ?? '',
    training_topic: source?.training_topic ?? '',
    women_attendance_count: isEditing ? source?.women_attendance_count ?? '' : ''
  }), [group, isEditing, source, template]);
  const {
    formState: { errors },
    handleSubmit,
    register,
    watch
  } = useForm<ActivityFormValues>({ defaultValues });
  const activityType = watch('activity_type');
  const mutationError = createActivity.error ?? updateActivity.error;
  const isPending = createActivity.isPending || updateActivity.isPending;

  return (
    <FormDialog
      open
      title={isEditing ? 'Edit activity' : template ? 'Schedule next activity' : 'Add activity'}
      description="Schedule a meeting or training, then update the same record with attendance and notes."
      onClose={onClose}
    >
      <form
        className="record-form"
        onSubmit={handleSubmit(async (values) => {
          const payload: GroupActivityCreateInput = {
            ...values,
            agenda: values.activity_type === 'meeting' ? values.agenda : '',
            committee: values.activity_type === 'meeting' && values.committee
              ? Number(values.committee)
              : null,
            decisions_actions: values.activity_type === 'meeting'
              ? values.decisions_actions
              : '',
            ends_at: values.ends_at ? new Date(values.ends_at).toISOString() : null,
            expected_participant_count: optionalNumber(values.expected_participant_count),
            men_attendance_count: optionalNumber(values.men_attendance_count),
            minutes: values.activity_type === 'meeting' ? values.minutes : '',
            objectives: values.activity_type === 'training' ? values.objectives : '',
            report_notes: values.activity_type === 'training' ? values.report_notes : '',
            starts_at: new Date(values.starts_at).toISOString(),
            title: values.title.trim(),
            training_topic: values.activity_type === 'training' ? values.training_topic : '',
            women_attendance_count: optionalNumber(values.women_attendance_count)
          };
          try {
            if (activity) {
              await updateActivity.mutateAsync({
                id: activity.id,
                payload,
                syncVersion: activity.sync_version
              });
            } else {
              await createActivity.mutateAsync(payload);
            }
            onClose();
          } catch {
            // Mutation feedback renders in the dialog.
          }
        })}
      >
        <FormErrorSummary error={mutationError} />
        <div className="form-grid">
          <label className="form-field">
            <span>Activity type</span>
            <select {...register('activity_type')}>
              <option value="meeting">Meeting</option>
              <option value="training">Training</option>
            </select>
          </label>
          <label className="form-field">
            <span>Status</span>
            <select {...register('status')}>
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="form-field form-field--wide">
            <span>Title</span>
            <input autoFocus {...register('title', { required: 'Enter an activity title.' })} />
            {errors.title ? <small>{errors.title.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Starts</span>
            <input
              type="datetime-local"
              {...register('starts_at', { required: 'Choose a start date and time.' })}
            />
            {errors.starts_at ? <small>{errors.starts_at.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Ends</span>
            <input type="datetime-local" {...register('ends_at')} />
          </label>
          <label className="form-field">
            <span>Location</span>
            <input {...register('location_text')} />
          </label>
          <label className="form-field">
            <span>Facilitator</span>
            <input {...register('facilitator_name')} />
          </label>
          {activityType === 'meeting' ? (
            <label className="form-field">
              <span>Committee (optional)</span>
              <select {...register('committee')}>
                <option value="">No committee</option>
                {committees.map((committee) => (
                  <option key={committee.id} value={committee.id}>{committee.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="form-field">
              <span>Training topic</span>
              <input {...register('training_topic')} />
            </label>
          )}
          <label className="form-field">
            <span>Expected participants</span>
            <input min="0" type="number" {...register('expected_participant_count')} />
          </label>
          <label className="form-field form-field--wide">
            <span>{activityType === 'meeting' ? 'Agenda' : 'Objectives'}</span>
            <textarea
              rows={3}
              {...register(activityType === 'meeting' ? 'agenda' : 'objectives')}
            />
          </label>
          <label className="form-field">
            <span>Women attended</span>
            <input min="0" type="number" {...register('women_attendance_count')} />
          </label>
          <label className="form-field">
            <span>Men attended</span>
            <input min="0" type="number" {...register('men_attendance_count')} />
          </label>
          <label className="form-field form-field--wide">
            <span>{activityType === 'meeting' ? 'Minutes' : 'Report notes'}</span>
            <textarea
              rows={4}
              {...register(activityType === 'meeting' ? 'minutes' : 'report_notes')}
            />
          </label>
          {activityType === 'meeting' ? (
            <label className="form-field form-field--wide">
              <span>Decisions and actions</span>
              <textarea rows={3} {...register('decisions_actions')} />
            </label>
          ) : null}
          <label className="form-field form-field--wide">
            <span>Internal notes</span>
            <textarea rows={3} {...register('notes')} />
          </label>
        </div>
        <footer className="record-form__actions">
          <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="button button--primary" type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Save activity'}
          </button>
        </footer>
      </form>
    </FormDialog>
  );
}
