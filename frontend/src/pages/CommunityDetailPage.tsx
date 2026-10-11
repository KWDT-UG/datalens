import { PlusIcon, SearchIcon, UploadIcon } from '@patternfly/react-icons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  BatchArchiveError,
  useCommitteeMembershipsQuery,
  useCommitteeQuery,
  useCommitteesQuery,
  useCooperativeMembershipsQuery,
  useCooperativeQuery,
  useCommunityQuery,
  useCooperativesQuery,
  useGroupMembersQuery,
  useGroupActivitiesQuery,
  useGroupQuery,
  useGroupsQuery,
  useArchiveRecordsMutation,
  useImpactRecordsQuery,
  useInstitutionQuery,
  useInstitutionsQuery,
  useMemberQuery,
  useMembersQuery,
  usePermanentDeleteMutation,
  useResourcesQuery
} from '../api/queries';
import type {
  ActivityPartyType,
  Committee,
  CommitteeMembership,
  Cooperative,
  CooperativeMembership,
  Group,
  GroupActivity,
  ImpactRecord,
  Institution,
  Member,
  PaginatedResponse,
  Resource
} from '../api/types';
import {
  CommitteeCreateDialog,
  CooperativeCreateDialog,
  GroupCreateDialog,
  ImpactRecordCreateDialog,
  InstitutionCreateDialog,
  MemberCreateDialog
} from '../components/CommunityBreakdownCreateDialogs';
import { ActionMenu } from '../components/ActionMenu';
import { ArchiveRecordsDialog, type ArchiveRecordTarget } from '../components/ArchiveRecordsDialog';
import { CommunityCreateDialog } from '../components/CommunityCreateDialog';
import { ListActionError } from '../components/ListActionError';
import { PermanentDeleteDialog } from '../components/PermanentDeleteDialog';
import { ResourceCreateDialog } from '../components/ResourceCreateDialog';
import { GroupActivityDialog } from '../components/GroupActivityDialog';
import { ParticipationMembershipDialog } from '../components/ParticipationMembershipDialog';
import { StatusBadge } from '../components/StatusBadge';
import { SortableTableHeader } from '../components/SortableTableHeader';
import { useAuth } from '../auth/AuthContext';
import { capabilities, hasCapability } from '../auth/permissions';
import { downloadCsv, toggleVisibleSelection } from '../utils/listActions';
import { formatQuantity } from '../utils/formatQuantity';
import { PaginationLabel } from './CommunitiesPage';

const sectionPageSize = 10;
const groupMemberPageSize = 25;

const sections = [
  { key: 'groups', label: 'Groups', countField: 'group_count', ordering: 'name' },
  { key: 'members', label: 'Members', countField: 'member_count', ordering: 'last_name,first_name' },
  { key: 'institutions', label: 'Institutions', countField: 'institution_count', ordering: 'name' },
  { key: 'cooperatives', label: 'Cooperatives', countField: 'cooperative_count', ordering: 'name' },
  { key: 'committees', label: 'Committees', countField: 'committee_count', ordering: 'name' },
  { key: 'resources', label: 'Resources', countField: 'resource_count', ordering: 'name' },
  { key: 'impact', label: 'Impact', countField: undefined, ordering: '-as_of_date' }
] as const;

type SectionKey = (typeof sections)[number]['key'];
type CountField = Exclude<(typeof sections)[number]['countField'], undefined>;
type TableRow = {
  id: number;
  label: string;
  cells: ReactNode[];
};
type TableColumn = {
  label: string;
  ordering?: string;
};
type BreakdownRecord = Member | Group | Institution | Committee | Cooperative | Resource | ImpactRecord;
type GroupWorkspaceTab = 'overview' | 'resources' | 'trainings' | 'committees' | 'members';
type MemberDetailNavigationState = {
  parentGroup?: {
    id: number;
    name: string;
  };
};
type GroupActivityDisplay = {
  id: number;
  source: GroupActivity;
  category: 'Meeting' | 'Training';
  title: string;
  startDate: string;
  endDate: string;
  dateRange: string;
  month: string;
  startDay: number;
  endDay: number;
  facilitator: string;
  location: string;
  attendance: {
    women: number;
    men: number;
  };
  ageBands: Array<{
    label: string;
    men: number;
    women: number;
  }>;
  focus: string;
  reports: string[];
  reportStatus: string;
  recordStatus: 'planned' | 'complete' | 'needs_attention' | 'cancelled';
};

const sectionKeys = sections.map((item) => item.key);
const groupWorkspaceTabs: Array<{ key: GroupWorkspaceTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'members', label: 'Members' },
  { key: 'resources', label: 'Resources' },
  { key: 'trainings', label: 'Trainings & Meetings' },
  { key: 'committees', label: 'Committees' }
];
const groupMemberStatusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'exited', label: 'Exited' }
];
const groupMemberSortOptions = [
  { value: 'name', label: 'Name' },
  { value: 'member_number', label: 'Member number' },
  { value: 'position', label: 'Position' },
  { value: 'joined_on', label: 'Joined date' }
] as const;
function activityDisplay(activity: GroupActivity): GroupActivityDisplay {
  const start = new Date(activity.starts_at);
  const end = new Date(activity.ends_at ?? activity.starts_at);
  const reports = [activity.minutes, activity.decisions_actions, activity.report_notes]
    .filter((value): value is string => Boolean(value?.trim()));
  const reportStatus = activity.record_status === 'complete'
    ? activity.activity_type === 'meeting' ? 'Minutes recorded' : 'Report complete'
    : activity.record_status === 'needs_attention'
      ? 'Needs attention'
      : activity.record_status === 'cancelled'
        ? 'Cancelled'
        : 'Planned';
  return {
    id: activity.id,
    source: activity,
    category: activity.activity_type === 'meeting' ? 'Meeting' : 'Training',
    title: activity.title,
    startDate: activity.starts_at,
    endDate: activity.ends_at ?? activity.starts_at,
    dateRange: start.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      + (activity.ends_at
        ? ` – ${end.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
        : ''),
    month: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    startDay: start.getDate(),
    endDay: end.getDate(),
    facilitator: activity.facilitator_name || 'Not assigned',
    location: activity.location_text || 'Location not recorded',
    attendance: {
      women: activity.women_attendance_count ?? 0,
      men: activity.men_attendance_count ?? 0
    },
    ageBands: [],
    focus: activity.activity_type === 'meeting'
      ? activity.agenda || activity.notes || 'Agenda not recorded'
      : activity.objectives || activity.training_topic || activity.notes || 'Objectives not recorded',
    reports,
    reportStatus,
    recordStatus: activity.record_status
  };
}
const createLabels: Record<SectionKey, string> = {
  committees: 'Create committee',
  cooperatives: 'Create cooperative',
  groups: 'Create group',
  impact: 'Create impact record',
  institutions: 'Create institution',
  members: 'Create member',
  resources: 'Create resource'
};
const archiveConfigs: Record<SectionKey, { itemName: string; key: string; path: string }> = {
  committees: { itemName: 'committee', key: 'committees', path: '/api/v1/committees/' },
  cooperatives: { itemName: 'cooperative', key: 'cooperatives', path: '/api/v1/cooperatives/' },
  groups: { itemName: 'group', key: 'groups', path: '/api/v1/groups/' },
  impact: { itemName: 'impact record', key: 'impact-records', path: '/api/v1/impact-records/' },
  institutions: { itemName: 'institution', key: 'institutions', path: '/api/v1/institutions/' },
  members: { itemName: 'member', key: 'members', path: '/api/v1/members/' },
  resources: { itemName: 'resource', key: 'resources', path: '/api/v1/resources/' }
};

function isSectionKey(value: string | undefined): value is SectionKey {
  return Boolean(value && sectionKeys.includes(value as SectionKey));
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : 'Not recorded';
}

function formatLabel(value?: string | null) {
  return value ? value.replace(/_/g, ' ') : 'Not recorded';
}

function formatCount(value?: number) {
  return new Intl.NumberFormat().format(value ?? 0);
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

function formatMoney(amount?: string, currency: string | null = 'UGX') {
  if (!amount) {
    return 'Not recorded';
  }
  return `${currency ?? 'UGX'} ${Number(amount).toLocaleString()}`;
}

function memberName(member: Member) {
  return [member.preferred_name || member.first_name, member.last_name].filter(Boolean).join(' ');
}

function formatResourceQuantity(resource: Resource) {
  return formatQuantity(resource.quantity, resource.unit, 'Quantity not recorded');
}

function sumNumbers(values: Array<number | undefined>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function reverseOrdering(ordering: string) {
  return ordering
    .split(',')
    .map((field) => field.startsWith('-') ? field.slice(1) : `-${field}`)
    .join(',');
}

function orderingDirection(currentOrdering: string, columnOrdering: string) {
  if (currentOrdering === columnOrdering) return 'ascending' as const;
  if (currentOrdering === reverseOrdering(columnOrdering)) return 'descending' as const;
  return null;
}

function getParentGroupNavigationState(state: unknown) {
  if (!state || typeof state !== 'object' || !('parentGroup' in state)) {
    return undefined;
  }
  const parentGroup = (state as MemberDetailNavigationState).parentGroup;
  if (!parentGroup || typeof parentGroup.id !== 'number' || typeof parentGroup.name !== 'string') {
    return undefined;
  }
  return parentGroup;
}

function syncUpdatedAt(record: BreakdownRecord) {
  return 'updated_at' in record ? record.updated_at : undefined;
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || 'Not recorded'}</dd>
    </div>
  );
}

function DetailSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="record-detail__section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

const tableConfigs: Record<
  SectionKey,
  {
    columns: TableColumn[];
    exportRows: (
      records: Array<Member | Group | Institution | Committee | Cooperative | Resource | ImpactRecord>
    ) => Array<Record<string, boolean | number | string | null | undefined>>;
    itemName: string;
    toRows: (records: Array<Member | Group | Institution | Committee | Cooperative | Resource | ImpactRecord>) => TableRow[];
  }
> = {
  members: {
    columns: [
      { label: 'Member name', ordering: 'last_name,first_name' },
      { label: 'Member #', ordering: 'member_number' },
      { label: 'Phone' },
      { label: 'Status', ordering: 'status' },
      { label: 'Joined', ordering: 'joined_on' }
    ],
    exportRows: (records) =>
      (records as Member[]).map((member) => ({
        community: member.community,
        email: member.email,
        first_name: member.first_name,
        group: member.group,
        id: member.id,
        joined_on: member.joined_on,
        last_name: member.last_name,
        member_number: member.member_number,
        phone: member.phone,
        preferred_name: member.preferred_name,
        status: member.status
      })),
    itemName: 'members',
    toRows: (records) =>
      (records as Member[]).map((member) => ({
        id: member.id,
        label: memberName(member),
        cells: [
          memberName(member),
          member.member_number || 'Not recorded',
          member.phone || 'Not recorded',
          <StatusBadge status={member.status} />,
          formatDate(member.joined_on)
        ]
      }))
  },
  groups: {
    columns: [
      { label: 'Group name', ordering: 'name' },
      { label: 'Code', ordering: 'code' },
      { label: 'Formed', ordering: 'formed_on' },
      { label: 'Status', ordering: 'status' },
      { label: 'Members', ordering: 'member_count' },
      { label: 'Female', ordering: 'female_count' },
      { label: 'Male', ordering: 'male_count' }
    ],
    exportRows: (records) =>
      (records as Group[]).map((group) => ({
        code: group.code,
        community: group.community,
        formed_on: group.formed_on,
        id: group.id,
        member_count: group.member_count,
        female_count: group.female_count,
        male_count: group.male_count,
        name: group.name,
        status: group.status
      })),
    itemName: 'groups',
    toRows: (records) =>
      (records as Group[]).map((group) => ({
        id: group.id,
        label: group.name,
        cells: [
          group.name,
          group.code || 'Not recorded',
          formatDate(group.formed_on),
          <StatusBadge status={group.status} />,
          formatCount(group.member_count),
          formatCount(group.female_count),
          formatCount(group.male_count)
        ]
      }))
  },
  institutions: {
    columns: [
      { label: 'Institution name', ordering: 'name' },
      { label: 'Type', ordering: 'institution_type' },
      { label: 'Contact', ordering: 'contact_name' },
      { label: 'Email' },
      { label: 'Status', ordering: 'status' }
    ],
    exportRows: (records) =>
      (records as Institution[]).map((institution) => ({
        code: institution.code,
        community: institution.community,
        contact_name: institution.contact_name,
        email: institution.email,
        id: institution.id,
        institution_type: institution.institution_type,
        name: institution.name,
        phone: institution.phone,
        status: institution.status
      })),
    itemName: 'institutions',
    toRows: (records) =>
      (records as Institution[]).map((institution) => ({
        id: institution.id,
        label: institution.name,
        cells: [
          institution.name,
          formatLabel(institution.institution_type),
          institution.contact_name || institution.phone || 'Not recorded',
          institution.email ? <a href={`mailto:${institution.email}`}>{institution.email}</a> : 'Not recorded',
          <StatusBadge status={institution.status} />
        ]
      }))
  },
  cooperatives: {
    columns: [
      { label: 'Cooperative name', ordering: 'name' },
      { label: 'Type', ordering: 'cooperative_type' },
      { label: 'Formed', ordering: 'formed_on' },
      { label: 'Closed', ordering: 'closed_on' },
      { label: 'Status', ordering: 'status' }
    ],
    exportRows: (records) =>
      (records as Cooperative[]).map((cooperative) => ({
        closed_on: cooperative.closed_on,
        community: cooperative.community,
        cooperative_type: cooperative.cooperative_type,
        formed_on: cooperative.formed_on,
        id: cooperative.id,
        name: cooperative.name,
        status: cooperative.status
      })),
    itemName: 'cooperatives',
    toRows: (records) =>
      (records as Cooperative[]).map((cooperative) => ({
        id: cooperative.id,
        label: cooperative.name,
        cells: [
          cooperative.name,
          formatLabel(cooperative.cooperative_type),
          formatDate(cooperative.formed_on),
          formatDate(cooperative.closed_on),
          <StatusBadge status={cooperative.status} />
        ]
      }))
  },
  committees: {
    columns: [
      { label: 'Committee name', ordering: 'name' },
      { label: 'Type', ordering: 'committee_type' },
      { label: 'Formed', ordering: 'formed_on' },
      { label: 'Closed', ordering: 'closed_on' },
      { label: 'Status', ordering: 'status' }
    ],
    exportRows: (records) =>
      (records as Committee[]).map((committee) => ({
        closed_on: committee.closed_on,
        committee_type: committee.committee_type,
        community: committee.community,
        formed_on: committee.formed_on,
        id: committee.id,
        name: committee.name,
        status: committee.status
      })),
    itemName: 'committees',
    toRows: (records) =>
      (records as Committee[]).map((committee) => ({
        id: committee.id,
        label: committee.name,
        cells: [
          committee.name,
          formatLabel(committee.committee_type),
          formatDate(committee.formed_on),
          formatDate(committee.closed_on),
          <StatusBadge status={committee.status} />
        ]
      }))
  },
  resources: {
    columns: [
      { label: 'Resource name', ordering: 'name' },
      { label: 'Type', ordering: 'resource_type' },
      { label: 'Owner' },
      { label: 'Quantity', ordering: 'quantity' },
      { label: 'Acquired', ordering: 'acquired_on' },
      { label: 'Financial position' },
      { label: 'Themes' },
      { label: 'Status', ordering: 'status' }
    ],
    exportRows: (records) =>
      (records as Resource[]).map((resource) => ({
        community: resource.community,
        acquired_on: resource.acquired_on,
        id: resource.id,
        name: resource.name,
        owner_id: resource.owner_id,
        owner_type: resource.owner_type,
        quantity: resource.quantity,
        resource_type: resource.resource_type,
        status: resource.status,
        thematic_areas: resource.thematic_areas?.map((area) => area.code).join('; '),
        unit: resource.unit,
        updated_at: resource.updated_at,
        value_amount: resource.value_amount,
        value_currency: resource.value_currency
      })),
    itemName: 'resources',
    toRows: (records) =>
      (records as Resource[]).map((resource) => ({
        id: resource.id,
        label: resource.name,
        cells: [
          resource.name,
          formatLabel(resource.resource_type),
          resource.owner_display ?? formatLabel(resource.owner_type),
          formatQuantity(resource.quantity, resource.unit),
          formatDate(resource.acquired_on),
          resource.payment_summary
            ? `${formatMoney(resource.payment_summary.total_paid, resource.payment_summary.currency)} paid · ${formatMoney(resource.payment_summary.remaining_amount, resource.payment_summary.currency)} remaining`
            : formatMoney(resource.value_amount, resource.value_currency),
          resource.thematic_areas?.map((area) => area.code).join(', ') || 'Not recorded',
          <StatusBadge status={resource.status} />
        ]
      }))
  },
  impact: {
    columns: [
      { label: 'As of', ordering: 'as_of_date' },
      { label: 'Period', ordering: 'period_type' },
      { label: 'Resource', ordering: 'resource__name' },
      { label: 'Beneficiaries', ordering: 'beneficiary_count' },
      { label: 'Households', ordering: 'household_count' },
      { label: 'Members', ordering: 'member_count' },
      { label: 'Method', ordering: 'method' }
    ],
    exportRows: (records) =>
      (records as ImpactRecord[]).map((impact) => ({
        as_of_date: impact.as_of_date,
        beneficiary_count: impact.beneficiary_count,
        household_count: impact.household_count,
        id: impact.id,
        institution_count: impact.institution_count,
        member_count: impact.member_count,
        method: impact.method,
        period_end: impact.period_end,
        period_start: impact.period_start,
        period_type: impact.period_type,
        resource: impact.resource,
        updated_at: impact.updated_at
      })),
    itemName: 'impact records',
    toRows: (records) =>
      (records as ImpactRecord[]).map((impact) => ({
        id: impact.id,
        label: `Impact record ${impact.id}`,
        cells: [
          formatDate(impact.as_of_date),
          formatLabel(impact.period_type),
          impact.resource_name ?? 'Resource',
          formatCount(impact.beneficiary_count),
          formatCount(impact.household_count),
          formatCount(impact.member_count),
          formatLabel(impact.method)
        ]
      }))
  }
};

type BreakdownRecordDetailPageProps = {
  activeSection: SectionKey;
  canManage: boolean;
  committeeMemberships: CommitteeMembership[];
  committeeMembershipsCount: number;
  committeeMembershipsError: boolean;
  committeeMembershipsLoading: boolean;
  communityName: string;
  communityId: number;
  groupImpactRecords: ImpactRecord[];
  groupImpactRecordsLoading: boolean;
  groupActivities: GroupActivity[];
  groupActivitiesLoading: boolean;
  groupCommitteeMemberships: CommitteeMembership[];
  groupCommittees: Committee[];
  groupCommitteesLoading: boolean;
  groupMembers: Member[];
  groupMembersLoading: boolean;
  groupResources: Resource[];
  groupResourcesLoading: boolean;
  isLoading: boolean;
  onCreateGroupMember: (group: Group) => void;
  onEdit: (record: BreakdownRecord) => void;
  onEditGroupMember: (member: Member) => void;
  record: BreakdownRecord | null;
};

function BreakdownRecordDetailPage({
  activeSection,
  canManage,
  committeeMemberships,
  committeeMembershipsCount,
  committeeMembershipsError,
  committeeMembershipsLoading,
  communityId,
  communityName,
  groupImpactRecords,
  groupImpactRecordsLoading,
  groupActivities,
  groupActivitiesLoading,
  groupCommitteeMemberships,
  groupCommittees,
  groupCommitteesLoading,
  groupMembers,
  groupMembersLoading,
  groupResources,
  groupResourcesLoading,
  isLoading,
  onCreateGroupMember,
  onEdit,
  onEditGroupMember,
  record
}: BreakdownRecordDetailPageProps) {
  const location = useLocation();
  const title = record
    ? activeSection === 'members'
      ? memberName(record as Member)
      : activeSection === 'impact'
        ? `Impact record ${(record as ImpactRecord).id}`
        : 'name' in record
          ? record.name
          : `Record ${record.id}`
    : 'Record details';
  const sectionLabel = sections.find((item) => item.key === activeSection)?.label ?? 'Breakdown';
  const parentGroup = activeSection === 'members' ? getParentGroupNavigationState(location.state) : undefined;
  const backTo = parentGroup ? `/communities/${communityId}/groups/${parentGroup.id}` : `/communities/${communityId}/${activeSection}`;
  const backLabel = parentGroup?.name ?? tableConfigs[activeSection].itemName;
  const backCrumbLabel = parentGroup?.name ?? sectionLabel;

  return (
    <div className="record-page" aria-labelledby="record-detail-title">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/communities">Communities</Link>
        <span>›</span>
        <Link to={`/communities/${communityId}`}>{communityName}</Link>
        <span>›</span>
        <Link to={backTo}>{backCrumbLabel}</Link>
        <span>›</span>
        <span>{title}</span>
      </nav>

      {isLoading ? <div className="state-box">Loading record details...</div> : null}
      {!isLoading && !record ? (
        <div className="state-box">
          This record is not available yet. <Link to={backTo}>Return to {backLabel}</Link>.
        </div>
      ) : null}
      {record ? (
        activeSection === 'groups' ? (
          <GroupWorkspaceDetailPage
            backTo={backTo}
            canManage={canManage}
            communityName={communityName}
            group={record as Group}
            impactRecords={groupImpactRecords}
            impactRecordsLoading={groupImpactRecordsLoading}
            activities={groupActivities}
            activitiesLoading={groupActivitiesLoading}
            committeeMemberships={groupCommitteeMemberships}
            committees={groupCommittees}
            committeesLoading={groupCommitteesLoading}
            members={groupMembers}
            membersLoading={groupMembersLoading}
            onCreateMember={onCreateGroupMember}
            onEdit={onEdit}
            onEditMember={onEditGroupMember}
            resources={groupResources}
            resourcesLoading={groupResourcesLoading}
          />
        ) : (
        <>
          <header className="record-page__hero">
            <div>
              <Link className="record-page__back" to={backTo}>← Back to {backLabel}</Link>
              <span className="record-detail__eyebrow">{sectionLabel}</span>
              <h1 id="record-detail-title">{title}</h1>
              <p>
                {communityName} · Last updated {formatDateTime(syncUpdatedAt(record))}
              </p>
              {'status' in record ? <StatusBadge status={record.status} /> : null}
            </div>
            {canManage ? (
              <button className="button button--primary" type="button" onClick={() => onEdit(record)}>
                Edit {archiveConfigs[activeSection].itemName}
              </button>
            ) : null}
          </header>

          <div className="record-page__layout">
            <aside className="record-page__snapshot">
              <span>Record type</span>
              <strong>{sectionLabel}</strong>
              {'status' in record ? (
                <>
                  <span>Status</span>
                  <StatusBadge status={record.status} />
                </>
              ) : null}
              {record.approval_status ? (
                <>
                  <span>Approval</span>
                  <StatusBadge status={record.approval_status} />
                </>
              ) : null}
              {record.approval_history_count ? (
                <>
                  <span>Approval history</span>
                  <strong>{formatCount(record.approval_history_count)}</strong>
                </>
              ) : null}
              <span>Updated</span>
              <strong>{formatDateTime(syncUpdatedAt(record))}</strong>
            </aside>
            <div className="record-page__content">
              {activeSection === 'members' ? (
                <MemberDetailContent member={record as Member} />
              ) : activeSection === 'committees' ? (
                <CommitteeDetailContent
                  canManage={canManage}
                  committee={record as Committee}
                  memberships={committeeMemberships}
                  membershipsCount={committeeMembershipsCount}
                  membershipsError={committeeMembershipsError}
                  membershipsLoading={committeeMembershipsLoading}
                />
              ) : activeSection === 'cooperatives' ? (
                <CooperativeDetailContent
                  canManage={canManage}
                  cooperative={record as Cooperative}
                />
              ) : activeSection === 'institutions' ? (
                <InstitutionDetailContent
                  canManage={canManage}
                  institution={record as Institution}
                />
              ) : (
                <GenericRecordDetail activeSection={activeSection} record={record} />
              )}
            </div>
          </div>
        </>
        )
      ) : null}
    </div>
  );
}

function GroupWorkspaceDetailPage({
  activities,
  activitiesLoading,
  backTo,
  canManage,
  committeeMemberships,
  committees,
  committeesLoading,
  communityName,
  group,
  impactRecords,
  impactRecordsLoading,
  members,
  membersLoading,
  onCreateMember,
  onEdit,
  onEditMember,
  resources,
  resourcesLoading
}: {
  activities: GroupActivity[];
  activitiesLoading: boolean;
  backTo: string;
  canManage: boolean;
  committeeMemberships: CommitteeMembership[];
  committees: Committee[];
  committeesLoading: boolean;
  communityName: string;
  group: Group;
  impactRecords: ImpactRecord[];
  impactRecordsLoading: boolean;
  members: Member[];
  membersLoading: boolean;
  onCreateMember: (group: Group) => void;
  onEdit: (record: BreakdownRecord) => void;
  onEditMember: (member: Member) => void;
  resources: Resource[];
  resourcesLoading: boolean;
}) {
  const [activeTab, setActiveTab] = useState<GroupWorkspaceTab>('overview');
  const activeMembers = members.filter((member) => member.status !== 'archived' && member.status !== 'inactive');
  const impactBeneficiaries = sumNumbers(impactRecords.map((impact) => impact.beneficiary_count));
  const impactHouseholds = sumNumbers(impactRecords.map((impact) => impact.household_count));
  const groupMeta = [
    group.code ? `Code ${group.code}` : null,
    group.sub_county ? group.sub_county : null,
    group.formed_on ? `Formed ${formatDate(group.formed_on)}` : null
  ].filter(Boolean);
  const trainings = useMemo(() => activities.map(activityDisplay), [activities]);

  return (
    <article className="group-workspace" aria-labelledby="group-workspace-title">
      <header className="group-workspace__hero">
        <div>
          <Link className="record-page__back" to={backTo}>← Back to groups</Link>
          <span className="record-detail__eyebrow">Group workspace</span>
          <h1 id="group-workspace-title">{group.name}</h1>
          <p>{communityName} · Last updated {formatDateTime(syncUpdatedAt(group))}</p>
          <div className="group-workspace__chips">
            <StatusBadge status={group.status} />
            {groupMeta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
        {canManage ? (
          <button className="button button--primary" type="button" onClick={() => onEdit(group)}>
            Edit group
          </button>
        ) : null}
      </header>

      <nav className="group-workspace-tabs" aria-label="Group workspace sections">
        {groupWorkspaceTabs.map((tab) => (
          <button
            aria-current={activeTab === tab.key ? 'page' : undefined}
            className={activeTab === tab.key ? 'is-active' : ''}
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="group-workspace__content">
        {activeTab === 'overview' ? (
          <GroupOverviewTab
            activeMembers={activeMembers.length}
            group={group}
            impactBeneficiaries={impactBeneficiaries}
            impactHouseholds={impactHouseholds}
            impactLoading={impactRecordsLoading}
            membersLoading={membersLoading}
            committees={committees}
            committeesLoading={committeesLoading}
            resources={resources}
            resourcesLoading={resourcesLoading}
            trainings={trainings}
            trainingsLoading={activitiesLoading}
          />
        ) : null}
        {activeTab === 'members' ? (
          <GroupMembersTab
            canManage={canManage}
            group={group}
            members={members}
            membersLoading={membersLoading}
            onCreateMember={() => onCreateMember(group)}
            onEditMember={onEditMember}
          />
        ) : null}
        {activeTab === 'resources' ? (
          <GroupResourcesTab
            canManage={canManage}
            group={group}
            resources={resources}
            resourcesLoading={resourcesLoading}
          />
        ) : null}
        {activeTab === 'trainings' ? (
          <GroupTrainingsTab
            canManage={canManage}
            committees={committees}
            group={group}
            trainings={trainings}
            trainingsLoading={activitiesLoading}
          />
        ) : null}
        {activeTab === 'committees' ? (
          <GroupCommitteesTab
            committeeMemberships={committeeMemberships}
            committees={committees}
            committeesLoading={committeesLoading}
            members={members}
          />
        ) : null}
      </div>
    </article>
  );
}

function GroupOverviewTab({
  activeMembers,
  committees,
  committeesLoading,
  group,
  impactBeneficiaries,
  impactHouseholds,
  impactLoading,
  membersLoading,
  resources,
  resourcesLoading,
  trainings,
  trainingsLoading
}: {
  activeMembers: number;
  committees: Committee[];
  committeesLoading: boolean;
  group: Group;
  impactBeneficiaries: number;
  impactHouseholds: number;
  impactLoading: boolean;
  membersLoading: boolean;
  resources: Resource[];
  resourcesLoading: boolean;
  trainings: GroupActivityDisplay[];
  trainingsLoading: boolean;
}) {
  const upcomingTrainings = useMemo(() => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentAndUpcoming = trainings
      .filter((training) => new Date(training.startDate) >= monthStart)
      .sort((left, right) => left.startDate.localeCompare(right.startDate));
    if (currentAndUpcoming.length > 0) {
      return currentAndUpcoming.slice(0, 4);
    }
    return [...trainings]
      .sort((left, right) => right.startDate.localeCompare(left.startDate))
      .slice(0, 4);
  }, [trainings]);
  const featuredResources = resources.slice(0, 3);
  const featuredCommittees = committees.slice(0, 2);
  return (
    <>
      <div className="group-workspace__metrics" aria-label="Group summary">
        <span>
          <strong>{membersLoading ? '-' : formatCount(activeMembers)}</strong>
          Active members
        </span>
        <span>
          <strong>{resourcesLoading ? '-' : formatCount(resources.length)}</strong>
          Group resources
        </span>
        <span>
          <strong>{impactLoading ? '-' : formatCount(impactBeneficiaries)}</strong>
          Beneficiaries
        </span>
        <span>
          <strong>{impactLoading ? '-' : formatCount(impactHouseholds)}</strong>
          Households
        </span>
      </div>

      <div className="group-overview-board">
        <section className="group-overview-panel group-overview-panel--wide" aria-labelledby="group-overview-trainings">
          <header className="group-overview-panel__header">
            <div>
              <span>Schedule and attendance</span>
              <h2 id="group-overview-trainings">Trainings &amp; meetings</h2>
            </div>
            <strong>{formatCount(upcomingTrainings.length)}</strong>
          </header>
          {trainingsLoading ? <div className="state-box">Loading activities...</div> : null}
          {!trainingsLoading && upcomingTrainings.length > 0 ? (
            <div className="group-overview-training-list">
              {upcomingTrainings.map((training) => (
                <article key={training.id}>
                  <time>
                    <strong>{training.startDay}</strong>
                    <span>{training.month.split(' ')[0]}</span>
                  </time>
                  <div>
                    <span className="group-event-category">{training.category}</span>
                    <h3>{training.title}</h3>
                    <p>{training.focus}</p>
                    <span>{training.dateRange} · {training.facilitator}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : !trainingsLoading ? (
            <p className="table-note">No training or meeting activity is recorded yet.</p>
          ) : null}
        </section>

        <section className="group-overview-panel" aria-labelledby="group-overview-committees">
          <header className="group-overview-panel__header">
            <div>
              <span>Participation</span>
              <h2 id="group-overview-committees">Committees</h2>
            </div>
            <strong>{committeesLoading ? '-' : formatCount(committees.length)}</strong>
          </header>
          {committeesLoading ? <div className="state-box">Loading committees...</div> : null}
          {!committeesLoading && featuredCommittees.length > 0 ? (
            <div className="group-overview-stack">
              {featuredCommittees.map((committee) => (
                <Link key={committee.id} to={`/communities/${committee.community}/committees/${committee.id}`}>
                  <strong>{committee.name}</strong>
                  <span>{formatLabel(committee.committee_type)}</span>
                  <StatusBadge status={committee.status} />
                </Link>
              ))}
            </div>
          ) : null}
          {!committeesLoading && featuredCommittees.length === 0 ? (
            <p className="table-note">No committee participation is linked to this group yet.</p>
          ) : null}
        </section>

        <section className="group-overview-panel" aria-labelledby="group-overview-resources">
          <header className="group-overview-panel__header">
            <div>
              <span>Assets</span>
              <h2 id="group-overview-resources">Resources</h2>
            </div>
            <strong>{resourcesLoading ? '-' : formatCount(resources.length)}</strong>
          </header>
          {resourcesLoading ? <div className="state-box">Loading resources...</div> : null}
          {!resourcesLoading && featuredResources.length > 0 ? (
            <div className="group-overview-stack">
              {featuredResources.map((resource) => (
                <Link
                  key={resource.id}
                  state={{ resourceOrigin: {
                    label: group.name,
                    path: `/communities/${group.community}/groups/${group.id}`
                  } }}
                  to={`/resources/${resource.id}`}
                >
                  <strong>{resource.name}</strong>
                  <span>{formatLabel(resource.resource_type)} · {formatResourceQuantity(resource)}</span>
                  <em>
                    {resource.payment_summary
                      ? `${formatMoney(resource.payment_summary.total_paid, resource.payment_summary.currency)} paid · ${formatMoney(resource.payment_summary.remaining_amount, resource.payment_summary.currency)} remaining`
                      : formatMoney(resource.value_amount, resource.value_currency)}
                  </em>
                </Link>
              ))}
            </div>
          ) : null}
          {!resourcesLoading && featuredResources.length === 0 ? (
            <p className="table-note">No resources owned by this group are recorded yet.</p>
          ) : null}
        </section>

      </div>
    </>
  );
}

function GroupMembersTab({
  canManage,
  group,
  members,
  membersLoading,
  onCreateMember,
  onEditMember
}: {
  canManage: boolean;
  group: Group;
  members: Member[];
  membersLoading: boolean;
  onCreateMember: () => void;
  onEditMember: (member: Member) => void;
}) {
  const [memberSearch, setMemberSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<(typeof groupMemberSortOptions)[number]['value']>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const filteredMembers = useMemo(() => {
    const searchValue = memberSearch.trim().toLowerCase();
    const sortValue = (member: Member) => {
      if (sortField === 'member_number') return member.member_number ?? '';
      if (sortField === 'position') {
        return member.group_position || member.community_position || '';
      }
      if (sortField === 'joined_on') return member.joined_on ?? '';
      return memberName(member);
    };
    return members
      .filter((member) => {
        const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
        if (!matchesStatus) {
          return false;
        }
        if (!searchValue) {
          return true;
        }
        return [
          memberName(member),
          member.member_number,
          member.phone,
          member.group_position,
          member.community_position
        ].some((value) => value?.toLowerCase().includes(searchValue));
      })
      .sort((left, right) => {
        const leftValue = sortValue(left);
        const rightValue = sortValue(right);
        if (!leftValue && !rightValue) return 0;
        if (!leftValue) return 1;
        if (!rightValue) return -1;
        const comparison = leftValue.localeCompare(rightValue, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [memberSearch, members, sortDirection, sortField, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / groupMemberPageSize));
  const visibleMembers = filteredMembers.slice(
    (page - 1) * groupMemberPageSize,
    page * groupMemberPageSize
  );

  useEffect(() => {
    setPage(1);
  }, [memberSearch, sortDirection, sortField, statusFilter, members.length]);

  if (membersLoading) {
    return <div className="state-box">Loading group members...</div>;
  }
  if (members.length === 0) {
    return (
      <div className="state-box group-members-roster__empty">
        <span>No members recorded for this group.</span>
        {canManage ? (
          <button className="button button--primary" type="button" onClick={onCreateMember}>
            <PlusIcon aria-hidden="true" />
            Add member
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="group-members-roster">
      <div className="group-members-roster__toolbar">
        <div>
          <strong>{formatCount(filteredMembers.length)}</strong>
          <span>{filteredMembers.length === members.length ? 'members in this group' : `of ${formatCount(members.length)} members`}</span>
        </div>
        <label className="compact-filter compact-filter--search">
          Search
          <input
            aria-label="Search group members"
            value={memberSearch}
            onChange={(event) => setMemberSearch(event.target.value)}
            placeholder="Name, number, phone, or position"
          />
        </label>
        <label className="compact-filter">
          Status
          <select
            aria-label="Filter group members by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {groupMemberStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="compact-filter">
          Sort by
          <select
            aria-label="Sort group members by"
            value={sortField}
            onChange={(event) => setSortField(event.target.value as typeof sortField)}
          >
            {groupMemberSortOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="compact-filter">
          Order
          <select
            aria-label="Sort group members direction"
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value as typeof sortDirection)}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
        {canManage ? (
          <button className="button button--primary" type="button" onClick={onCreateMember}>
            <PlusIcon aria-hidden="true" />
            Add member
          </button>
        ) : null}
      </div>

      {filteredMembers.length === 0 ? (
        <div className="state-box">No members match the current search or status filter.</div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table data-table--sticky-identity group-members-roster__table">
              <thead>
                <tr>
                  <th className="data-table__identity">Name</th>
                  <th>Member number</th>
                  <th>Positions</th>
                  <th>Phone</th>
                  <th>Joined</th>
                  <th>Status</th>
                  {canManage ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map((member) => (
                  <tr key={member.id}>
                    <td className="data-table__identity">
                      <Link
                        className="table-link"
                        state={{ parentGroup: { id: group.id, name: group.name } } satisfies MemberDetailNavigationState}
                        to={`/communities/${group.community}/members/${member.id}`}
                      >
                        {memberName(member)}
                      </Link>
                    </td>
                    <td>{member.member_number || 'Not recorded'}</td>
                    <td>
                      {member.group_position || member.community_position ? (
                        <div className="member-position-tags">
                          {member.group_position ? (
                            <span><small>Group</small>{member.group_position}</span>
                          ) : null}
                          {member.community_position ? (
                            <span><small>Community</small>{member.community_position}</span>
                          ) : null}
                        </div>
                      ) : 'Member'}
                    </td>
                    <td>{member.phone || 'Not recorded'}</td>
                    <td>{formatDate(member.joined_on)}</td>
                    <td><StatusBadge status={member.status} /></td>
                    {canManage ? (
                      <td>
                        <button
                          aria-label={`Edit ${memberName(member)}`}
                          className="button button--secondary"
                          type="button"
                          onClick={() => onEditMember(member)}
                        >
                          Edit
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredMembers.length > groupMemberPageSize ? (
            <PaginationLabel
              page={page}
              pageCount={pageCount}
              total={filteredMembers.length}
              itemName="members"
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(pageCount, current + 1))}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function GroupResourcesTab({
  canManage,
  group,
  resources,
  resourcesLoading
}: {
  canManage: boolean;
  group: Group;
  resources: Resource[];
  resourcesLoading: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [ordering, setOrdering] = useState('name');
  const visibleResources = useMemo(() => {
    const query = search.trim().toLowerCase();
    const descending = ordering.startsWith('-');
    const key = descending ? ordering.slice(1) : ordering;
    const valueFor = (resource: Resource) => {
      if (key === 'program__thematic_area__name') return resource.thematic_area_name ?? '';
      if (key === 'program__name') return resource.program_name ?? '';
      if (key === 'resource_category__name') return resource.resource_category_name ?? '';
      if (key === 'resource_type') return resource.resource_type ?? '';
      if (key === 'quantity') return Number(resource.quantity ?? 0);
      if (key === 'status') return resource.status ?? '';
      return resource.name;
    };

    return resources
      .filter((resource) => !query || [
        resource.name,
        resource.thematic_area_name,
        resource.program_name,
        resource.resource_category_name,
        resource.resource_type,
        resource.owner_display
      ].some((value) => value?.toLowerCase().includes(query)))
      .sort((left, right) => {
        const leftValue = valueFor(left);
        const rightValue = valueFor(right);
        const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true });
        return descending ? -comparison : comparison;
      });
  }, [ordering, resources, search]);

  function changeOrdering(columnOrdering: string) {
    setOrdering((current) => current === columnOrdering ? reverseOrdering(columnOrdering) : columnOrdering);
  }

  if (resourcesLoading) {
    return <div className="state-box">Loading group resources...</div>;
  }
  return (
    <div className="group-resources-list">
      <div className="group-resources-list__header">
        <div>
          <strong>{resources.length} group-linked {resources.length === 1 ? 'resource' : 'resources'}</strong>
          <span>Classification and ownership context for this group.</span>
        </div>
        <label className="search-field">
          <SearchIcon aria-hidden="true" />
          <input
            aria-label="Search group resources"
            placeholder="Search resources"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {canManage ? (
          <button className="button button--primary" type="button" onClick={() => setCreateOpen(true)}>
            Add group-owned resource
          </button>
        ) : null}
      </div>
      {resources.length === 0 ? (
        <div className="state-box">
          No resources owned by or linked to this group are recorded yet.
        </div>
      ) : visibleResources.length === 0 ? (
        <div className="state-box">No group resources match this search.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table data-table--sticky-identity group-resources-table">
            <thead>
              <tr>
                <SortableTableHeader className="data-table__identity" currentOrdering={ordering} label="Resource" onChange={changeOrdering} ordering="name" />
                <SortableTableHeader currentOrdering={ordering} label="Thematic area" onChange={changeOrdering} ordering="program__thematic_area__name" />
                <SortableTableHeader currentOrdering={ordering} label="Program" onChange={changeOrdering} ordering="program__name" />
                <SortableTableHeader currentOrdering={ordering} label="Category" onChange={changeOrdering} ordering="resource_category__name" />
                <SortableTableHeader currentOrdering={ordering} label="Type" onChange={changeOrdering} ordering="resource_type" />
                <SortableTableHeader currentOrdering={ordering} label="Quantity" onChange={changeOrdering} ordering="quantity" />
                <th>Relationship</th>
                <th>Financial position</th>
                <SortableTableHeader currentOrdering={ordering} label="Status" onChange={changeOrdering} ordering="status" />
              </tr>
            </thead>
            <tbody>
              {visibleResources.map((resource) => (
                <tr key={resource.id}>
                  <td className="data-table__identity">
                    <Link
                      className="table-link"
                      state={{ resourceOrigin: {
                        label: group.name,
                        path: `/communities/${group.community}/groups/${group.id}`
                      } }}
                      to={`/resources/${resource.id}`}
                    >
                      {resource.name}
                    </Link>
                  </td>
                  <td>{resource.thematic_area_name ?? resource.thematic_areas?.map((area) => area.code).join(', ') ?? 'Not recorded'}</td>
                  <td>{resource.program_name ?? 'Not recorded'}</td>
                  <td>{resource.resource_category_name ?? 'Not recorded'}</td>
                  <td>{formatLabel(resource.resource_type)}</td>
                  <td>{formatResourceQuantity(resource)}</td>
                  <td>{resource.owner_type === 'group' && resource.owner_id === group.id
                    ? 'Owned by this group'
                    : `Linked · ${resource.owner_display ?? formatLabel(resource.owner_type)}`}</td>
                  <td>{resource.payment_summary
                    ? `${formatMoney(resource.payment_summary.total_paid, resource.payment_summary.currency)} paid · ${formatMoney(resource.payment_summary.remaining_amount, resource.payment_summary.currency)} remaining`
                    : formatMoney(resource.value_amount, resource.value_currency)}</td>
                  <td><StatusBadge status={resource.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {createOpen ? (
        <ResourceCreateDialog
          communityId={group.community}
          fixedOwner={{ id: group.id, label: group.name, type: 'group' }}
          onClose={() => setCreateOpen(false)}
          onCreated={() => setCreateOpen(false)}
        />
      ) : null}
    </div>
  );
}

function GroupTrainingsTab({
  canManage,
  committees,
  group,
  trainings,
  trainingsLoading
}: {
  canManage: boolean;
  committees: Committee[];
  group: Group;
  trainings: GroupActivityDisplay[];
  trainingsLoading: boolean;
}) {
  const today = useMemo(() => {
    const value = new Date();
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }, []);
  const [selectedTrainingId, setSelectedTrainingId] = useState<number | null>(null);
  const [activityDialog, setActivityDialog] = useState<
    { mode: 'create' } | { mode: 'edit' | 'duplicate'; activity: GroupActivity } | null
  >(null);
  const [selectedMonth, setSelectedMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [viewMode, setViewMode] = useState<'agenda' | 'calendar' | 'compact'>('agenda');
  const [activityType, setActivityType] = useState<'all' | 'Meeting' | 'Training'>('all');
  const [dateRange, setDateRange] = useState<'all' | 'month' | 'next_30' | 'past_3_months'>('month');
  const [recordStatus, setRecordStatus] = useState<
    'all' | 'planned' | 'complete' | 'needs_attention' | 'cancelled'
  >('all');
  const [sortOrder, setSortOrder] = useState<'attendance' | 'newest' | 'soonest' | 'title'>('soonest');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const selectedTraining = trainings.find((training) => training.id === selectedTrainingId);
  const visibleTrainings = useMemo(() => {
    const query = search.trim().toLowerCase();
    const nextThirtyDays = new Date(today);
    nextThirtyDays.setDate(nextThirtyDays.getDate() + 30);
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    return trainings
      .filter((training) => {
        const startDate = new Date(training.startDate);
        const matchesType = activityType === 'all' || training.category === activityType;
        const matchesStatus = recordStatus === 'all' || training.recordStatus === recordStatus;
        const matchesSearch = !query || [
          training.title,
          training.facilitator,
          training.location,
          training.focus
        ].some((value) => value.toLowerCase().includes(query));
        const matchesDate = dateRange === 'all'
          || (dateRange === 'month'
            && startDate.getFullYear() === selectedMonth.getFullYear()
            && startDate.getMonth() === selectedMonth.getMonth())
          || (dateRange === 'next_30' && startDate >= today && startDate <= nextThirtyDays)
          || (dateRange === 'past_3_months' && startDate >= threeMonthsAgo && startDate <= today);
        return matchesType && matchesStatus && matchesSearch && matchesDate;
      })
      .sort((left, right) => {
        if (sortOrder === 'newest') {
          return right.startDate.localeCompare(left.startDate);
        }
        if (sortOrder === 'title') {
          return left.title.localeCompare(right.title);
        }
        if (sortOrder === 'attendance') {
          const leftAttendance = left.attendance.women + left.attendance.men;
          const rightAttendance = right.attendance.women + right.attendance.men;
          return rightAttendance - leftAttendance;
        }
        return left.startDate.localeCompare(right.startDate);
      });
  }, [activityType, dateRange, recordStatus, search, selectedMonth, sortOrder, today, trainings]);
  const monthLabel = selectedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const daysInSelectedMonth = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth() + 1,
    0
  ).getDate();
  const firstWeekday = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth(),
    1
  ).getDay();
  const resultsLabel = dateRange === 'month'
    ? `Activity in ${monthLabel}`
    : dateRange === 'next_30'
      ? 'Next 30 days'
      : dateRange === 'past_3_months'
        ? 'Past three months'
        : 'All activity history';

  if (trainingsLoading) {
    return <div className="state-box">Loading trainings and meetings...</div>;
  }

  if (trainings.length === 0) {
    return (
      <div className="group-activity-empty state-box">
        <span>No trainings or meetings have been recorded for this group.</span>
        {canManage ? (
          <button className="button button--primary" type="button" onClick={() => setActivityDialog({ mode: 'create' })}>
            <PlusIcon aria-hidden="true" /> Add activity
          </button>
        ) : null}
        {activityDialog ? (
          <GroupActivityDialog committees={committees} group={group} onClose={() => setActivityDialog(null)} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="group-activity-browser">
      <div className="group-activity-period-row">
        <div className="group-activity-month-nav" aria-label="Visible activity month">
          <button
            aria-label="Previous month"
            type="button"
            onClick={() => {
              setSelectedMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
              setDateRange('month');
            }}
          >‹</button>
          <strong>{monthLabel}</strong>
          <button
            aria-label="Next month"
            type="button"
            onClick={() => {
              setSelectedMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
              setDateRange('month');
            }}
          >›</button>
          <button
            type="button"
            onClick={() => {
              setSelectedMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              setDateRange('month');
            }}
          >Today</button>
        </div>
        <div className="group-activity-view-switch" aria-label="Activity display style">
          {(['agenda', 'compact', 'calendar'] as const).map((view) => (
            <button
              aria-pressed={viewMode === view}
              key={view}
              type="button"
              onClick={() => setViewMode(view)}
            >{view.charAt(0).toUpperCase() + view.slice(1)}</button>
          ))}
          {canManage ? (
            <button className="button button--primary" type="button" onClick={() => setActivityDialog({ mode: 'create' })}>
              <PlusIcon aria-hidden="true" /> Add activity
            </button>
          ) : null}
        </div>
      </div>

      <div className="group-activity-toolbar">
        <label className="search-field">
          <SearchIcon aria-hidden="true" />
          <input
            aria-label="Search trainings and meetings"
            placeholder="Search title, facilitator, or location"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="group-activity-type-switch" aria-label="Filter by activity type">
          {(['all', 'Meeting', 'Training'] as const).map((type) => (
            <button
              aria-pressed={activityType === type}
              key={type}
              type="button"
              onClick={() => setActivityType(type)}
            >{type === 'all' ? 'All' : `${type}s`}</button>
          ))}
        </div>
        <button
          aria-expanded={filtersOpen}
          className="button button--secondary"
          type="button"
          onClick={() => setFiltersOpen((current) => !current)}
        >Filters</button>
      </div>

      {filtersOpen ? (
        <div className="group-activity-filters">
          <label>
            <span>Date range</span>
            <select
              aria-label="Filter activities by date range"
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value as typeof dateRange)}
            >
              <option value="month">Selected month</option>
              <option value="next_30">Next 30 days</option>
              <option value="past_3_months">Past 3 months</option>
              <option value="all">All history</option>
            </select>
          </label>
          <label>
            <span>Record status</span>
            <select
              aria-label="Filter activities by record status"
              value={recordStatus}
              onChange={(event) => setRecordStatus(event.target.value as typeof recordStatus)}
            >
              <option value="all">All records</option>
              <option value="needs_attention">Needs attention</option>
              <option value="complete">Complete records</option>
              <option value="planned">Planned</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label>
            <span>Sort by</span>
            <select
              aria-label="Sort trainings and meetings"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}
            >
              <option value="soonest">Soonest first</option>
              <option value="newest">Newest first</option>
              <option value="title">Title A-Z</option>
              <option value="attendance">Attendance</option>
            </select>
          </label>
        </div>
      ) : null}

      <div className="group-activity-results-heading">
        <div>
          <h3>{resultsLabel}</h3>
          <span>{formatCount(visibleTrainings.length)} {visibleTrainings.length === 1 ? 'activity' : 'activities'}</span>
        </div>
        <span>Showing up to 25 results</span>
      </div>

      {visibleTrainings.length === 0 ? (
        <div className="state-box">No trainings or meetings match these filters.</div>
      ) : null}

      {visibleTrainings.length > 0 && viewMode === 'agenda' ? (
        <div className="group-activity-agenda" aria-label="Training and meeting agenda">
          {visibleTrainings.slice(0, 25).map((training) => (
            <button
              className="group-activity-row"
              key={training.id}
              type="button"
              onClick={() => setSelectedTrainingId(training.id)}
            >
              <time dateTime={training.startDate}>
                <strong>{training.startDay}</strong>
                <span>{new Date(training.startDate).toLocaleDateString(undefined, { month: 'short' })}</span>
              </time>
              <span className="group-activity-row__main">
                <span className={`group-event-category ${training.category === 'Meeting' ? 'is-meeting' : ''}`}>
                  {training.category}
                </span>
                <strong>{training.title}</strong>
                <small>{training.location}</small>
              </span>
              <span className="group-activity-row__meta">
                <span>{training.facilitator}</span>
                <span>
                  {training.recordStatus === 'planned'
                    ? `${formatCount(training.source.expected_participant_count ?? 0)} expected`
                    : `${formatCount(training.attendance.women + training.attendance.men)} attendees`}
                </span>
              </span>
              <span className={`group-activity-record-status ${training.recordStatus === 'complete' ? 'is-complete' : ''}`}>
                {training.reportStatus}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {visibleTrainings.length > 0 && viewMode === 'compact' ? (
        <div className="table-wrap">
          <table className="data-table group-activity-compact-table">
            <thead>
              <tr><th>Date</th><th>Activity</th><th>Type</th><th>Facilitator</th><th>Attendance</th><th>Record status</th></tr>
            </thead>
            <tbody>
              {visibleTrainings.slice(0, 25).map((training) => (
                <tr key={training.id}>
                  <td>{formatDate(training.startDate)}</td>
                  <td><button className="table-link" type="button" onClick={() => setSelectedTrainingId(training.id)}>{training.title}</button></td>
                  <td>{training.category}</td>
                  <td>{training.facilitator}</td>
                  <td>
                    {training.recordStatus === 'planned'
                      ? `${formatCount(training.source.expected_participant_count ?? 0)} expected`
                      : formatCount(training.attendance.women + training.attendance.men)}
                  </td>
                  <td>{training.reportStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {viewMode === 'calendar' ? (
        <div className="group-activity-calendar" aria-label={`${monthLabel} activity calendar`}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <strong key={day}>{day}</strong>)}
          {Array.from({ length: firstWeekday }, (_, index) => <span aria-hidden="true" key={`blank-${index}`} />)}
          {Array.from({ length: daysInSelectedMonth }, (_, index) => {
            const day = index + 1;
            const activities = visibleTrainings.filter((training) => {
              const date = new Date(training.startDate);
              return date.getFullYear() === selectedMonth.getFullYear()
                && date.getMonth() === selectedMonth.getMonth()
                && day >= training.startDay
                && day <= training.endDay;
            });
            return (
              <div className={activities.length > 0 ? 'has-activity' : ''} key={day}>
                <span>{day}</span>
                {activities.map((training) => (
                  <button key={training.id} type="button" onClick={() => setSelectedTrainingId(training.id)}>
                    {training.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="group-activity-history-bar">
        <span>{dateRange === 'all' ? 'Showing the complete available history.' : 'Older activity is kept out of the default view.'}</span>
        {dateRange !== 'all' ? (
          <button className="button button--secondary" type="button" onClick={() => {
            setDateRange('all');
            setViewMode('compact');
          }}>Browse all history</button>
        ) : null}
      </div>

      {selectedTraining ? (
        <GroupTrainingDetailPanel
          canManage={canManage}
          groupName={group.name}
          training={selectedTraining}
          onClose={() => setSelectedTrainingId(null)}
          onDuplicate={() => setActivityDialog({ mode: 'duplicate', activity: selectedTraining.source })}
          onEdit={() => setActivityDialog({ mode: 'edit', activity: selectedTraining.source })}
        />
      ) : null}
      {activityDialog ? (
        <GroupActivityDialog
          activity={activityDialog.mode === 'edit' ? activityDialog.activity : undefined}
          committees={committees}
          group={group}
          onClose={() => setActivityDialog(null)}
          template={activityDialog.mode === 'duplicate' ? activityDialog.activity : undefined}
        />
      ) : null}
    </div>
  );
}

function GroupTrainingDetailPanel({
  canManage,
  groupName,
  onClose,
  onDuplicate,
  onEdit,
  training
}: {
  canManage: boolean;
  groupName: string;
  onClose: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  training: GroupActivityDisplay;
}) {
  const totalAttendance = training.attendance.women + training.attendance.men;
  const maxChartValue = Math.max(
    1,
    training.attendance.men,
    training.attendance.women,
    ...training.ageBands.flatMap((band) => [band.men, band.women])
  );
  const yAxisMidpoint = Math.ceil(maxChartValue / 2);

  return (
    <aside className="group-training-detail" aria-label="Selected activity details">
      <section>
        <div className="group-training-detail__header">
          <div>
            <span className="record-detail__eyebrow">Selected {training.category.toLowerCase()}</span>
            <h3>{training.title}</h3>
          </div>
          <div className="row-actions">
            {canManage ? (
              <>
                <button className="button button--secondary" type="button" onClick={onDuplicate}>Schedule next</button>
                <button className="button button--primary" type="button" onClick={onEdit}>Edit activity</button>
              </>
            ) : null}
            <button className="button button--secondary" type="button" onClick={onClose}>Close details</button>
          </div>
        </div>
        <p>{training.dateRange} · {training.location}</p>
        <dl className="group-training-detail__facts">
          <div>
            <dt>Facilitator</dt>
            <dd>{training.facilitator}</dd>
          </div>
          <div>
            <dt>Focus</dt>
            <dd>{training.focus}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h4>{groupName} attendees</h4>
        <ul className="group-training-attendee-groups">
          <li>
            {training.recordStatus === 'planned'
              ? `${formatCount(training.source.expected_participant_count ?? 0)} participants expected`
              : `${formatCount(totalAttendance)} total participants from this group`}
          </li>
          {training.recordStatus !== 'planned' ? (
            <>
              <li>{formatCount(training.attendance.women)} women</li>
              <li>{formatCount(training.attendance.men)} men</li>
            </>
          ) : null}
        </ul>
      </section>

      {training.ageBands.length > 0 ? <section>
        <div className="group-training-chart-header">
          <div>
            <h4>Attendance by age band</h4>
            <span>Participants, split by gender</span>
          </div>
          <div className="group-training-legend">
            <span><i className="is-men" /> Men</span>
            <span><i className="is-women" /> Women</span>
          </div>
        </div>
        <div className="group-training-chart-shell">
          <div className="group-training-chart-frame">
            <div className="group-training-chart-y-scale" aria-hidden="true">
              <span>{maxChartValue}</span>
              <span>{yAxisMidpoint}</span>
              <span>0</span>
            </div>
            <div className="group-training-chart" aria-label="Training attendance by age and gender">
              {training.ageBands.map((band) => (
                <div className="group-training-chart__band" key={band.label}>
                  <div>
                    <span
                      className="is-men"
                      style={{ height: `${Math.max(12, (band.men / maxChartValue) * 100)}%` }}
                    >
                      {band.men}
                    </span>
                    <span
                      className="is-women"
                      style={{ height: `${Math.max(12, (band.women / maxChartValue) * 100)}%` }}
                    >
                      {band.women}
                    </span>
                  </div>
                  <strong>{band.label}</strong>
                  <small>{formatCount(band.men + band.women)}</small>
                </div>
              ))}
              <div className="group-training-chart__band is-total">
                <div>
                  <span className="is-men" style={{ height: `${Math.max(12, (training.attendance.men / maxChartValue) * 100)}%` }}>
                    {training.attendance.men}
                  </span>
                  <span className="is-women" style={{ height: `${Math.max(12, (training.attendance.women / maxChartValue) * 100)}%` }}>
                    {training.attendance.women}
                  </span>
                </div>
                <strong>Total</strong>
                <small>{formatCount(totalAttendance)}</small>
              </div>
            </div>
          </div>
        </div>
      </section> : null}

      <section>
        <h4>Reports submitted</h4>
        <span className="group-training-card__status">{training.reportStatus}</span>
        <div className="group-training-reports">
          {training.reports.map((report) => (
            <span key={report}>{report}</span>
          ))}
        </div>
      </section>
    </aside>
  );
}

function GroupCommitteesTab({
  committeeMemberships,
  committees,
  committeesLoading,
  members
}: {
  committeeMemberships: CommitteeMembership[];
  committees: Committee[];
  committeesLoading: boolean;
  members: Member[];
}) {
  if (committeesLoading) {
    return <div className="state-box">Loading group committee participation...</div>;
  }
  if (committees.length === 0) {
    return (
      <div className="state-box">
        No committees are linked through this group&apos;s current members yet.
      </div>
    );
  }

  const membershipsByCommittee = committeeMemberships.reduce<Record<number, CommitteeMembership[]>>(
    (current, membership) => ({
      ...current,
      [membership.committee]: [...(current[membership.committee] ?? []), membership]
    }),
    {}
  );
  const memberById = new Map(members.map((member) => [member.id, member]));

  return (
    <div className="group-committee-grid">
      {committees.map((committee) => {
        const memberships = membershipsByCommittee[committee.id] ?? [];
        return (
          <article className="group-committee-card" key={committee.id}>
            <header>
              <Link to={`/communities/${committee.community}/committees/${committee.id}`}>
                <strong>{committee.name}</strong>
              </Link>
              <span>{formatLabel(committee.committee_type)}</span>
              <StatusBadge status={committee.status} />
            </header>
            <dl>
              <div>
                <dt>Formed</dt>
                <dd>{formatDate(committee.formed_on)}</dd>
              </div>
              <div>
                <dt>Group participants</dt>
                <dd>{formatCount(memberships.length)}</dd>
              </div>
            </dl>
            <div className="group-committee-card__members">
              {memberships.map((membership) => {
                const member = memberById.get(membership.member);
                return (
                  <span key={membership.id}>
                    <strong>{member ? memberName(member) : `Member #${membership.member}`}</strong>
                    <small>{membership.role_name || 'Member'} · since {formatDate(membership.start_date)}</small>
                  </span>
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MemberDetailContent({ member }: { member: Member }) {
  const resourcesQuery = useResourcesQuery(
    { page: 1, page_size: 100, linked_member: member.id, ordering: 'name' },
    Boolean(member.id)
  );
  const resources = resourcesQuery.data?.results ?? [];
  return (
    <>
      <DetailSection title="Personal details">
        <dl className="record-detail__grid">
          <DetailItem label="Member #" value={member.member_number || 'Not recorded'} />
          <DetailItem label="Preferred name" value={member.preferred_name || 'Not recorded'} />
          <DetailItem label="Phone" value={member.phone || 'Not recorded'} />
          <DetailItem label="Email" value={member.email ? <a href={`mailto:${member.email}`}>{member.email}</a> : 'Not recorded'} />
          <DetailItem label="Gender" value={formatLabel(member.gender)} />
          <DetailItem label="Date of birth" value={formatDate(member.date_of_birth)} />
        </dl>
      </DetailSection>
      <DetailSection title="Participation">
        <dl className="record-detail__grid">
          <DetailItem
            label="Current group"
            value={
              member.group_name ? (
                <Link to={`/communities/${member.community}/groups/${member.group}`}>{member.group_name}</Link>
              ) : (
                `Group #${member.group}`
              )
            }
          />
          <DetailItem label="Group position" value={member.group_position || 'Member'} />
          <DetailItem
            label="Community / political position"
            value={member.community_position || 'Not recorded'}
          />
          <DetailItem label="Joined" value={formatDate(member.joined_on)} />
          <DetailItem label="Left" value={formatDate(member.left_on)} />
          <DetailItem label="Deceased" value={formatDate(member.deceased_on)} />
        </dl>
      </DetailSection>
      <DetailSection title="Address and notes">
        <dl className="record-detail__grid">
          <DetailItem label="Address" value={member.address_text || 'Not recorded'} />
        </dl>
        {member.notes ? <p className="record-detail__notes">{member.notes}</p> : null}
      </DetailSection>
      <DetailSection title="Resources and repayments">
        {resourcesQuery.isLoading ? <div className="state-box">Loading linked resources...</div> : null}
        {resourcesQuery.isError ? <div className="state-box state-box--error">Unable to load linked resources.</div> : null}
        {!resourcesQuery.isLoading && !resourcesQuery.isError && resources.length === 0 ? (
          <div className="state-box">No individual or household resources are linked to this member.</div>
        ) : null}
        <div className="resource-party-list">
          {resources.map((resource) => (
            <Link
              key={resource.id}
              state={{ resourceOrigin: {
                label: memberName(member),
                path: `/communities/${member.community}/members/${member.id}`
              } }}
              to={`/resources/${resource.id}`}
            >
              <span>
                <strong>{resource.name}</strong>
                {formatLabel(resource.resource_type)} · {resource.owner_id === member.id && resource.owner_type === 'member' ? 'Owner' : 'Beneficiary'}
              </span>
              <small>
                {resource.payment_summary
                  ? `${formatMoney(resource.payment_summary.total_paid, resource.payment_summary.currency)} paid · ${formatMoney(resource.payment_summary.remaining_amount, resource.payment_summary.currency)} remaining`
                  : formatLabel(resource.status)}
              </small>
            </Link>
          ))}
        </div>
      </DetailSection>
    </>
  );
}

function CommitteeDetailContent({
  canManage,
  committee,
  memberships,
  membershipsCount,
  membershipsError,
  membershipsLoading
}: {
  canManage: boolean;
  committee: Committee;
  memberships: CommitteeMembership[];
  membershipsCount: number;
  membershipsError: boolean;
  membershipsLoading: boolean;
}) {
  const [membershipDialog, setMembershipDialog] = useState<CommitteeMembership | 'create' | null>(null);
  const activeMembershipsQuery = useCommitteeMembershipsQuery({
    committee: committee.id,
    status: 'active',
    page: 1,
    page_size: 1
  });
  const activeMembershipCount = activeMembershipsQuery.data?.count;
  return (
    <>
      <DetailSection title="Committee details">
        <dl className="record-detail__grid">
          <DetailItem label="Type" value={formatLabel(committee.committee_type)} />
          <DetailItem label="Formed" value={formatDate(committee.formed_on)} />
          <DetailItem label="Closed" value={formatDate(committee.closed_on)} />
          <DetailItem label="Active members" value={membershipsLoading || activeMembershipsQuery.isLoading ? 'Loading...' : formatCount(activeMembershipCount)} />
          <DetailItem label="Former members" value={membershipsLoading || activeMembershipsQuery.isLoading ? 'Loading...' : formatCount(Math.max(0, membershipsCount - (activeMembershipCount ?? 0)))} />
        </dl>
        {committee.description ? <p className="record-detail__notes">{committee.description}</p> : null}
      </DetailSection>
      <DetailSection title="Committee members">
        {canManage ? <button className="button button--secondary" type="button" onClick={() => setMembershipDialog('create')}>Add member</button> : null}
        {membershipsLoading ? <div className="state-box">Loading committee members...</div> : null}
        {membershipsError ? <div className="state-box state-box--error">Committee members could not be loaded. Try again.</div> : null}
        {!membershipsLoading && !membershipsError && memberships.length === 0 ? (
          <div className="state-box">No members are recorded for this committee yet.</div>
        ) : null}
        {!membershipsLoading && !membershipsError && memberships.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table data-table--sticky-identity">
              <thead>
                <tr>
                  <th className="data-table__identity">Member</th>
                  <th>Group</th>
                  <th>Role</th>
                  <th>Gender</th>
                  <th>Joined</th>
                  <th>Status</th>
                  {canManage ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {memberships.map((membership) => (
                  <tr key={membership.id}>
                    <td className="data-table__identity">
                      <Link to={`/communities/${committee.community}/members/${membership.member}`}>
                        {membership.member_name || `Member #${membership.member}`}
                      </Link>
                      {membership.member_number ? <small className="table-cell-note">{membership.member_number}</small> : null}
                    </td>
                    <td>
                      {membership.member_group_id ? (
                        <Link to={`/communities/${committee.community}/groups/${membership.member_group_id}`}>
                          {membership.member_group_name || `Group #${membership.member_group_id}`}
                        </Link>
                      ) : 'Not recorded'}
                    </td>
                    <td>{membership.role_name || 'Member'}</td>
                    <td>{formatLabel(membership.member_gender)}</td>
                    <td>{formatDate(membership.start_date)}</td>
                    <td><StatusBadge status={membership.status} /></td>
                    {canManage ? <td><button className="table-link" type="button" onClick={() => setMembershipDialog(membership)}>Edit</button></td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {membershipsCount > memberships.length ? <p className="state-box">Showing {memberships.length} of {membershipsCount} memberships.</p> : null}
      </DetailSection>
      <EntityActivitiesSection
        canManage={canManage}
        community={committee.community}
        partyId={committee.id}
        partyName={committee.name}
        partyType="committee"
      />
      {membershipDialog ? (
        <ParticipationMembershipDialog
          community={committee.community}
          kind="committee"
          membership={membershipDialog === 'create' ? undefined : membershipDialog}
          onClose={() => setMembershipDialog(null)}
          parentId={committee.id}
        />
      ) : null}
    </>
  );
}

function CooperativeDetailContent({
  canManage,
  cooperative
}: {
  canManage: boolean;
  cooperative: Cooperative;
}) {
  const membershipsQuery = useCooperativeMembershipsQuery(
    { cooperative: cooperative.id, page: 1, page_size: 200, ordering: 'start_date' }
  );
  const activeMembershipsQuery = useCooperativeMembershipsQuery(
    { cooperative: cooperative.id, status: 'active', page: 1, page_size: 1 }
  );
  const memberships = membershipsQuery.data?.results ?? [];
  const activeMembershipCount = activeMembershipsQuery.data?.count;
  const membershipCount = membershipsQuery.data?.count ?? memberships.length;
  return (
    <>
      <DetailSection title="Cooperative overview">
        <dl className="record-detail__grid">
          <DetailItem label="Type" value={formatLabel(cooperative.cooperative_type)} />
          <DetailItem label="Formed" value={formatDate(cooperative.formed_on)} />
          <DetailItem label="Closed" value={formatDate(cooperative.closed_on)} />
          <DetailItem label="Active members" value={membershipsQuery.isLoading || activeMembershipsQuery.isLoading ? 'Loading...' : formatCount(activeMembershipCount)} />
          <DetailItem label="Former members" value={membershipsQuery.isLoading || activeMembershipsQuery.isLoading ? 'Loading...' : formatCount(Math.max(0, membershipCount - (activeMembershipCount ?? 0)))} />
        </dl>
        {cooperative.description ? <p className="record-detail__notes">{cooperative.description}</p> : null}
      </DetailSection>
      <MembershipRoster
        canManage={canManage}
        community={cooperative.community}
        emptyLabel="No members are recorded for this cooperative yet."
        isLoading={membershipsQuery.isLoading}
        isError={membershipsQuery.isError}
        memberships={memberships}
        membershipCount={membershipCount}
        parentId={cooperative.id}
        title="Cooperative members"
      />
      <EntityActivitiesSection canManage={canManage} community={cooperative.community} partyId={cooperative.id} partyName={cooperative.name} partyType="cooperative" />
      <EntityResourcesSection community={cooperative.community} partyId={cooperative.id} partyName={cooperative.name} partyType="cooperative" />
      <EntityImpactSection partyId={cooperative.id} partyType="cooperative" />
    </>
  );
}

function InstitutionDetailContent({
  canManage,
  institution
}: {
  canManage: boolean;
  institution: Institution;
}) {
  return (
    <>
      <DetailSection title="Institution overview">
        <dl className="record-detail__grid">
          <DetailItem label="Code" value={institution.code || 'Not recorded'} />
          <DetailItem label="Type" value={formatLabel(institution.institution_type)} />
          <DetailItem label="Contact" value={institution.contact_name || 'Not recorded'} />
          <DetailItem label="Phone" value={institution.phone ? <a href={`tel:${institution.phone}`}>{institution.phone}</a> : 'Not recorded'} />
          <DetailItem label="Email" value={institution.email ? <a href={`mailto:${institution.email}`}>{institution.email}</a> : 'Not recorded'} />
          <DetailItem label="Location" value={institution.location_text || 'Not recorded'} />
        </dl>
        {institution.notes ? <p className="record-detail__notes">{institution.notes}</p> : null}
      </DetailSection>
      <EntityActivitiesSection canManage={canManage} community={institution.community} partyId={institution.id} partyName={institution.name} partyType="institution" />
      <EntityResourcesSection community={institution.community} partyId={institution.id} partyName={institution.name} partyType="institution" />
      <EntityImpactSection partyId={institution.id} partyType="institution" />
    </>
  );
}

function MembershipRoster({
  canManage,
  community,
  emptyLabel,
  isLoading,
  isError,
  memberships,
  membershipCount,
  parentId,
  title
}: {
  canManage: boolean;
  community: number;
  emptyLabel: string;
  isLoading: boolean;
  isError: boolean;
  memberships: CooperativeMembership[];
  membershipCount: number;
  parentId: number;
  title: string;
}) {
  const [membershipDialog, setMembershipDialog] = useState<CooperativeMembership | 'create' | null>(null);
  return (
    <DetailSection title={title}>
      {canManage ? <button className="button button--secondary" type="button" onClick={() => setMembershipDialog('create')}>Add member</button> : null}
      {isLoading ? <div className="state-box">Loading members...</div> : null}
      {isError ? <div className="state-box state-box--error">Members could not be loaded. Try again.</div> : null}
      {!isLoading && !isError && memberships.length === 0 ? <div className="state-box">{emptyLabel}</div> : null}
      {!isLoading && !isError && memberships.length > 0 ? (
        <div className="table-wrap"><table className="data-table data-table--sticky-identity">
          <thead><tr><th className="data-table__identity">Member</th><th>Group</th><th>Role</th><th>Gender</th><th>Joined</th><th>Status</th>{canManage ? <th>Actions</th> : null}</tr></thead>
          <tbody>{memberships.map((membership) => (
            <tr key={membership.id}>
              <td className="data-table__identity"><Link to={`/communities/${community}/members/${membership.member}`}>{membership.member_name || `Member #${membership.member}`}</Link>{membership.member_number ? <small className="table-cell-note">{membership.member_number}</small> : null}</td>
              <td>{membership.member_group_id ? <Link to={`/communities/${community}/groups/${membership.member_group_id}`}>{membership.member_group_name || `Group #${membership.member_group_id}`}</Link> : 'Not recorded'}</td>
              <td>{membership.role_name || 'Member'}</td>
              <td>{formatLabel(membership.member_gender)}</td>
              <td>{formatDate(membership.start_date)}</td>
              <td><StatusBadge status={membership.status} /></td>
              {canManage ? <td><button className="table-link" type="button" onClick={() => setMembershipDialog(membership)}>Edit</button></td> : null}
            </tr>
          ))}</tbody>
        </table></div>
      ) : null}
      {membershipCount > memberships.length ? <p className="state-box">Showing {memberships.length} of {membershipCount} memberships.</p> : null}
      {membershipDialog ? (
        <ParticipationMembershipDialog
          community={community}
          kind="cooperative"
          membership={membershipDialog === 'create' ? undefined : membershipDialog}
          onClose={() => setMembershipDialog(null)}
          parentId={parentId}
        />
      ) : null}
    </DetailSection>
  );
}

function EntityActivitiesSection({ canManage, community, partyId, partyName, partyType }: {
  canManage: boolean;
  community: number;
  partyId: number;
  partyName: string;
  partyType: ActivityPartyType;
}) {
  const [dialogActivity, setDialogActivity] = useState<GroupActivity | 'create' | null>(null);
  const query = useGroupActivitiesQuery({ party_type: partyType, party_id: partyId, page: 1, page_size: 100, ordering: '-starts_at' });
  const activities = query.data?.results ?? [];
  return (
    <DetailSection title="Trainings & meetings">
      {canManage ? <button className="button button--secondary" type="button" onClick={() => setDialogActivity('create')}>Add activity</button> : null}
      {query.isLoading ? <div className="state-box">Loading activities...</div> : null}
      {query.isError ? <div className="state-box state-box--error">Activities could not be loaded. Try again.</div> : null}
      {!query.isLoading && !query.isError && activities.length === 0 ? <div className="state-box">No trainings or meetings are linked yet.</div> : null}
      {activities.length > 0 ? <div className="resource-party-list">{activities.map((activity) => (
        <article key={activity.id}>
          <span><strong>{activity.title}</strong>{formatLabel(activity.activity_type)} · {formatDate(activity.starts_at)}</span>
          <small>{(activity.parties ?? []).map((party) => `${formatLabel(party.role)}: ${party.party_name || `${formatLabel(party.party_type)} #${party.party_id}`}`).join(' · ')}</small>
          {canManage ? <button className="table-link" type="button" onClick={() => setDialogActivity(activity)}>Edit activity</button> : null}
        </article>
      ))}</div> : null}
      {(query.data?.count ?? 0) > activities.length ? <p className="state-box">Showing {activities.length} of {query.data?.count} activities.</p> : null}
      {dialogActivity ? (
        <GroupActivityDialog
          activity={dialogActivity === 'create' ? undefined : dialogActivity}
          context={{ community, party_id: partyId, party_name: partyName, party_type: partyType }}
          onClose={() => setDialogActivity(null)}
        />
      ) : null}
    </DetailSection>
  );
}

function EntityResourcesSection({ community, partyId, partyName, partyType }: {
  community: number;
  partyId: number;
  partyName: string;
  partyType: 'cooperative' | 'institution';
}) {
  const query = useResourcesQuery({ community, linked_party_type: partyType, linked_party_id: partyId, page: 1, page_size: 100, ordering: 'name' });
  const resources = query.data?.results ?? [];
  return (
    <DetailSection title="Resources and repayments">
      {query.isLoading ? <div className="state-box">Loading linked resources...</div> : null}
      {query.isError ? <div className="state-box state-box--error">Linked resources could not be loaded. Try again.</div> : null}
      {!query.isLoading && !query.isError && resources.length === 0 ? <div className="state-box">No resources are linked to {partyName}.</div> : null}
      <div className="resource-party-list">{resources.map((resource) => (
        <Link key={resource.id} state={{ resourceOrigin: { label: partyName, path: `/communities/${community}/${partyType === 'cooperative' ? 'cooperatives' : 'institutions'}/${partyId}` } }} to={`/resources/${resource.id}`}>
          <span><strong>{resource.name}</strong>{formatLabel(resource.resource_type)} · {resource.owner_type === partyType && resource.owner_id === partyId ? 'Owner' : 'Beneficiary'}</span>
          <small>{resource.payment_summary ? `${formatMoney(resource.payment_summary.total_paid, resource.payment_summary.currency)} paid · ${formatMoney(resource.payment_summary.remaining_amount, resource.payment_summary.currency)} remaining` : formatLabel(resource.status)}</small>
        </Link>
      ))}</div>
      {(query.data?.count ?? 0) > resources.length ? <p className="state-box">Showing {resources.length} of {query.data?.count} linked resources.</p> : null}
    </DetailSection>
  );
}

function EntityImpactSection({ partyId, partyType }: { partyId: number; partyType: 'cooperative' | 'institution' }) {
  const query = useImpactRecordsQuery({ beneficiary_type: partyType, beneficiary_id: partyId, page: 1, page_size: 100, ordering: '-as_of_date' });
  const records = query.data?.results ?? [];
  return (
    <DetailSection title="Impact">
      {query.isLoading ? <div className="state-box">Loading impact records...</div> : null}
      {query.isError ? <div className="state-box state-box--error">Impact records could not be loaded. Try again.</div> : null}
      {!query.isLoading && !query.isError && records.length === 0 ? <div className="state-box">No direct impact records are linked yet.</div> : null}
      {records.length > 0 ? <div className="table-wrap"><table className="data-table"><thead><tr><th>As of</th><th>Beneficiaries</th><th>Households</th><th>Members</th><th>Method</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{formatDate(record.as_of_date)}</td><td>{formatCount(record.beneficiary_count)}</td><td>{formatCount(record.household_count)}</td><td>{formatCount(record.member_count)}</td><td>{formatLabel(record.method)}</td></tr>)}</tbody></table></div> : null}
      {(query.data?.count ?? 0) > records.length ? <p className="state-box">Showing {records.length} of {query.data?.count} impact records.</p> : null}
    </DetailSection>
  );
}

function GenericRecordDetail({
  activeSection,
  record
}: {
  activeSection: SectionKey;
  record: BreakdownRecord;
}) {
  const rows = tableConfigs[activeSection].exportRows([record]).at(0) ?? {};
  return (
    <DetailSection title="Record fields">
      <dl className="record-detail__grid">
        {Object.entries(rows)
          .filter(([, value]) => value !== undefined && value !== null && value !== '')
          .slice(0, 12)
          .map(([key, value]) => (
            <DetailItem key={key} label={formatLabel(key)} value={String(value)} />
          ))}
      </dl>
    </DetailSection>
  );
}

export function CommunityDetailPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { communityId, section = 'groups', recordId } = useParams();
  const activeSection = isSectionKey(section) ? section : 'groups';
  const selectedRecordId = recordId && /^\d+$/.test(recordId) ? Number(recordId) : null;
  const manageCapability =
    activeSection === 'resources'
      ? capabilities.manageResources
      : activeSection === 'impact'
        ? capabilities.manageImpact
        : capabilities.manageOperations;
  const archiveCapability =
    activeSection === 'resources'
      ? capabilities.archiveResources
      : activeSection === 'impact'
        ? capabilities.archiveImpact
        : capabilities.archiveOperations;
  const canManage = hasCapability(user, manageCapability);
  const canManageCommunity = hasCapability(user, capabilities.manageOperations);
  const canArchive = hasCapability(user, archiveCapability);
  const canDeletePermanently = hasCapability(user, capabilities.mvpDeletePermanently);
  const canExport = hasCapability(user, capabilities.export);
  const visibleSections = user?.roles.includes('communications_viewer')
    ? sections.filter((item) => !['members', 'institutions'].includes(item.key))
    : sections;
  const sectionConfig = sections.find((item) => item.key === activeSection) ?? sections[0];
  const tableConfig = tableConfigs[activeSection];
  const requestedOrdering = searchParams.get('ordering');
  const validOrderings = tableConfig.columns.flatMap((column) =>
    column.ordering ? [column.ordering, reverseOrdering(column.ordering)] : []
  );
  const ordering = requestedOrdering && validOrderings.includes(requestedOrdering)
    ? requestedOrdering
    : sectionConfig.ordering;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editCommunityOpen, setEditCommunityOpen] = useState(false);
  const [creatingMemberForGroup, setCreatingMemberForGroup] = useState<Group | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null);
  const [editingCommittee, setEditingCommittee] = useState<Committee | null>(null);
  const [editingCooperative, setEditingCooperative] = useState<Cooperative | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [editingImpactRecord, setEditingImpactRecord] = useState<ImpactRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [archiveTargets, setArchiveTargets] = useState<ArchiveRecordTarget[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ArchiveRecordTarget | null>(null);
  const query = useCommunityQuery(communityId);
  const community = query.data;
  const listParams = useMemo(
    () => ({
      community: communityId,
      page,
      page_size: sectionPageSize,
      search,
      ordering
    }),
    [communityId, ordering, page, search]
  );
  const enabled = Boolean(communityId);
  const memberQuery = useMembersQuery(listParams, enabled && activeSection === 'members');
  const groupQuery = useGroupsQuery(listParams, enabled && activeSection === 'groups');
  const institutionQuery = useInstitutionsQuery(listParams, enabled && activeSection === 'institutions');
  const cooperativeQuery = useCooperativesQuery(listParams, enabled && activeSection === 'cooperatives');
  const committeeQuery = useCommitteesQuery(listParams, enabled && activeSection === 'committees');
  const resourceQuery = useResourcesQuery(listParams, enabled && activeSection === 'resources');
  const impactQuery = useImpactRecordsQuery(listParams, enabled && activeSection === 'impact');
  const sectionQuery = {
    members: memberQuery,
    groups: groupQuery,
    institutions: institutionQuery,
    cooperatives: cooperativeQuery,
    committees: committeeQuery,
    resources: resourceQuery,
    impact: impactQuery
  }[activeSection] as {
    data?: PaginatedResponse<Member | Group | Institution | Committee | Cooperative | Resource | ImpactRecord>;
    isLoading: boolean;
    isError: boolean;
  };
  const records = sectionQuery.data?.results ?? [];
  const rows = tableConfig.toRows(records);
  const selectedRecordFromPage = selectedRecordId
    ? records.find((record) => record.id === selectedRecordId) ?? null
    : null;
  const groupDetailQuery = useGroupQuery(
    selectedRecordId ?? undefined,
    activeSection === 'groups' && Boolean(selectedRecordId)
  );
  const memberDetailQuery = useMemberQuery(
    selectedRecordId ?? undefined,
    activeSection === 'members' && Boolean(selectedRecordId)
  );
  const committeeDetailQuery = useCommitteeQuery(
    selectedRecordId ?? undefined,
    activeSection === 'committees' && Boolean(selectedRecordId)
  );
  const cooperativeDetailQuery = useCooperativeQuery(
    selectedRecordId ?? undefined,
    activeSection === 'cooperatives' && Boolean(selectedRecordId)
  );
  const institutionDetailQuery = useInstitutionQuery(
    selectedRecordId ?? undefined,
    activeSection === 'institutions' && Boolean(selectedRecordId)
  );
  const selectedRecord =
    activeSection === 'groups'
      ? groupDetailQuery.data ?? selectedRecordFromPage
      : activeSection === 'members'
        ? memberDetailQuery.data ?? selectedRecordFromPage
        : activeSection === 'committees'
          ? committeeDetailQuery.data ?? selectedRecordFromPage
          : activeSection === 'cooperatives'
            ? cooperativeDetailQuery.data ?? selectedRecordFromPage
            : activeSection === 'institutions'
              ? institutionDetailQuery.data ?? selectedRecordFromPage
              : selectedRecordFromPage;
  const selectedCommitteeMembershipParams = useMemo(
    () => ({
      committee: selectedRecordId ?? undefined,
      page: 1,
      page_size: 200,
      ordering: 'start_date'
    }),
    [selectedRecordId]
  );
  const selectedCommitteeMembershipsQuery = useCommitteeMembershipsQuery(
    selectedCommitteeMembershipParams,
    activeSection === 'committees' && Boolean(selectedRecordId)
  );
  const selectedCommitteeMemberships = selectedCommitteeMembershipsQuery.data?.results ?? [];
  const selectedGroupMembersQuery = useGroupMembersQuery(
    activeSection === 'groups' ? (selectedRecordId ?? undefined) : undefined,
    activeSection === 'groups' && Boolean(selectedRecordId)
  );
  const selectedGroupMembers = selectedGroupMembersQuery.data ?? [];
  const selectedGroupActivityParams = useMemo(
    () => ({
      community: communityId,
      group: selectedRecordId ?? undefined,
      page: 1,
      page_size: 500,
      ordering: 'starts_at'
    }),
    [communityId, selectedRecordId]
  );
  const selectedGroupActivitiesQuery = useGroupActivitiesQuery(
    selectedGroupActivityParams,
    activeSection === 'groups' && Boolean(selectedRecordId)
  );
  const selectedGroupActivities = selectedGroupActivitiesQuery.data?.results ?? [];
  const selectedGroupResourceParams = useMemo(
    () => ({
      community: communityId,
      linked_group: selectedRecordId ?? undefined,
      page: 1,
      page_size: 100,
      ordering: 'name'
    }),
    [communityId, selectedRecordId]
  );
  const selectedGroupResourcesQuery = useResourcesQuery(
    selectedGroupResourceParams,
    activeSection === 'groups' && Boolean(selectedRecordId)
  );
  const selectedGroupResources = selectedGroupResourcesQuery.data?.results ?? [];
  const selectedGroupImpactParams = useMemo(
    () => ({
      community: communityId,
      page: 1,
      page_size: 100,
      ordering: '-as_of_date'
    }),
    [communityId]
  );
  const selectedGroupImpactQuery = useImpactRecordsQuery(
    selectedGroupImpactParams,
    activeSection === 'groups' && Boolean(selectedRecordId)
  );
  const selectedGroupImpactRecords = useMemo(() => {
    const groupResourceIds = new Set(selectedGroupResources.map((resource) => resource.id));
    return (selectedGroupImpactQuery.data?.results ?? []).filter((impact) => {
      const isDirectGroupBeneficiary =
        impact.beneficiary_type === 'group' && impact.beneficiary_id === selectedRecordId;
      const isGroupResourceImpact = groupResourceIds.has(impact.resource);
      return isDirectGroupBeneficiary || isGroupResourceImpact;
    });
  }, [selectedGroupImpactQuery.data?.results, selectedGroupResources, selectedRecordId]);
  const selectedGroupCommitteeParams = useMemo(
    () => ({
      community: communityId,
      page: 1,
      page_size: 100,
      ordering: 'name'
    }),
    [communityId]
  );
  const selectedGroupCommitteesQuery = useCommitteesQuery(
    selectedGroupCommitteeParams,
    activeSection === 'groups' && Boolean(selectedRecordId)
  );
  const selectedGroupCommitteeMembershipParams = useMemo(
    () => ({
      community: communityId,
      page: 1,
      page_size: 200,
      status: 'active',
      ordering: 'start_date'
    }),
    [communityId]
  );
  const selectedGroupCommitteeMembershipsQuery = useCommitteeMembershipsQuery(
    selectedGroupCommitteeMembershipParams,
    activeSection === 'groups' && Boolean(selectedRecordId)
  );
  const selectedGroupCommitteeMemberships = useMemo(() => {
    const groupMemberIds = new Set(selectedGroupMembers.map((member) => member.id));
    return (selectedGroupCommitteeMembershipsQuery.data?.results ?? []).filter((membership) =>
      groupMemberIds.has(membership.member)
    );
  }, [selectedGroupCommitteeMembershipsQuery.data?.results, selectedGroupMembers]);
  const selectedGroupCommittees = useMemo(() => {
    const committeeIds = new Set(
      selectedGroupCommitteeMemberships.map((membership) => membership.committee)
    );
    return (selectedGroupCommitteesQuery.data?.results ?? []).filter((committee) =>
      committeeIds.has(committee.id)
    );
  }, [selectedGroupCommitteeMemberships, selectedGroupCommitteesQuery.data?.results]);
  const selectedRecordIsLoading =
    activeSection === 'groups'
      ? groupDetailQuery.isLoading
      : activeSection === 'members'
        ? memberDetailQuery.isLoading
        : activeSection === 'committees'
          ? committeeDetailQuery.isLoading
          : activeSection === 'cooperatives'
            ? cooperativeDetailQuery.isLoading
            : activeSection === 'institutions'
              ? institutionDetailQuery.isLoading
              : sectionQuery.isLoading;
  const pageCount = Math.max(1, Math.ceil((sectionQuery.data?.count ?? 0) / sectionPageSize));
  const archiveConfig = archiveConfigs[activeSection];
  const archiveRecords = useArchiveRecordsMutation(archiveConfig.key, archiveConfig.path);
  const deleteRecord = usePermanentDeleteMutation(archiveConfig.key, archiveConfig.path);
  const visibleIds = rows.map((row) => row.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const listActions = [
    ...(canExport ? [{
      label: 'Export current page',
      disabled: records.length === 0,
      onSelect: exportRecords
    }] : []),
    ...(canArchive ? [{
      label: 'Clear selection',
      disabled: selectedIds.length === 0,
      onSelect: () => setSelectedIds([])
    },
    {
      label: `Archive selected (${selectedIds.length})`,
      disabled: selectedIds.length === 0 || archiveRecords.isPending,
      onSelect: openSelectedArchiveDialog,
      tone: 'danger' as const
    }] : [])
  ];

  useEffect(() => {
    setPage(1);
    setSearch('');
    setCreateOpen(false);
    setEditCommunityOpen(false);
    setCreatingMemberForGroup(null);
    setEditingGroup(null);
    setEditingMember(null);
    setEditingInstitution(null);
    setEditingCommittee(null);
    setEditingCooperative(null);
    setEditingResource(null);
    setEditingImpactRecord(null);
    setSelectedIds([]);
    setArchiveTargets([]);
    setDeleteTarget(null);
  }, [activeSection, communityId]);

  useEffect(() => {
    setSelectedIds([]);
  }, [ordering, page, search]);

  function openRecordDetail(rowId: number) {
    if (activeSection === 'resources') {
      navigate(`/resources/${rowId}`, {
        state: {
          resourceOrigin: {
            label: `${community?.name ?? 'community'} resources`,
            path: `/communities/${communityId}/resources`
          }
        }
      });
    } else if (communityId) {
      navigate(`/communities/${communityId}/${activeSection}/${rowId}`);
    }
  }

  function editRecord(record: BreakdownRecord) {
    if (activeSection === 'groups') {
      setEditingGroup(record as Group);
    } else if (activeSection === 'members') {
      setEditingMember(record as Member);
    } else if (activeSection === 'institutions') {
      setEditingInstitution(record as Institution);
    } else if (activeSection === 'committees') {
      setEditingCommittee(record as Committee);
    } else if (activeSection === 'cooperatives') {
      setEditingCooperative(record as Cooperative);
    } else if (activeSection === 'resources') {
      setEditingResource(record as Resource);
    } else if (activeSection === 'impact') {
      setEditingImpactRecord(record as ImpactRecord);
    }
  }

  function handleCreated() {
    setSearch('');
    setPage(1);
  }

  function exportRecords() {
    downloadCsv(
      `community-${community?.id ?? 'records'}-${activeSection}-current-page.csv`,
      tableConfig.exportRows(records)
    );
  }

  function openSelectedArchiveDialog() {
    openArchiveDialog(rows
      .filter((row) => selectedIds.includes(row.id))
      .map((row) => ({ id: row.id, label: row.label })));
  }

  function openArchiveDialog(targets: ArchiveRecordTarget[]) {
    archiveRecords.reset();
    setArchiveTargets(targets);
  }

  function closeArchiveDialog() {
    archiveRecords.reset();
    setArchiveTargets([]);
  }

  async function confirmArchiveRecords() {
    try {
      await archiveRecords.mutateAsync(archiveTargets.map((target) => target.id));
      setSelectedIds([]);
      setArchiveTargets([]);
    } catch (error) {
      if (error instanceof BatchArchiveError) {
        setSelectedIds(error.failedIds);
        setArchiveTargets((current) => current.filter((target) => error.failedIds.includes(target.id)));
      }
    }
  }

  function openDeleteDialog(target: ArchiveRecordTarget) {
    deleteRecord.reset();
    setDeleteTarget(target);
  }

  async function confirmPermanentDelete() {
    if (!deleteTarget) return;
    await deleteRecord.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
    if (selectedRecordId === deleteTarget.id) {
      navigate(`/communities/${communityId}/${activeSection}`);
    }
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
    );
  }

  function changeOrdering(columnOrdering: string) {
    const nextOrdering = ordering === columnOrdering
      ? reverseOrdering(columnOrdering)
      : columnOrdering;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('ordering', nextOrdering);
      return next;
    }, { replace: true });
    setPage(1);
  }

  function renderCreateDialog() {
    if (!community || !createOpen || !canManage) {
      return null;
    }

    const props = {
      communityId: community.id,
      onClose: () => setCreateOpen(false),
      onCreated: handleCreated
    };

    if (activeSection === 'members') {
      return <MemberCreateDialog {...props} />;
    }
    if (activeSection === 'groups') {
      return <GroupCreateDialog {...props} />;
    }
    if (activeSection === 'institutions') {
      return <InstitutionCreateDialog {...props} />;
    }
    if (activeSection === 'cooperatives') {
      return <CooperativeCreateDialog {...props} />;
    }
    if (activeSection === 'committees') {
      return <CommitteeCreateDialog {...props} />;
    }
    if (activeSection === 'impact') {
      return <ImpactRecordCreateDialog {...props} />;
    }

    return <ResourceCreateDialog {...props} />;
  }

  function renderEditDialog() {
    if (!community || !canManage) {
      return null;
    }

    if (editingResource) {
      return (
        <ResourceCreateDialog
          communityId={community.id}
          resource={editingResource}
          onClose={() => setEditingResource(null)}
          onCreated={() => {
            setEditingResource(null);
            handleCreated();
          }}
        />
      );
    }

    if (creatingMemberForGroup) {
      return (
        <MemberCreateDialog
          communityId={community.id}
          fixedGroup={{ id: creatingMemberForGroup.id, name: creatingMemberForGroup.name }}
          onClose={() => setCreatingMemberForGroup(null)}
          onCreated={() => {
            setCreatingMemberForGroup(null);
            handleCreated();
          }}
        />
      );
    }

    if (editingGroup) {
      return (
        <GroupCreateDialog
          communityId={community.id}
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onCreated={() => {
            setEditingGroup(null);
            handleCreated();
          }}
        />
      );
    }

    if (editingMember) {
      return (
        <MemberCreateDialog
          communityId={community.id}
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onCreated={() => {
            setEditingMember(null);
            handleCreated();
          }}
        />
      );
    }

    if (editingInstitution) {
      return (
        <InstitutionCreateDialog
          communityId={community.id}
          institution={editingInstitution}
          onClose={() => setEditingInstitution(null)}
          onCreated={() => {
            setEditingInstitution(null);
            handleCreated();
          }}
        />
      );
    }

    if (editingCommittee) {
      return (
        <CommitteeCreateDialog
          communityId={community.id}
          committee={editingCommittee}
          onClose={() => setEditingCommittee(null)}
          onCreated={() => {
            setEditingCommittee(null);
            handleCreated();
          }}
        />
      );
    }

    if (editingCooperative) {
      return (
        <CooperativeCreateDialog
          communityId={community.id}
          cooperative={editingCooperative}
          onClose={() => setEditingCooperative(null)}
          onCreated={() => {
            setEditingCooperative(null);
            handleCreated();
          }}
        />
      );
    }

    if (editingImpactRecord) {
      return (
        <ImpactRecordCreateDialog
          communityId={community.id}
          impactRecord={editingImpactRecord}
          onClose={() => setEditingImpactRecord(null)}
          onCreated={() => {
            setEditingImpactRecord(null);
            handleCreated();
          }}
        />
      );
    }

    return null;
  }

  function renderRowActions(rowId: number) {
    const record = records.find((item) => item.id === rowId);
    const row = rows.find((item) => item.id === rowId);
    if (!record || !row || (!canManage && !canArchive && !canDeletePermanently)) return null;
    return (
      <ActionMenu
        ariaLabel={`Actions for ${row.label}`}
        variant="secondary"
        items={[
          ...(canManage ? [{ label: 'Edit', onSelect: () => editRecord(record) }] : []),
          ...(canArchive ? [{
            label: 'Archive',
            onSelect: () => openArchiveDialog([{ id: row.id, label: row.label }]),
            tone: 'danger' as const
          }] : []),
          ...(canDeletePermanently ? [{
            label: 'Delete permanently',
            onSelect: () => openDeleteDialog({ id: row.id, label: row.label }),
            tone: 'danger' as const
          }] : [])
        ]}
      />
    );
  }

  if (selectedRecordId && community) {
    return (
      <section className="page-panel page-panel--detail">
        <BreakdownRecordDetailPage
          activeSection={activeSection}
          canManage={canManage}
          committeeMemberships={selectedCommitteeMemberships}
          committeeMembershipsCount={selectedCommitteeMembershipsQuery.data?.count ?? selectedCommitteeMemberships.length}
          committeeMembershipsError={selectedCommitteeMembershipsQuery.isError}
          committeeMembershipsLoading={selectedCommitteeMembershipsQuery.isLoading}
          communityId={community.id}
          communityName={community.name}
          groupImpactRecords={selectedGroupImpactRecords}
          groupImpactRecordsLoading={
            selectedGroupImpactQuery.isLoading || selectedGroupResourcesQuery.isLoading
          }
          groupActivities={selectedGroupActivities}
          groupActivitiesLoading={selectedGroupActivitiesQuery.isLoading}
          groupCommitteeMemberships={selectedGroupCommitteeMemberships}
          groupCommittees={selectedGroupCommittees}
          groupCommitteesLoading={
            selectedGroupCommitteeMembershipsQuery.isLoading ||
            selectedGroupCommitteesQuery.isLoading ||
            selectedGroupMembersQuery.isLoading
          }
          groupMembers={selectedGroupMembers}
          groupMembersLoading={selectedGroupMembersQuery.isLoading}
          groupResources={selectedGroupResources}
          groupResourcesLoading={selectedGroupResourcesQuery.isLoading}
          isLoading={selectedRecordIsLoading}
          onCreateGroupMember={setCreatingMemberForGroup}
          onEdit={editRecord}
          onEditGroupMember={setEditingMember}
          record={selectedRecord}
        />
        {renderEditDialog()}
      </section>
    );
  }

  return (
    <section className="page-panel page-panel--detail">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/communities">Communities</Link>
        <span>›</span>
        <span>{community?.name ?? 'Community'}</span>
      </nav>

      {query.isLoading ? <div className="state-box">Loading community...</div> : null}
      {query.isError ? <div className="state-box state-box--error">Unable to load this community.</div> : null}

      {community ? (
        <>
          <div className="detail-header">
            <div>
              <h1>{community.name}</h1>
              <p>{community.notes || 'Community description'}</p>
            </div>
            {canManageCommunity ? (
              <button
                className="button button--primary"
                type="button"
                onClick={() => setEditCommunityOpen(true)}
              >
                Edit community
              </button>
            ) : null}
          </div>

          <div className="community-summary-cards">
            <div className="address-card">
              <h2>Address</h2>
              <dl>
                <div>
                  <dt>Subcounty</dt>
                  <dd>{community.subcounty_name || 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>District</dt>
                  <dd>{community.district_name || 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Region</dt>
                  <dd>{community.region_name || 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Country</dt>
                  <dd>{community.country || 'Not recorded'}</dd>
                </div>
              </dl>
            </div>

            <div className="address-card community-statistics-card">
              <h2>Community summary</h2>
              <dl>
                <div>
                  <dt>Residents</dt>
                  <dd>{community.resident_count?.toLocaleString() ?? 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Resources</dt>
                  <dd>{community.resource_count ?? 0}</dd>
                </div>
                <div>
                  <dt>Groups</dt>
                  <dd>{community.group_count ?? 0}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="breakdown">
            <h2>Breakdown</h2>
            <div className="breakdown__body">
              <nav className="breakdown-nav" aria-label="Community breakdown">
                {visibleSections.map((item) => {
                  const count = item.countField ? Number(community[item.countField as CountField] ?? 0) : 0;
                  return (
                    <NavLink key={item.key} to={`/communities/${community.id}/${item.key}`}>
                      <span>{item.label}</span>
                      {item.countField ? <strong>{count}</strong> : null}
                    </NavLink>
                  );
                })}
              </nav>

              <div className="breakdown-table">
                <div className="toolbar">
                  {canArchive ? <button
                    className={`select-button ${allVisibleSelected ? 'is-selected' : ''}`}
                    type="button"
                    aria-label={allVisibleSelected ? 'Clear visible rows' : 'Select visible rows'}
                    aria-pressed={allVisibleSelected}
                    onClick={() => setSelectedIds((current) => toggleVisibleSelection(current, visibleIds))}
                  /> : null}
                  <label className="search-field">
                    <SearchIcon aria-hidden="true" />
                    <input
                      type="search"
                      value={search}
                      placeholder={`Search ${sectionConfig.label.toLowerCase()}`}
                      aria-label={`Search ${sectionConfig.label.toLowerCase()}`}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                      }}
                    />
                  </label>
                  {listActions.length > 0 ? <ActionMenu items={listActions} /> : null}
                  {canExport ? <button className="text-action" type="button" onClick={exportRecords} disabled={records.length === 0}>
                    <UploadIcon aria-hidden="true" />
                    Export list
                  </button> : null}
                  {canManage ? <button className="button button--primary" type="button" onClick={() => setCreateOpen(true)}>
                    <PlusIcon aria-hidden="true" />
                    {createLabels[activeSection]}
                  </button> : null}
                  <span className="toolbar__spacer" />
                  <PaginationLabel
                    page={page}
                    pageCount={pageCount}
                    total={sectionQuery.data?.count ?? 0}
                    itemName={tableConfig.itemName}
                    onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                    onNext={() => setPage((current) => Math.min(pageCount, current + 1))}
                  />
                </div>

                {sectionQuery.isLoading ? <div className="state-box">Loading {tableConfig.itemName}...</div> : null}
                {sectionQuery.isError ? (
                  <div className="state-box state-box--error">Unable to load {tableConfig.itemName}.</div>
                ) : null}
                <ListActionError error={archiveRecords.error} />
                {!sectionQuery.isLoading && !sectionQuery.isError && rows.length === 0 ? (
                  <div className="state-box">No {tableConfig.itemName} found for this community.</div>
                ) : null}

                <div className="table-wrap">
                  {rows.length > 0 ? (
                    <table className="data-table data-table--sticky-identity data-table--selectable">
                      <thead>
                        <tr>
                          <th aria-label={`Select ${tableConfig.itemName}`} className="data-table__select" />
                          {tableConfig.columns.map((column) => {
                            const direction = column.ordering
                              ? orderingDirection(ordering, column.ordering)
                              : null;
                            return (
                              <th
                                aria-sort={column.ordering ? direction ?? 'none' : undefined}
                                className={column === tableConfig.columns[0] ? 'data-table__identity' : undefined}
                                key={column.label}
                              >
                                {column.ordering ? (
                                  <button
                                    aria-label={`Sort by ${column.label}${direction ? `, currently ${direction}` : ''}`}
                                    className={`sortable-header${direction ? ` is-${direction}` : ''}`}
                                    type="button"
                                    onClick={() => changeOrdering(column.ordering!)}
                                  >
                                    {column.label}
                                  </button>
                                ) : column.label}
                              </th>
                            );
                          })}
                          {canManage || canArchive || canDeletePermanently ? <th>Actions</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr className={row.id === selectedRecordId ? 'is-selected' : ''} key={row.id}>
                            <td className="data-table__select">
                              {canArchive ? <input
                                type="checkbox"
                                checked={selectedIds.includes(row.id)}
                                aria-label={`Select ${row.label}`}
                                onChange={() => toggleSelected(row.id)}
                              /> : null}
                            </td>
                            {row.cells.map((cell, index) => (
                              <td className={index === 0 ? 'data-table__identity' : undefined} key={`${row.id}-${tableConfig.columns[index].label}`}>
                                {index === 0 ? (
                                  <button
                                    className="table-link"
                                    type="button"
                                    onClick={() => openRecordDetail(row.id)}
                                  >
                                    {cell}
                                  </button>
                                ) : cell}
                              </td>
                            ))}
                            {canManage || canArchive || canDeletePermanently ? (
                              <td>{renderRowActions(row.id)}</td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          {renderCreateDialog()}
          {renderEditDialog()}
          {archiveTargets.length > 0 ? (
            <ArchiveRecordsDialog
              entityName={archiveConfig.itemName}
              error={archiveRecords.error}
              isPending={archiveRecords.isPending}
              onClose={closeArchiveDialog}
              onConfirm={confirmArchiveRecords}
              path={archiveConfig.path}
              targets={archiveTargets}
            />
          ) : null}
          {deleteTarget ? (
            <PermanentDeleteDialog
              error={deleteRecord.error}
              isPending={deleteRecord.isPending}
              onClose={() => {
                deleteRecord.reset();
                setDeleteTarget(null);
              }}
              onConfirm={confirmPermanentDelete}
              path={archiveConfig.path}
              target={deleteTarget}
            />
          ) : null}
          {canManageCommunity && editCommunityOpen ? (
            <CommunityCreateDialog
              community={community}
              onClose={() => setEditCommunityOpen(false)}
              onSaved={() => setEditCommunityOpen(false)}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}
