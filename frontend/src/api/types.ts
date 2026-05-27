export type RecordStatus = 'active' | 'inactive' | 'archived' | string;
export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'needs_changes'
  | 'superseded'
  | string;
export type SyncStatus = 'synced' | 'pending_sync' | 'sync_failed' | 'conflict';

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
  is_staff: boolean;
  is_superuser: boolean;
  roles: string[];
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface Community {
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

export interface CommunityCreateInput {
  name: string;
  area_name?: string;
  district_name?: string;
  region_name?: string;
  country?: string;
  status?: RecordStatus;
  notes?: string;
}

export interface Group {
  id: number;
  community: number;
  code?: string;
  name: string;
  status?: RecordStatus;
  formed_on?: string | null;
  meeting_day?: string;
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

export interface Member {
  id: number;
  community: number;
  group: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  status?: RecordStatus;
  member_number?: string;
  preferred_name?: string;
  joined_on?: string | null;
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
  notes?: string;
}

export interface Institution {
  id: number;
  community: number;
  code?: string;
  name: string;
  institution_type?: string;
  status?: RecordStatus;
  contact_name?: string;
  phone?: string;
  email?: string;
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

export interface Committee {
  id: number;
  community: number;
  name: string;
  committee_type?: string;
  status?: RecordStatus;
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

export interface Cooperative {
  id: number;
  community: number;
  name: string;
  cooperative_type?: string;
  status?: RecordStatus;
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

export interface Resource {
  id: number;
  community: number;
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

export interface ImpactRecord {
  id: number;
  resource: number;
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
  entity_type: string;
  entity_id?: number | null;
  action_type: string;
  submitted_payload?: Record<string, unknown>;
  diff_summary?: Record<string, unknown> | null;
  status: ApprovalStatus;
  submitted_by_user_id?: number | null;
  submitted_at?: string;
  reviewed_by_user_id?: number | null;
  reviewed_at?: string | null;
  review_notes?: string;
  applied_at?: string | null;
  updated_at?: string;
}

export interface HealthResponse {
  status: string;
}
