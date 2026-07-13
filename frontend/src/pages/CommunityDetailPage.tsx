import { PlusIcon, SearchIcon, UploadIcon } from '@patternfly/react-icons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';

import {
  useCommitteeMembershipsQuery,
  useCommitteesQuery,
  useCommunityQuery,
  useCooperativesQuery,
  useGroupMembersQuery,
  useGroupQuery,
  useGroupsQuery,
  useArchiveRecordsMutation,
  useImpactRecordsQuery,
  useInstitutionsQuery,
  useMemberQuery,
  useMembersQuery,
  useResourcesQuery
} from '../api/queries';
import type {
  Committee,
  CommitteeMembership,
  Cooperative,
  Group,
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
import { CommunityCreateDialog } from '../components/CommunityCreateDialog';
import { ListActionError } from '../components/ListActionError';
import { ResourceCreateDialog } from '../components/ResourceCreateDialog';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../auth/AuthContext';
import { capabilities, hasCapability } from '../auth/permissions';
import { downloadCsv, toggleVisibleSelection } from '../utils/listActions';
import { PaginationLabel } from './CommunitiesPage';

const sectionPageSize = 10;

const sections = [
  { key: 'groups', label: 'Groups', countField: 'group_count', ordering: 'name' },
  { key: 'members', label: 'Members', countField: 'member_count', ordering: 'last_name' },
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
type BreakdownRecord = Member | Group | Institution | Committee | Cooperative | Resource | ImpactRecord;
type GroupWorkspaceTab = 'overview' | 'resources' | 'trainings' | 'committees' | 'members';
type DemoGroupTraining = {
  id: string;
  title: string;
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
};

const sectionKeys = sections.map((item) => item.key);
const groupWorkspaceTabs: Array<{ key: GroupWorkspaceTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'resources', label: 'Resources' },
  { key: 'trainings', label: 'Trainings' },
  { key: 'committees', label: 'Committees' },
  { key: 'members', label: 'Members' }
];
const demoGroupTrainingsByCode: Record<string, DemoGroupTraining[]> = {
  'KWDT-DEMO-GRP': [
    {
      id: 'savings-records-2024-06',
      title: 'Savings Records and Loan Tracking',
      dateRange: '10 Jun 2024 - 12 Jun 2024',
      month: 'June 2024',
      startDay: 10,
      endDay: 12,
      facilitator: 'Joan Programme',
      location: 'KWDT Demo Community Center',
      attendance: { women: 18, men: 4 },
      ageBands: [
        { label: '20-40', men: 1, women: 9 },
        { label: '40-60', men: 2, women: 5 },
        { label: '>60', men: 1, women: 4 }
      ],
      focus: 'Bookkeeping, loan register updates, arrears follow-up',
      reports: ['Savings training report', 'Loan register attendance'],
      reportStatus: 'Report submitted'
    },
    {
      id: 'enterprise-planning-2024-08',
      title: 'Enterprise Planning for Group Assets',
      dateRange: '5 Aug 2024 - 6 Aug 2024',
      month: 'August 2024',
      startDay: 5,
      endDay: 6,
      facilitator: 'Amina Field',
      location: 'Central Demo Parish Hall',
      attendance: { women: 16, men: 5 },
      ageBands: [
        { label: '20-40', men: 2, women: 8 },
        { label: '40-60', men: 1, women: 4 },
        { label: '>60', men: 2, women: 4 }
      ],
      focus: 'Irrigation pump scheduling, produce pricing, member duties',
      reports: ['Enterprise planning notes'],
      reportStatus: 'Attendance verified'
    },
    {
      id: 'impact-harvesting-2024-09',
      title: 'Impact Harvesting Clinic',
      dateRange: '18 Sep 2024',
      month: 'September 2024',
      startDay: 18,
      endDay: 18,
      facilitator: 'Benjamin Evaluation',
      location: 'KWDT Demo Community Center',
      attendance: { women: 19, men: 3 },
      ageBands: [
        { label: '20-40', men: 1, women: 10 },
        { label: '40-60', men: 1, women: 6 },
        { label: '>60', men: 1, women: 3 }
      ],
      focus: 'Outcome stories, household reach, evidence quality',
      reports: ['Impact clinic draft notes', 'Outcome story checklist'],
      reportStatus: 'Draft notes'
    }
  ]
};
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

function formatMoney(amount?: string, currency = 'UGX') {
  if (!amount) {
    return 'Not recorded';
  }
  return `${currency} ${Number(amount).toLocaleString()}`;
}

function memberName(member: Member) {
  return [member.preferred_name || member.first_name, member.last_name].filter(Boolean).join(' ');
}

function formatResourceQuantity(resource: Resource) {
  return [resource.quantity, resource.unit].filter(Boolean).join(' ') || 'Quantity not recorded';
}

function sumNumbers(values: Array<number | undefined>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
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
    columns: string[];
    exportRows: (
      records: Array<Member | Group | Institution | Committee | Cooperative | Resource | ImpactRecord>
    ) => Array<Record<string, boolean | number | string | null | undefined>>;
    itemName: string;
    toRows: (records: Array<Member | Group | Institution | Committee | Cooperative | Resource | ImpactRecord>) => TableRow[];
  }
> = {
  members: {
    columns: ['Member name', 'Member #', 'Email', 'Phone', 'Status', 'Joined'],
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
          member.email ? <a href={`mailto:${member.email}`}>{member.email}</a> : 'Not recorded',
          member.phone || 'Not recorded',
          <StatusBadge status={member.status} />,
          formatDate(member.joined_on)
        ]
      }))
  },
  groups: {
    columns: ['Group name', 'Code', 'Meeting day', 'Formed', 'Status'],
    exportRows: (records) =>
      (records as Group[]).map((group) => ({
        code: group.code,
        community: group.community,
        formed_on: group.formed_on,
        id: group.id,
        meeting_day: group.meeting_day,
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
          group.meeting_day || 'Not recorded',
          formatDate(group.formed_on),
          <StatusBadge status={group.status} />
        ]
      }))
  },
  institutions: {
    columns: ['Institution name', 'Type', 'Contact', 'Email', 'Status'],
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
    columns: ['Cooperative name', 'Type', 'Formed', 'Closed', 'Status'],
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
    columns: ['Committee name', 'Type', 'Formed', 'Closed', 'Status'],
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
    columns: ['Resource name', 'Type', 'Owner', 'Quantity', 'Value', 'Themes', 'Status'],
    exportRows: (records) =>
      (records as Resource[]).map((resource) => ({
        community: resource.community,
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
          `${formatLabel(resource.owner_type)} #${resource.owner_id ?? 'unknown'}`,
          [resource.quantity, resource.unit].filter(Boolean).join(' ') || 'Not recorded',
          formatMoney(resource.value_amount, resource.value_currency),
          resource.thematic_areas?.map((area) => area.code).join(', ') || 'Not recorded',
          <StatusBadge status={resource.status} />
        ]
      }))
  },
  impact: {
    columns: ['As of', 'Period', 'Resource', 'Beneficiaries', 'Households', 'Members', 'Method'],
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
  communityName: string;
  communityId: number;
  groupImpactRecords: ImpactRecord[];
  groupImpactRecordsLoading: boolean;
  groupCommitteeMemberships: CommitteeMembership[];
  groupCommittees: Committee[];
  groupCommitteesLoading: boolean;
  groupMembers: Member[];
  groupMembersLoading: boolean;
  groupResources: Resource[];
  groupResourcesLoading: boolean;
  isLoading: boolean;
  onEdit: (record: BreakdownRecord) => void;
  record: BreakdownRecord | null;
};

function BreakdownRecordDetailPage({
  activeSection,
  canManage,
  communityId,
  communityName,
  groupImpactRecords,
  groupImpactRecordsLoading,
  groupCommitteeMemberships,
  groupCommittees,
  groupCommitteesLoading,
  groupMembers,
  groupMembersLoading,
  groupResources,
  groupResourcesLoading,
  isLoading,
  onEdit,
  record
}: BreakdownRecordDetailPageProps) {
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
  const backTo = `/communities/${communityId}/${activeSection}`;

  return (
    <div className="record-page" aria-labelledby="record-detail-title">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/communities">Communities</Link>
        <span>›</span>
        <Link to={`/communities/${communityId}`}>{communityName}</Link>
        <span>›</span>
        <Link to={backTo}>{sectionLabel}</Link>
        <span>›</span>
        <span>{title}</span>
      </nav>

      {isLoading ? <div className="state-box">Loading record details...</div> : null}
      {!isLoading && !record ? (
        <div className="state-box">
          This record is not available yet. <Link to={backTo}>Return to {tableConfigs[activeSection].itemName}</Link>.
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
            committeeMemberships={groupCommitteeMemberships}
            committees={groupCommittees}
            committeesLoading={groupCommitteesLoading}
            members={groupMembers}
            membersLoading={groupMembersLoading}
            onEdit={onEdit}
            resources={groupResources}
            resourcesLoading={groupResourcesLoading}
          />
        ) : (
        <>
          <header className="record-page__hero">
            <div>
              <Link className="record-page__back" to={backTo}>← Back to {tableConfigs[activeSection].itemName}</Link>
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
              <span>Updated</span>
              <strong>{formatDateTime(syncUpdatedAt(record))}</strong>
            </aside>
            <div className="record-page__content">
              {activeSection === 'members' ? (
                <MemberDetailContent member={record as Member} />
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
  onEdit,
  resources,
  resourcesLoading
}: {
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
  onEdit: (record: BreakdownRecord) => void;
  resources: Resource[];
  resourcesLoading: boolean;
}) {
  const [activeTab, setActiveTab] = useState<GroupWorkspaceTab>('overview');
  const activeMembers = members.filter((member) => member.status !== 'archived' && member.status !== 'inactive');
  const impactBeneficiaries = sumNumbers(impactRecords.map((impact) => impact.beneficiary_count));
  const impactHouseholds = sumNumbers(impactRecords.map((impact) => impact.household_count));
  const groupMeta = [
    group.code ? `Code ${group.code}` : null,
    group.meeting_day ? `Meets ${group.meeting_day}` : null,
    group.formed_on ? `Formed ${formatDate(group.formed_on)}` : null
  ].filter(Boolean);
  const trainings = group.code ? demoGroupTrainingsByCode[group.code] ?? [] : [];

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
            members={members}
            membersLoading={membersLoading}
            committees={committees}
            committeesLoading={committeesLoading}
            resources={resources}
            resourcesLoading={resourcesLoading}
            trainings={trainings}
          />
        ) : null}
        {activeTab === 'members' ? (
          <GroupMembersTab group={group} members={members} membersLoading={membersLoading} />
        ) : null}
        {activeTab === 'resources' ? (
          <GroupResourcesTab resources={resources} resourcesLoading={resourcesLoading} />
        ) : null}
        {activeTab === 'trainings' ? (
          <GroupTrainingsTab groupName={group.name} trainings={trainings} />
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
  members,
  membersLoading,
  resources,
  resourcesLoading,
  trainings
}: {
  activeMembers: number;
  committees: Committee[];
  committeesLoading: boolean;
  group: Group;
  impactBeneficiaries: number;
  impactHouseholds: number;
  impactLoading: boolean;
  members: Member[];
  membersLoading: boolean;
  resources: Resource[];
  resourcesLoading: boolean;
  trainings: DemoGroupTraining[];
}) {
  const upcomingTrainings = trainings.slice(0, 3);
  const featuredResources = resources.slice(0, 3);
  const featuredCommittees = committees.slice(0, 2);
  const newestMember = members
    .filter((member) => member.joined_on)
    .slice()
    .sort((left, right) => String(right.joined_on).localeCompare(String(left.joined_on)))[0];

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
              <span>Training schedule</span>
              <h2 id="group-overview-trainings">Upcoming trainings</h2>
            </div>
            <strong>{formatCount(upcomingTrainings.length)}</strong>
          </header>
          {upcomingTrainings.length > 0 ? (
            <div className="group-overview-training-list">
              {upcomingTrainings.map((training) => (
                <article key={training.id}>
                  <time>
                    <strong>{training.startDay}</strong>
                    <span>{training.month.split(' ')[0]}</span>
                  </time>
                  <div>
                    <h3>{training.title}</h3>
                    <p>{training.focus}</p>
                    <span>{training.dateRange} · {training.facilitator}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="table-note">No group trainings are scheduled in the current fixture.</p>
          )}
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
                <article key={committee.id}>
                  <strong>{committee.name}</strong>
                  <span>{formatLabel(committee.committee_type)}</span>
                  <StatusBadge status={committee.status} />
                </article>
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
                <article key={resource.id}>
                  <strong>{resource.name}</strong>
                  <span>{formatLabel(resource.resource_type)} · {formatResourceQuantity(resource)}</span>
                  <em>{formatMoney(resource.value_amount, resource.value_currency)}</em>
                </article>
              ))}
            </div>
          ) : null}
          {!resourcesLoading && featuredResources.length === 0 ? (
            <p className="table-note">No resources owned by this group are recorded yet.</p>
          ) : null}
        </section>

        <section className="group-overview-panel group-overview-panel--context" aria-labelledby="group-overview-context">
          <header className="group-overview-panel__header">
            <div>
              <span>Context</span>
              <h2 id="group-overview-context">Group notes</h2>
            </div>
          </header>
          {group.notes ? <p>{group.notes}</p> : <p className="table-note">No notes recorded for this group yet.</p>}
          <div className="group-overview-context-grid">
            <span>
              <strong>{group.meeting_day || 'Not recorded'}</strong>
              Meeting day
            </span>
            <span>
              <strong>{newestMember ? memberName(newestMember) : 'Not recorded'}</strong>
              Newest member
            </span>
            <span>
              <strong>{group.formed_on ? formatDate(group.formed_on) : 'Not recorded'}</strong>
              Formed
            </span>
          </div>
        </section>
      </div>
    </>
  );
}

function GroupMembersTab({
  group,
  members,
  membersLoading
}: {
  group: Group;
  members: Member[];
  membersLoading: boolean;
}) {
  if (membersLoading) {
    return <div className="state-box">Loading group members...</div>;
  }
  if (members.length === 0) {
    return <div className="state-box">No members recorded for this group.</div>;
  }

  return (
    <div className="group-card-grid group-card-grid--members">
      {members.map((member) => (
        <Link className="group-workspace-card" key={member.id} to={`/communities/${group.community}/members/${member.id}`}>
          <span className="group-workspace-card__title">{memberName(member)}</span>
          <span>{member.member_number || 'Member number not recorded'}</span>
          <span>{member.phone || member.email || 'Contact not recorded'}</span>
          <span className="group-workspace-card__footer">
            Joined {formatDate(member.joined_on)}
            <StatusBadge status={member.status} />
          </span>
        </Link>
      ))}
    </div>
  );
}

function GroupResourcesTab({
  resources,
  resourcesLoading
}: {
  resources: Resource[];
  resourcesLoading: boolean;
}) {
  if (resourcesLoading) {
    return <div className="state-box">Loading group resources...</div>;
  }
  if (resources.length === 0) {
    return <div className="state-box">No resources owned by this group are recorded yet.</div>;
  }

  return (
    <div className="group-card-grid group-card-grid--resources">
      {resources.map((resource) => (
        <article className="group-workspace-card" key={resource.id}>
          <span className="group-workspace-card__title">{resource.name}</span>
          <span>{formatLabel(resource.resource_type)}</span>
          <span>{formatResourceQuantity(resource)}</span>
          {resource.thematic_areas?.length ? (
            <span>{resource.thematic_areas.map((area) => area.code).join(', ')}</span>
          ) : null}
          <span className="group-workspace-card__footer">
            {formatMoney(resource.value_amount, resource.value_currency)}
            <StatusBadge status={resource.status} />
          </span>
        </article>
      ))}
    </div>
  );
}

function GroupTrainingsTab({ groupName, trainings }: { groupName: string; trainings: DemoGroupTraining[] }) {
  const [selectedTrainingId, setSelectedTrainingId] = useState(trainings[0]?.id ?? '');
  const selectedTraining = trainings.find((training) => training.id === selectedTrainingId) ?? trainings[0];
  const monthGroups = trainings.reduce<Array<{ month: string; trainings: DemoGroupTraining[] }>>(
    (current, training) => {
      const existing = current.find((item) => item.month === training.month);
      if (existing) {
        existing.trainings.push(training);
        return current;
      }
      return [...current, { month: training.month, trainings: [training] }];
    },
    []
  );

  if (trainings.length === 0) {
    return (
      <div className="state-box">
        Training records are not part of the current MVP backend yet. This tab is reserved for
        the group training calendar and attendance history once that API is added.
      </div>
    );
  }

  return (
    <div className="group-training-workspace">
      <div className="group-training-calendar" aria-label="Training calendar">
        {monthGroups.map((group) => (
          <section key={group.month}>
            <h3>{group.month}</h3>
            <div className="group-training-calendar__grid">
              {Array.from({ length: 30 }, (_, index) => {
                const day = index + 1;
                const trainingOnDay = group.trainings.find(
                  (training) => day >= training.startDay && day <= training.endDay
                );
                const isStart = trainingOnDay?.startDay === day;
                const isEnd = trainingOnDay?.endDay === day;
                return (
                  <button
                    aria-label={trainingOnDay ? `${trainingOnDay.title}, day ${day}` : `${group.month} ${day}`}
                    className={[
                      trainingOnDay ? 'has-training' : '',
                      isStart ? 'is-start' : '',
                      isEnd ? 'is-end' : '',
                      trainingOnDay?.id === selectedTraining?.id ? 'is-selected' : ''
                    ].filter(Boolean).join(' ')}
                    disabled={!trainingOnDay}
                    key={day}
                    type="button"
                    onClick={() => trainingOnDay && setSelectedTrainingId(trainingOnDay.id)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="group-training-list" aria-label="Training sessions">
        {trainings.map((training) => (
          <button
            className={training.id === selectedTraining?.id ? 'is-selected' : ''}
            key={training.id}
            type="button"
            onClick={() => setSelectedTrainingId(training.id)}
          >
            <span>{training.title}</span>
            <strong>{training.dateRange}</strong>
            <small>{training.facilitator}</small>
          </button>
        ))}
      </div>

      {selectedTraining ? <GroupTrainingDetailPanel groupName={groupName} training={selectedTraining} /> : null}
    </div>
  );
}

function GroupTrainingDetailPanel({ groupName, training }: { groupName: string; training: DemoGroupTraining }) {
  const totalAttendance = training.attendance.women + training.attendance.men;
  const maxChartValue = Math.max(
    1,
    training.attendance.men,
    training.attendance.women,
    ...training.ageBands.flatMap((band) => [band.men, band.women])
  );
  const yAxisMidpoint = Math.ceil(maxChartValue / 2);

  return (
    <aside className="group-training-detail" aria-label="Selected training details">
      <section>
        <span className="record-detail__eyebrow">Selected training</span>
        <h3>{training.title}</h3>
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
          <li>{formatCount(totalAttendance)} total participants from this group</li>
          <li>{formatCount(training.attendance.women)} women</li>
          <li>{formatCount(training.attendance.men)} men</li>
        </ul>
      </section>

      <section>
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
      </section>

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
              <strong>{committee.name}</strong>
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
    </>
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
  const canExport = hasCapability(user, capabilities.export);
  const visibleSections = user?.roles.includes('communications_viewer')
    ? sections.filter((item) => !['members', 'institutions'].includes(item.key))
    : sections;
  const sectionConfig = sections.find((item) => item.key === activeSection) ?? sections[0];
  const tableConfig = tableConfigs[activeSection];
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editCommunityOpen, setEditCommunityOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null);
  const [editingCommittee, setEditingCommittee] = useState<Committee | null>(null);
  const [editingCooperative, setEditingCooperative] = useState<Cooperative | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [editingImpactRecord, setEditingImpactRecord] = useState<ImpactRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const query = useCommunityQuery(communityId);
  const community = query.data;
  const listParams = useMemo(
    () => ({
      community: communityId,
      page,
      page_size: sectionPageSize,
      search,
      ordering: sectionConfig.ordering
    }),
    [communityId, page, search, sectionConfig.ordering]
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
  const selectedRecord =
    activeSection === 'groups'
      ? groupDetailQuery.data ?? selectedRecordFromPage
      : activeSection === 'members'
        ? memberDetailQuery.data ?? selectedRecordFromPage
        : selectedRecordFromPage;
  const selectedGroupMembersQuery = useGroupMembersQuery(
    activeSection === 'groups' ? (selectedRecordId ?? undefined) : undefined,
    activeSection === 'groups' && Boolean(selectedRecordId)
  );
  const selectedGroupMembers = selectedGroupMembersQuery.data ?? [];
  const selectedGroupResourceParams = useMemo(
    () => ({
      community: communityId,
      owner_type: 'group',
      page: 1,
      page_size: 100,
      ordering: 'name'
    }),
    [communityId]
  );
  const selectedGroupResourcesQuery = useResourcesQuery(
    selectedGroupResourceParams,
    activeSection === 'groups' && Boolean(selectedRecordId)
  );
  const selectedGroupResources = useMemo(
    () =>
      (selectedGroupResourcesQuery.data?.results ?? []).filter(
        (resource) => resource.owner_type === 'group' && resource.owner_id === selectedRecordId
      ),
    [selectedGroupResourcesQuery.data?.results, selectedRecordId]
  );
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
        : sectionQuery.isLoading;
  const pageCount = Math.max(1, Math.ceil((sectionQuery.data?.count ?? 0) / sectionPageSize));
  const archiveConfig = archiveConfigs[activeSection];
  const archiveRecords = useArchiveRecordsMutation(archiveConfig.key, archiveConfig.path);
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
      onSelect: () => void archiveSelectedRecords(),
      tone: 'danger' as const
    }] : [])
  ];

  useEffect(() => {
    setPage(1);
    setSearch('');
    setCreateOpen(false);
    setEditCommunityOpen(false);
    setEditingGroup(null);
    setEditingMember(null);
    setEditingInstitution(null);
    setEditingCommittee(null);
    setEditingCooperative(null);
    setEditingResource(null);
    setEditingImpactRecord(null);
    setSelectedIds([]);
  }, [activeSection, communityId]);

  function openRecordDetail(rowId: number) {
    if (communityId) {
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

  async function archiveSelectedRecords() {
    const label =
      selectedIds.length === 1 ? archiveConfig.itemName : `${archiveConfig.itemName}s`;
    if (!window.confirm(`Archive ${selectedIds.length} selected ${label}?`)) {
      return;
    }

    try {
      await archiveRecords.mutateAsync(selectedIds);
      setSelectedIds([]);
    } catch {
      // The archive error state is rendered below.
    }
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
    );
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
    if (!canManage) {
      return null;
    }
    if (activeSection === 'groups') {
      const group = (records as Group[]).find((item) => item.id === rowId);
      return group ? (
        <button
          className="button button--secondary"
          type="button"
          onClick={() => setEditingGroup(group)}
        >
          Edit
        </button>
      ) : null;
    }
    if (activeSection === 'members') {
      const member = (records as Member[]).find((item) => item.id === rowId);
      return member ? (
        <button
          className="button button--secondary"
          type="button"
          onClick={() => setEditingMember(member)}
        >
          Edit
        </button>
      ) : null;
    }
    if (activeSection === 'institutions') {
      const institution = (records as Institution[]).find((item) => item.id === rowId);
      return institution ? (
        <button
          className="button button--secondary"
          type="button"
          onClick={() => setEditingInstitution(institution)}
        >
          Edit
        </button>
      ) : null;
    }
    if (activeSection === 'committees') {
      const committee = (records as Committee[]).find((item) => item.id === rowId);
      return committee ? (
        <button
          className="button button--secondary"
          type="button"
          onClick={() => setEditingCommittee(committee)}
        >
          Edit
        </button>
      ) : null;
    }
    if (activeSection === 'cooperatives') {
      const cooperative = (records as Cooperative[]).find((item) => item.id === rowId);
      return cooperative ? (
        <button
          className="button button--secondary"
          type="button"
          onClick={() => setEditingCooperative(cooperative)}
        >
          Edit
        </button>
      ) : null;
    }
    if (activeSection === 'resources') {
      const resource = (records as Resource[]).find((item) => item.id === rowId);
      if (!resource) {
        return null;
      }
      return (
        <div className="row-actions">
          <button className="button button--secondary" type="button" onClick={() => setEditingResource(resource)}>
            Edit
          </button>
        </div>
      );
    }

    if (activeSection === 'impact') {
      const impactRecord = (records as ImpactRecord[]).find((item) => item.id === rowId);
      if (!impactRecord) {
        return null;
      }
      return (
        <div className="row-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setEditingImpactRecord(impactRecord)}
          >
            Edit
          </button>
        </div>
      );
    }

    return null;
  }

  if (selectedRecordId && community) {
    return (
      <section className="page-panel page-panel--detail">
        <BreakdownRecordDetailPage
          activeSection={activeSection}
          canManage={canManage}
          communityId={community.id}
          communityName={community.name}
          groupImpactRecords={selectedGroupImpactRecords}
          groupImpactRecordsLoading={
            selectedGroupImpactQuery.isLoading || selectedGroupResourcesQuery.isLoading
          }
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
          onEdit={editRecord}
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

          <div className="address-card">
            <div>
              <h2>Address</h2>
              <dl>
                <div>
                  <dt>Area</dt>
                  <dd>{community.area_name || 'Not recorded'}</dd>
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
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th aria-label={`Select ${tableConfig.itemName}`} />
                          {tableConfig.columns.map((column) => (
                            <th key={column}>{column}</th>
                          ))}
                          {canManage ? <th>Actions</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr className={row.id === selectedRecordId ? 'is-selected' : ''} key={row.id}>
                            <td>
                              {canArchive ? <input
                                type="checkbox"
                                checked={selectedIds.includes(row.id)}
                                aria-label={`Select ${row.label}`}
                                onChange={() => toggleSelected(row.id)}
                              /> : null}
                            </td>
                            {row.cells.map((cell, index) => (
                              <td key={`${row.id}-${tableConfig.columns[index]}`}>
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
                            {canManage ? (
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
