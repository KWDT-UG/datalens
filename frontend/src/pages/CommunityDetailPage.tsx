import { PlusIcon, SearchIcon, UploadIcon } from '@patternfly/react-icons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';

import {
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

const sectionKeys = sections.map((item) => item.key);
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
  groupMembers: Member[];
  groupMembersLoading: boolean;
  isLoading: boolean;
  onEdit: (record: BreakdownRecord) => void;
  record: BreakdownRecord | null;
};

function BreakdownRecordDetailPage({
  activeSection,
  canManage,
  communityId,
  communityName,
  groupMembers,
  groupMembersLoading,
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
              {activeSection === 'groups' ? (
                <GroupDetailContent
                  group={record as Group}
                  members={groupMembers}
                  membersLoading={groupMembersLoading}
                />
              ) : activeSection === 'members' ? (
                <MemberDetailContent member={record as Member} />
              ) : (
                <GenericRecordDetail activeSection={activeSection} record={record} />
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function GroupDetailContent({
  group,
  members,
  membersLoading
}: {
  group: Group;
  members: Member[];
  membersLoading: boolean;
}) {
  return (
    <>
      <DetailSection title="Key details">
        <dl className="record-detail__grid">
          <DetailItem label="Code" value={group.code || 'Not recorded'} />
          <DetailItem label="Meeting day" value={group.meeting_day || 'Not recorded'} />
          <DetailItem label="Formed" value={formatDate(group.formed_on)} />
          <DetailItem label="Closed" value={formatDate(group.closed_on)} />
        </dl>
        {group.notes ? <p className="record-detail__notes">{group.notes}</p> : null}
      </DetailSection>
      <DetailSection title="Activity snapshot">
        <div className="record-detail__stat-grid">
          <span>
            <strong>{membersLoading ? '—' : formatCount(members.length)}</strong>
            Members
          </span>
          <span>
            <strong>{formatDateTime(syncUpdatedAt(group))}</strong>
            Updated
          </span>
        </div>
      </DetailSection>
      <DetailSection title="Members in this group">
        {membersLoading ? <div className="state-box">Loading group members...</div> : null}
        {!membersLoading && members.length === 0 ? <p className="table-note">No active members recorded for this group.</p> : null}
        {members.length > 0 ? (
          <div className="record-detail__related-list">
            {members.slice(0, 6).map((member) => (
              <Link key={member.id} to={`/communities/${group.community}/members/${member.id}`}>
                <span>
                  <strong>{memberName(member)}</strong>
                  <small>{member.member_number || member.phone || 'Member details'}</small>
                </span>
                <StatusBadge status={member.status} />
              </Link>
            ))}
          </div>
        ) : null}
      </DetailSection>
    </>
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
          groupMembers={selectedGroupMembersQuery.data ?? []}
          groupMembersLoading={selectedGroupMembersQuery.isLoading}
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
