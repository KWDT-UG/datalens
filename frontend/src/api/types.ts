export type RecordStatus = 'active' | 'inactive' | 'archived' | string;
export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'needs_changes'
  | 'superseded'
  | string;
export type SyncStatus = 'synced' | 'pending_sync' | 'sync_failed' | 'conflict';

export interface SyncMetadata {
  client_mutation_id?: string;
  sync_version?: number;
  is_deleted?: boolean;
}

export interface ApiErrorItem {
  attr?: string;
  detail: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ListParams extends Record<string, string | number | undefined> {
  page: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  community?: string | number;
  include_deleted?: string | number;
}

export interface DataEnvelope<T> {
  data: T;
  meta: Record<string, string | number | null | undefined>;
  errors: ApiErrorItem[];
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  workforce_type: string | null;
  position_title: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  roles: string[];
  capabilities: string[];
  assigned_districts?: string[];
  assigned_community_ids?: number[];
  assigned_thematic_area_ids?: number[];
}

export interface ProfileUpdateInput {
  email?: string;
  first_name?: string;
  last_name?: string;
  position_title?: string;
  current_password?: string;
  new_password?: string;
}

export interface LoginResponse {
  user: AuthUser;
}

export interface PasswordResetRequestInput {
  identifier: string;
}

export interface PasswordResetConfirmInput {
  uid: string;
  token: string;
  new_password: string;
}

export interface AdminAccount {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  role: string | null;
  workforce_type: string | null;
  position_title: string;
  first_name: string;
  last_name: string;
  last_login: string | null;
  date_joined: string;
  assigned_districts?: string[];
  assigned_community_ids?: number[];
  assigned_thematic_area_ids?: number[];
}

export interface AdminRoleDefinition {
  value: string;
  label: string;
  capabilities: string[];
  group_name: string;
}

export interface AdminAccountCreateInput {
  username: string;
  email?: string;
  password: string;
  role: string;
  first_name?: string;
  last_name?: string;
  workforce_type: string;
  position_title?: string;
  is_active: boolean;
  assigned_districts?: string[];
  assigned_community_ids?: number[];
  assigned_thematic_area_ids?: number[];
}

export interface AdminAccountUpdateInput {
  email?: string;
  password?: string;
  role?: string;
  first_name?: string;
  last_name?: string;
  workforce_type?: string;
  position_title?: string;
  is_active?: boolean;
  assigned_districts?: string[];
  assigned_community_ids?: number[];
  assigned_thematic_area_ids?: number[];
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired' | string;

export interface AdminInvitation {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  workforce_type: string;
  position_title: string;
  role: string;
  status: InvitationStatus;
  invited_by_user_id: number;
  invited_at: string;
  last_sent_at: string | null;
  resend_count: number;
  expires_at: string;
  accepted_at: string | null;
  accepted_user_id: number | null;
  revoked_at: string | null;
  can_resend: boolean;
}

export interface AdminInvitationCreateInput {
  email: string;
  first_name?: string;
  last_name?: string;
  workforce_type: string;
  position_title?: string;
  role: string;
}

export interface Community extends SyncMetadata {
  id: number;
  name: string;
  area_name?: string;
  district_name?: string;
  region_name?: string;
  country?: string;
  status?: RecordStatus;
  notes?: string;
  member_count?: number;
  group_count?: number;
  committee_count?: number;
  cooperative_count?: number;
  resource_count?: number;
  institution_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardMetrics {
  community_count: number;
  group_count: number;
  active_member_count: number;
  institution_count: number;
  resource_count: number;
  pending_approval_count: number;
  beneficiary_count: number;
  household_count: number;
}

export interface DashboardActivity {
  type: string;
  id: number;
  label: string;
  community_id: number;
  community_name: string;
  updated_at: string;
  path: string;
}

export interface DashboardProgrammeLens {
  code: string;
  name: string;
  resource_count: number;
  beneficiary_count: number;
}

export interface DashboardTrendPoint {
  as_of_date: string;
  beneficiary_count: number;
}

export interface DashboardAttentionItem {
  label: string;
  detail: string;
  path: string;
  type: 'approval' | 'resource';
}

export interface DashboardData {
  metrics: DashboardMetrics;
  resource_status: Array<{ status: string; count: number }>;
  programme_lenses: DashboardProgrammeLens[];
  selected_thematic_area: string;
  selected_period: string;
  impact_trend: DashboardTrendPoint[];
  attention: DashboardAttentionItem[];
  recent_activity: DashboardActivity[];
}

export interface CommunityCreateInput {
  name: string;
  area_name?: string;
  district_name?: string;
  region_name?: string;
  country?: string;
  status?: RecordStatus;
  notes?: string;
}

export interface Group extends SyncMetadata {
  id: number;
  community: number;
  community_name?: string;
  code?: string;
  name: string;
  status?: RecordStatus;
  formed_on?: string | null;
  closed_on?: string | null;
  meeting_day?: string;
  notes?: string;
}

export interface GroupCreateInput {
  community: number;
  code: string;
  name: string;
  status?: RecordStatus;
  formed_on?: string;
  closed_on?: string;
  meeting_day?: string;
  notes?: string;
}

export interface Member extends SyncMetadata {
  id: number;
  community: number;
  community_name?: string;
  group: number;
  group_name?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  status?: RecordStatus;
  member_number?: string;
  middle_name?: string;
  preferred_name?: string;
  gender?: string;
  date_of_birth?: string | null;
  address_text?: string;
  joined_on?: string | null;
  left_on?: string | null;
  deceased_on?: string | null;
  notes?: string;
}

export interface MemberCreateInput {
  community: number;
  group: number;
  member_number?: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  preferred_name?: string;
  gender?: string;
  date_of_birth?: string;
  phone?: string;
  email?: string;
  address_text?: string;
  status?: RecordStatus;
  joined_on?: string;
  left_on?: string;
  deceased_on?: string;
  notes?: string;
}

export interface Institution extends SyncMetadata {
  id: number;
  community: number;
  community_name?: string;
  code?: string;
  name: string;
  institution_type?: string;
  status?: RecordStatus;
  contact_name?: string;
  phone?: string;
  email?: string;
  location_text?: string;
  notes?: string;
}

export interface InstitutionCreateInput {
  community: number;
  code?: string;
  name: string;
  institution_type?: string;
  status?: RecordStatus;
  contact_name?: string;
  phone?: string;
  email?: string;
  location_text?: string;
  notes?: string;
}

export interface Committee extends SyncMetadata {
  id: number;
  community: number;
  community_name?: string;
  name: string;
  committee_type?: string;
  status?: RecordStatus;
  description?: string;
  formed_on?: string | null;
  closed_on?: string | null;
}

export interface CommitteeCreateInput {
  community: number;
  name: string;
  committee_type?: string;
  status?: RecordStatus;
  description?: string;
  formed_on?: string;
  closed_on?: string;
}

export interface CommitteeMembership extends SyncMetadata {
  id: number;
  committee: number;
  member: number;
  role_name?: string;
  status?: RecordStatus;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string;
}

export interface Cooperative extends SyncMetadata {
  id: number;
  community: number;
  community_name?: string;
  name: string;
  cooperative_type?: string;
  status?: RecordStatus;
  description?: string;
  formed_on?: string | null;
  closed_on?: string | null;
}

export interface CooperativeCreateInput {
  community: number;
  name: string;
  cooperative_type?: string;
  status?: RecordStatus;
  description?: string;
  formed_on?: string;
  closed_on?: string;
}

export interface ResourceThematicArea {
  id: number;
  thematic_area_id: number;
  code: string;
  name: string;
  is_primary: boolean;
}

export interface ThematicArea {
  id: number;
  code: string;
  name: string;
  description?: string;
  status?: RecordStatus;
}

export interface Resource extends SyncMetadata {
  id: number;
  community: number;
  community_name?: string;
  name: string;
  description?: string;
  resource_type: string;
  status?: RecordStatus;
  owner_type?: string;
  owner_id?: number;
  quantity?: string;
  unit?: string;
  value_amount?: string;
  value_currency?: string;
  acquired_on?: string | null;
  location_text?: string;
  serial_or_tag_number?: string;
  source_notes?: string;
  thematic_areas?: ResourceThematicArea[];
  updated_at?: string;
  approval_status?: ApprovalStatus | null;
  pending_approval_request_id?: number | null;
  approval_history_count?: number;
}

export interface ResourceCreateInput {
  community: number;
  owner_type: string;
  owner_id: number;
  resource_type: string;
  name: string;
  description?: string;
  quantity?: string;
  unit?: string;
  value_amount?: string;
  value_currency?: string;
  acquired_on?: string;
  status?: RecordStatus;
  location_text?: string;
  serial_or_tag_number?: string;
  source_notes?: string;
}

export interface ImpactRecord extends SyncMetadata {
  id: number;
  resource: number;
  resource_name?: string;
  community?: number;
  community_name?: string;
  beneficiary_type?: string | null;
  beneficiary_id?: number | null;
  period_type: string;
  period_start?: string | null;
  period_end?: string | null;
  as_of_date: string;
  beneficiary_count?: number;
  household_count?: number;
  member_count?: number;
  institution_count?: number;
  notes?: string;
  method?: string;
  updated_at?: string;
  approval_status?: ApprovalStatus | null;
  pending_approval_request_id?: number | null;
  approval_history_count?: number;
}

export interface ImpactSummary {
  record_count: number;
  beneficiary_count: number;
  household_count: number;
  member_count: number;
  institution_count: number;
}

export interface ImpactByCommunityRow extends ImpactSummary {
  community: number;
  community_name: string;
}

export interface ImpactByResourceRow extends ImpactSummary {
  resource: number;
  resource_name: string;
}

export interface ImpactRecordCreateInput {
  resource: number;
  beneficiary_type?: string;
  beneficiary_id?: number;
  period_type?: string;
  period_start?: string;
  period_end?: string;
  as_of_date?: string;
  beneficiary_count?: number;
  household_count?: number;
  member_count?: number;
  institution_count?: number;
  notes?: string;
  method?: string;
}

export interface ApprovalRequest {
  id: number;
  community: number;
  community_name?: string;
  entity_type: string;
  entity_id?: number | null;
  action_type: string;
  submitted_payload?: Record<string, unknown>;
  diff_summary?: Record<string, unknown> | null;
  review_scope: 'standard' | 'impact' | 'finance' | string;
  policy_reason?: string;
  submission_source?: 'api' | 'offline_sync' | 'manual' | string;
  base_sync_version?: number | null;
  status: ApprovalStatus;
  submitted_by_user_id?: number | null;
  submitted_at?: string;
  reviewed_by_user_id?: number | null;
  reviewed_at?: string | null;
  review_notes?: string;
  applied_at?: string | null;
  updated_at?: string;
  target_display?: string;
}

export interface ApprovalSubmission {
  approval_required: true;
  detail: string;
  approval_request: ApprovalRequest;
}

export interface OfflineQueuedResult {
  offline_queued: true;
  queue_id: number;
  client_mutation_id: string;
  sync_status: 'pending_sync';
}

export function isOfflineQueuedResult(value: unknown): value is OfflineQueuedResult {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { offline_queued?: unknown }).offline_queued === true
  );
}

export function isApprovalSubmission(
  value: unknown
): value is ApprovalSubmission {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { approval_required?: unknown }).approval_required === true
  );
}

export interface HealthResponse {
  status: string;
}
