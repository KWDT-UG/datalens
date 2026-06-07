import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import type {
  AdminAccount,
  AdminAccountCreateInput,
  AdminAccountUpdateInput,
  AdminInvitation,
  AdminInvitationCreateInput,
  AdminRoleDefinition,
  ApprovalRequest,
  ApprovalSubmission,
  AuthUser,
  Committee,
  CommitteeCreateInput,
  Community,
  CommunityCreateInput,
  Cooperative,
  CooperativeCreateInput,
  DashboardData,
  DataEnvelope,
  Group,
  GroupCreateInput,
  HealthResponse,
  ImpactByCommunityRow,
  ImpactByResourceRow,
  ImpactRecord,
  ImpactRecordCreateInput,
  ImpactSummary,
  Institution,
  InstitutionCreateInput,
  ListParams,
  Member,
  MemberCreateInput,
  PaginatedResponse,
  ProfileUpdateInput,
  Resource,
  ResourceCreateInput,
  ThematicArea
} from './types';

export function useUpdateProfileMutation() {
  return useMutation({
    mutationFn: (payload: ProfileUpdateInput) =>
      apiPatch<DataEnvelope<{ user: AuthUser }>, ProfileUpdateInput>(
        '/api/v1/auth/me/',
        payload
      )
  });
}

export function useAdminUsersQuery(search = '') {
  return useQuery({
    queryKey: ['admin-users', search],
    queryFn: () =>
      apiGet<DataEnvelope<{ users: AdminAccount[] }>>('/api/v1/admin/users/', {
        search
      })
  });
}

export function useAdminRolesQuery() {
  return useQuery({
    queryKey: ['admin-roles'],
    queryFn: () =>
      apiGet<DataEnvelope<{ roles: AdminRoleDefinition[] }>>('/api/v1/admin/roles/')
  });
}

export function useThematicAreasQuery() {
  return useQuery({
    queryKey: ['thematic-areas'],
    queryFn: () =>
      apiGet<PaginatedResponse<ThematicArea>>('/api/v1/thematic-areas/', {
        page: 1,
        page_size: 200,
        ordering: 'name'
      })
  });
}

export function useCreateAdminUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminAccountCreateInput) =>
      apiPost<DataEnvelope<{ user: AdminAccount }>, AdminAccountCreateInput>(
        '/api/v1/admin/users/',
        payload
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  });
}

export function useUpdateAdminUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AdminAccountUpdateInput }) =>
      apiPatch<DataEnvelope<{ user: AdminAccount }>, AdminAccountUpdateInput>(
        `/api/v1/admin/users/${id}/`,
        payload
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  });
}

export function useAdminInvitationsQuery() {
  return useQuery({
    queryKey: ['admin-invitations'],
    queryFn: () =>
      apiGet<DataEnvelope<{ invitations: AdminInvitation[] }>>(
        '/api/v1/admin/invitations/'
      )
  });
}

export function useCreateAdminInvitationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminInvitationCreateInput) =>
      apiPost<
        DataEnvelope<{ invitation: AdminInvitation; invitation_url: string }>,
        AdminInvitationCreateInput
      >('/api/v1/admin/invitations/', payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] })
  });
}

export function useRevokeAdminInvitationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      apiPatch<
        DataEnvelope<{ invitation: AdminInvitation }>,
        { status: 'revoked' }
      >(`/api/v1/admin/invitations/${id}/`, { status: 'revoked' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] })
  });
}

export function useAcceptInvitationMutation() {
  return useMutation({
    mutationFn: (payload: { token: string; username: string; password: string }) =>
      apiPost<DataEnvelope<{ user: AdminAccount }>, typeof payload>(
        '/api/v1/auth/accept-invitation/',
        payload
      )
  });
}

export function useHealthQuery() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet<HealthResponse>('/health/'),
    staleTime: 60_000
  });
}

export function useDashboardQuery() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiGet<DataEnvelope<DashboardData>>('/api/v1/dashboard/'),
    staleTime: 30_000
  });
}

export function useCommunitiesQuery(params: {
  page: number;
  page_size?: number;
  search?: string;
  ordering?: string;
}, enabled = true) {
  return useQuery({
    queryKey: ['communities', params],
    queryFn: () =>
      apiGet<PaginatedResponse<Community>>('/api/v1/communities/', {
        page: params.page,
        page_size: params.page_size,
        search: params.search,
        ordering: params.ordering
      }),
    enabled
  });
}

export function useCommunityQuery(communityId?: string) {
  return useQuery({
    queryKey: ['community', communityId],
    queryFn: () => apiGet<Community>(`/api/v1/communities/${communityId}/`),
    enabled: Boolean(communityId)
  });
}

export function useCreateCommunityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CommunityCreateInput) =>
      apiPost<Community, CommunityCreateInput>('/api/v1/communities/', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

function invalidateOperationalQueries(queryClient: ReturnType<typeof useQueryClient>, key: string) {
  queryClient.invalidateQueries({ queryKey: [key] });
  queryClient.invalidateQueries({ queryKey: ['communities'] });
  queryClient.invalidateQueries({ queryKey: ['community'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}

function useUpdateListMutation<T, TPayload>(key: string, path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<TPayload> }) =>
      apiPatch<T, Partial<TPayload>>(`${path}${id}/`, payload),
    onSuccess: () => invalidateOperationalQueries(queryClient, key)
  });
}

export function useUpdateCommunityMutation() {
  return useUpdateListMutation<Community, CommunityCreateInput>(
    'communities',
    '/api/v1/communities/'
  );
}

function useListQuery<T>(key: string, path: string, params: ListParams, enabled = true) {
  return useQuery({
    queryKey: [key, params],
    queryFn: () => apiGet<PaginatedResponse<T>>(path, params),
    enabled
  });
}

function useCreateListMutation<T, TPayload>(key: string, path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TPayload) => apiPost<T, TPayload>(path, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [key] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useArchiveRecordsMutation(key: string, path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => apiDelete(`${path}${id}/`))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [key] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useRestoreRecordsMutation(key: string, path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: number[]) =>
      Promise.all(ids.map((id) => apiPost(`${path}${id}/restore/`, {}))),
    onSuccess: () => invalidateOperationalQueries(queryClient, key)
  });
}

export function useMembersQuery(params: ListParams, enabled = true) {
  return useListQuery<Member>('members', '/api/v1/members/', params, enabled);
}

export function useCreateMemberMutation() {
  return useCreateListMutation<Member, MemberCreateInput>('members', '/api/v1/members/');
}

export function useUpdateMemberMutation() {
  return useUpdateListMutation<Member, MemberCreateInput>('members', '/api/v1/members/');
}

export function useGroupsQuery(params: ListParams, enabled = true) {
  return useListQuery<Group>('groups', '/api/v1/groups/', params, enabled);
}

export function useCreateGroupMutation() {
  return useCreateListMutation<Group, GroupCreateInput>('groups', '/api/v1/groups/');
}

export function useUpdateGroupMutation() {
  return useUpdateListMutation<Group, GroupCreateInput>('groups', '/api/v1/groups/');
}

export function useInstitutionsQuery(params: ListParams, enabled = true) {
  return useListQuery<Institution>('institutions', '/api/v1/institutions/', params, enabled);
}

export function useCreateInstitutionMutation() {
  return useCreateListMutation<Institution, InstitutionCreateInput>('institutions', '/api/v1/institutions/');
}

export function useUpdateInstitutionMutation() {
  return useUpdateListMutation<Institution, InstitutionCreateInput>(
    'institutions',
    '/api/v1/institutions/'
  );
}

export function useCommitteesQuery(params: ListParams, enabled = true) {
  return useListQuery<Committee>('committees', '/api/v1/committees/', params, enabled);
}

export function useCreateCommitteeMutation() {
  return useCreateListMutation<Committee, CommitteeCreateInput>('committees', '/api/v1/committees/');
}

export function useUpdateCommitteeMutation() {
  return useUpdateListMutation<Committee, CommitteeCreateInput>(
    'committees',
    '/api/v1/committees/'
  );
}

export function useCooperativesQuery(params: ListParams, enabled = true) {
  return useListQuery<Cooperative>('cooperatives', '/api/v1/cooperatives/', params, enabled);
}

export function useCreateCooperativeMutation() {
  return useCreateListMutation<Cooperative, CooperativeCreateInput>('cooperatives', '/api/v1/cooperatives/');
}

export function useUpdateCooperativeMutation() {
  return useUpdateListMutation<Cooperative, CooperativeCreateInput>(
    'cooperatives',
    '/api/v1/cooperatives/'
  );
}

export function useResourcesQuery(params: ListParams, enabled = true) {
  return useListQuery<Resource>('resources', '/api/v1/resources/', params, enabled);
}

export function useCreateResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ResourceCreateInput) =>
      apiPost<Resource | ApprovalSubmission, ResourceCreateInput>(
        '/api/v1/resources/',
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useUpdateResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ResourceCreateInput> }) =>
      apiPatch<Resource | ApprovalSubmission, Partial<ResourceCreateInput>>(
        `/api/v1/resources/${id}/`,
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community'] });
      queryClient.invalidateQueries({ queryKey: ['impact-records'] });
      queryClient.invalidateQueries({ queryKey: ['impact-summary'] });
      queryClient.invalidateQueries({ queryKey: ['impact-by-community'] });
      queryClient.invalidateQueries({ queryKey: ['impact-by-resource'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useImpactRecordsQuery(params: ListParams, enabled = true) {
  return useListQuery<ImpactRecord>('impact-records', '/api/v1/impact-records/', params, enabled);
}

export function useImpactSummaryQuery(params: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: ['impact-summary', params],
    queryFn: () => apiGet<DataEnvelope<ImpactSummary>>('/api/v1/impact-records/summary/', params)
  });
}

export function useImpactByCommunityQuery(params: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: ['impact-by-community', params],
    queryFn: () => apiGet<DataEnvelope<ImpactByCommunityRow[]>>('/api/v1/impact-records/by-community/', params)
  });
}

export function useImpactByResourceQuery(params: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: ['impact-by-resource', params],
    queryFn: () => apiGet<DataEnvelope<ImpactByResourceRow[]>>('/api/v1/impact-records/by-resource/', params)
  });
}

export function useCreateImpactRecordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ImpactRecordCreateInput) =>
      apiPost<ImpactRecord | ApprovalSubmission, ImpactRecordCreateInput>(
        '/api/v1/impact-records/',
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impact-records'] });
      queryClient.invalidateQueries({ queryKey: ['impact-summary'] });
      queryClient.invalidateQueries({ queryKey: ['impact-by-community'] });
      queryClient.invalidateQueries({ queryKey: ['impact-by-resource'] });
      queryClient.invalidateQueries({ queryKey: ['community'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useUpdateImpactRecordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ImpactRecordCreateInput> }) =>
      apiPatch<ImpactRecord | ApprovalSubmission, Partial<ImpactRecordCreateInput>>(
        `/api/v1/impact-records/${id}/`,
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impact-records'] });
      queryClient.invalidateQueries({ queryKey: ['impact-summary'] });
      queryClient.invalidateQueries({ queryKey: ['impact-by-community'] });
      queryClient.invalidateQueries({ queryKey: ['impact-by-resource'] });
      queryClient.invalidateQueries({ queryKey: ['community'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useApprovalRequestsQuery(params: ListParams, enabled = true) {
  return useListQuery<ApprovalRequest>('approval-requests', '/api/v1/approval-requests/', params, enabled);
}

export function useReviewApprovalMutation(action: 'approve' | 'reject' | 'supersede') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, review_notes }: { id: number; review_notes: string }) =>
      apiPost<ApprovalRequest, { review_notes: string }>(
        `/api/v1/approval-requests/${id}/${action}/`,
        { review_notes }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['impact-records'] });
      queryClient.invalidateQueries({ queryKey: ['impact-summary'] });
      queryClient.invalidateQueries({ queryKey: ['impact-by-community'] });
      queryClient.invalidateQueries({ queryKey: ['impact-by-resource'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}
