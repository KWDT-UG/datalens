import { useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import {
  useCommitteesQuery,
  useCooperativesQuery,
  useCreateGroupActivityMutation,
  useGroupsQuery,
  useInstitutionsQuery,
  useUpdateGroupActivityMutation
} from '../api/queries';
import type {
  ActivityPartyRole,
  ActivityPartyType,
  ActivityPartyInput,
  Committee,
  Group,
  GroupActivity,
  GroupActivityCreateInput
} from '../api/types';
import { FormDialog, FormErrorSummary } from './FormDialog';

type ActivityFormValues = Omit<
  GroupActivityCreateInput,
  | 'committee'
  | 'group'
  | 'parties'
  | 'expected_participant_count'
  | 'women_attendance_count'
  | 'men_attendance_count'
> & {
  primary_party_type: ActivityPartyType;
  primary_party_id: number | '';
  related_parties: Array<{
    party_type: ActivityPartyType | '';
    party_id: number | '';
    role: Exclude<ActivityPartyRole, 'subject'>;
  }>;
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

type NamedParty = { id: number; name: string };

function partyOptions(
  type: ActivityPartyType,
  groups: NamedParty[],
  committees: NamedParty[],
  cooperatives: NamedParty[],
  institutions: NamedParty[]
) {
  return { group: groups, committee: committees, cooperative: cooperatives, institution: institutions }[type];
}

export function GroupActivityDialog({
  activity,
  committees,
  context,
  group,
  onClose,
  template
}: {
  activity?: GroupActivity;
  committees?: Committee[];
  context?: {
    party_type: ActivityPartyType;
    party_id: number;
    party_name: string;
    community: number;
  };
  group?: Group;
  onClose: () => void;
  template?: GroupActivity;
}) {
  const source = activity ?? template;
  const community = context?.community ?? group?.community;
  const [partySearch, setPartySearch] = useState('');
  if (!community) {
    throw new Error('An activity dialog requires a community context.');
  }
  const partyParams = { community, page: 1, page_size: 200, ordering: 'name', search: partySearch || undefined };
  const groupsQuery = useGroupsQuery(partyParams);
  const committeesQuery = useCommitteesQuery(partyParams);
  const cooperativesQuery = useCooperativesQuery(partyParams);
  const institutionsQuery = useInstitutionsQuery(partyParams);
  const availableCommittees = committeesQuery.data?.results ?? committees ?? [];
  const sourceParties = source?.parties ?? [];
  const sourceSubject = sourceParties.find((party) => party.role === 'subject');
  const sourceRelated = sourceParties.filter((party) => party.role !== 'subject');
  const defaultSubject = sourceSubject ?? context ?? (group ? {
    party_type: 'group' as const,
    party_id: group.id,
    party_name: group.name
  } : undefined);
  const createActivity = useCreateGroupActivityMutation();
  const updateActivity = useUpdateGroupActivityMutation();
  const isEditing = Boolean(activity);
  const defaultValues = useMemo<ActivityFormValues>(() => ({
    activity_type: source?.activity_type ?? 'meeting',
    agenda: source?.agenda ?? '',
    community,
    decisions_actions: isEditing ? source?.decisions_actions ?? '' : '',
    ends_at: template ? '' : localDateTime(source?.ends_at),
    expected_participant_count: source?.expected_participant_count ?? '',
    facilitator_name: source?.facilitator_name ?? '',
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
    primary_party_type: defaultSubject?.party_type ?? 'group',
    primary_party_id: defaultSubject?.party_id ?? '',
    related_parties: sourceRelated.map((party) => ({
      party_type: party.party_type,
      party_id: party.party_id,
      role: party.role === 'subject' ? 'partner' : party.role
    })),
    women_attendance_count: isEditing ? source?.women_attendance_count ?? '' : ''
  }), [community, defaultSubject, isEditing, source, sourceRelated, template]);
  const form = useForm<ActivityFormValues>({ defaultValues });
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch
  } = form;
  const { append: appendRelatedParty, fields: relatedPartyFields, remove: removeRelatedParty } = useFieldArray({
    control,
    name: 'related_parties'
  });
  const activityType = watch('activity_type');
  const primaryPartyType = watch('primary_party_type');
  const primaryPartyTypeField = register('primary_party_type');
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
          const primaryPartyId = Number(values.primary_party_id);
          const parties: ActivityPartyInput[] = [{
            party_type: values.primary_party_type,
            party_id: primaryPartyId,
            role: 'subject' as const
          }];
          values.related_parties.forEach((party) => {
            if (party.party_type && party.party_id) {
              parties.push({
                party_type: party.party_type,
                party_id: Number(party.party_id),
                role: party.role
              });
            }
          });
          const groupParty = parties.find((party) => party.party_type === 'group');
          const committeeParty = parties.find((party) => party.party_type === 'committee');
          const {
            primary_party_type: _primaryPartyType,
            primary_party_id: _primaryPartyId,
            related_parties: _relatedParties,
            ...activityValues
          } = values;
          void _primaryPartyType;
          void _primaryPartyId;
          void _relatedParties;
          const payload: GroupActivityCreateInput = {
            ...activityValues,
            agenda: values.activity_type === 'meeting' ? values.agenda : '',
            committee: committeeParty?.party_id ?? null,
            decisions_actions: values.activity_type === 'meeting'
              ? values.decisions_actions
              : '',
            ends_at: values.ends_at ? new Date(values.ends_at).toISOString() : null,
            expected_participant_count: optionalNumber(values.expected_participant_count),
            group: groupParty?.party_id ?? null,
            men_attendance_count: optionalNumber(values.men_attendance_count),
            minutes: values.activity_type === 'meeting' ? values.minutes : '',
            objectives: values.activity_type === 'training' ? values.objectives : '',
            report_notes: values.activity_type === 'training' ? values.report_notes : '',
            parties,
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
          {activityType === 'training' ? (
            <label className="form-field">
              <span>Training topic</span>
              <input {...register('training_topic')} />
            </label>
          ) : null}
          <label className="form-field">
            <span>Activity for</span>
            <select
              {...primaryPartyTypeField}
              onChange={(event) => {
                void primaryPartyTypeField.onChange(event);
                setValue('primary_party_id', '');
              }}
            >
              <option value="group">Group</option>
              <option value="committee">Committee</option>
              <option value="cooperative">Cooperative</option>
              <option value="institution">Institution</option>
            </select>
          </label>
          <label className="form-field">
            <span>Search organizations</span>
            <input
              onChange={(event) => setPartySearch(event.target.value)}
              placeholder="Search names"
              value={partySearch}
            />
          </label>
          <label className="form-field">
            <span>Primary organization</span>
            <select {...register('primary_party_id', { required: 'Choose the primary organization.' })}>
              <option value="">Choose organization</option>
              {defaultSubject && defaultSubject.party_type === primaryPartyType ? (
                <option value={defaultSubject.party_id}>{defaultSubject.party_name || `${primaryPartyType} #${defaultSubject.party_id}`}</option>
              ) : null}
              {partyOptions(primaryPartyType, groupsQuery.data?.results ?? [], availableCommittees, cooperativesQuery.data?.results ?? [], institutionsQuery.data?.results ?? []).filter((party) => party.id !== defaultSubject?.party_id).map((party) => (
                <option key={party.id} value={party.id}>{party.name}</option>
              ))}
            </select>
            {errors.primary_party_id ? <small>{errors.primary_party_id.message}</small> : null}
          </label>
          {relatedPartyFields.map((field, index) => {
            const relatedPartyType = watch(`related_parties.${index}.party_type`);
            const relatedPartyTypeField = register(`related_parties.${index}.party_type`);
            return (
              <div className="form-grid form-field--wide" key={field.id}>
                <label className="form-field">
                  <span>Related organization type</span>
                  <select
                    {...relatedPartyTypeField}
                    onChange={(event) => {
                      void relatedPartyTypeField.onChange(event);
                      setValue(`related_parties.${index}.party_id`, '');
                    }}
                  >
                    <option value="">Choose type</option>
                    <option value="group">Group</option>
                    <option value="committee">Committee</option>
                    <option value="cooperative">Cooperative</option>
                    <option value="institution">Institution</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Related organization</span>
                  <select {...register(`related_parties.${index}.party_id`)}>
                    <option value="">Choose organization</option>
                    {sourceRelated[index] && sourceRelated[index].party_type === relatedPartyType ? (
                      <option value={sourceRelated[index].party_id}>{sourceRelated[index].party_name || `${relatedPartyType} #${sourceRelated[index].party_id}`}</option>
                    ) : null}
                    {relatedPartyType ? partyOptions(relatedPartyType, groupsQuery.data?.results ?? [], availableCommittees, cooperativesQuery.data?.results ?? [], institutionsQuery.data?.results ?? []).filter((party) => party.id !== sourceRelated[index]?.party_id).map((party) => (
                      <option key={party.id} value={party.id}>{party.name}</option>
                    )) : null}
                  </select>
                </label>
                <label className="form-field">
                  <span>Relationship</span>
                  <select {...register(`related_parties.${index}.role`)}>
                    <option value="partner">Partner / with</option>
                    <option value="organizer">Organizer</option>
                    <option value="host">Host</option>
                    <option value="audience">Participating audience</option>
                  </select>
                </label>
                <button className="button button--secondary" type="button" onClick={() => removeRelatedParty(index)}>Remove related organization</button>
              </div>
            );
          })}
          <button
            className="button button--secondary"
            type="button"
            onClick={() => appendRelatedParty({ party_type: '', party_id: '', role: 'partner' })}
          >
            Add related organization
          </button>
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
