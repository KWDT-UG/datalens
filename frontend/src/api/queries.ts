import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiDelete, apiGet, apiPatch, apiPost, initializeCsrf } from './client';
import { useOptionalAuth } from '../auth/AuthContext';
import { executeOrQueue } from '../offline/sync';
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
  CommitteeMembership,
  CommitteeMembershipInput,
  Community,
  CommunityCreateInput,
  Cooperative,
  CooperativeCreateInput,
  CooperativeMembership,
  CooperativeMembershipInput,
  DashboardData,
  DataEnvelope,
  Group,
  GroupActivity,
  GroupActivityCreateInput,
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
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
  Program,
  ProgramInput,
  ProfileUpdateInput,
  Resource,
  ResourceCategory,
  ResourceCategoryInput,
  ResourceCreateInput,
  ResourceDetail,
  ResourcePaymentObligation,
  ResourcePaymentObligationInput,
  ResourcePaymentTransaction,
  ResourcePaymentTransactionInput,
  ThematicArea,
  ThematicAreaInput
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

export function useProgramsQuery(
  thematicArea?: string | number,
  enabled = true,
  status: string | null = 'active'
) {
  return useListQuery<Program>(
    'programs',
    '/api/v1/programs/',
    {
      page: 1,
      page_size: 200,
      ordering: 'display_order,name',
      thematic_area: thematicArea,
      status: status ?? undefined
    },
    enabled
  );
}

export function useResourceCategoriesQuery(
  program?: string | number,
  enabled = true,
  status: string | null = 'active'
) {
  return useListQuery<ResourceCategory>(
    'resource-categories',
    '/api/v1/resource-categories/',
    {
      page: 1,
      page_size: 300,
      ordering: 'display_order,name',
      program,
      status: status ?? undefined
    },
    enabled
  );
}

export function useCreateThematicAreaMutation() {
  return useCreateListMutation<ThematicArea, ThematicAreaInput>(
    'thematic-areas',
    '/api/v1/thematic-areas/',
    'thematic_area'
  );
}

export function useUpdateThematicAreaMutation() {
  return useUpdateListMutation<ThematicArea, ThematicAreaInput>(
    'thematic-areas',
    '/api/v1/thematic-areas/',
    'thematic_area'
  );
}

export function useCreateProgramMutation() {
  return useCreateListMutation<Program, ProgramInput>(
    'programs',
    '/api/v1/programs/',
    'program'
  );
}

export function useUpdateProgramMutation() {
  return useUpdateListMutation<Program, ProgramInput>(
    'programs',
    '/api/v1/programs/',
    'program'
  );
}

export function useCreateResourceCategoryMutation() {
  return useCreateListMutation<ResourceCategory, ResourceCategoryInput>(
    'resource-categories',
    '/api/v1/resource-categories/',
    'resource_category'
  );
}

export function useUpdateResourceCategoryMutation() {
  return useUpdateListMutation<ResourceCategory, ResourceCategoryInput>(
    'resource-categories',
    '/api/v1/resource-categories/',
    'resource_category'
  );
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

export function useResendAdminInvitationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      apiPost<
        DataEnvelope<{ invitation: AdminInvitation; invitation_url: string }>,
        Record<string, never>
      >(`/api/v1/admin/invitations/${id}/resend/`, {}),
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

export function usePasswordResetRequestMutation() {
  return useMutation({
    mutationFn: async (payload: PasswordResetRequestInput) => {
      await initializeCsrf();
      return apiPost<
        DataEnvelope<{ message: string }>,
        PasswordResetRequestInput
      >('/api/v1/auth/password-reset/request/', payload);
    }
  });
}

export function usePasswordResetConfirmMutation() {
  return useMutation({
    mutationFn: async (payload: PasswordResetConfirmInput) => {
      await initializeCsrf();
      return apiPost<
        DataEnvelope<{ message: string }>,
        PasswordResetConfirmInput
      >('/api/v1/auth/password-reset/confirm/', payload);
    }
  });
}

export function usePasswordResetTokenQuery(uid: string, token: string) {
  return useQuery({
    queryKey: ['password-reset-token', uid, token],
    queryFn: () =>
      apiGet<DataEnvelope<{ valid: boolean }>>(
        '/api/v1/auth/password-reset/validate/',
        { uid, token }
      ),
    enabled: Boolean(uid && token),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false
  });
}

export function useHealthQuery() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet<HealthResponse>('/health/'),
    staleTime: 60_000
  });
}

export function useDashboardQuery(params: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: ['dashboard', params],
    queryFn: () => apiGet<DataEnvelope<DashboardData>>('/api/v1/dashboard/', params),
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
  const userId = useOptionalAuth()?.user?.id;

  return useMutation({
    mutationFn: (payload: CommunityCreateInput) =>
      executeOrQueue({
        action: 'create',
        entityType: 'community',
        payload: payload as unknown as Record<string, unknown>,
        userId,
        execute: () =>
          apiPost<Community, CommunityCreateInput>('/api/v1/communities/', payload)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

function invalidateOperationalQueries(queryClient: ReturnType<typeof useQueryClient>, key: string) {
  queryClient.invalidateQueries({ queryKey: [key] });
  if (key === 'members') {
    queryClient.invalidateQueries({ queryKey: ['group-members'] });
  }
  queryClient.invalidateQueries({ queryKey: ['communities'] });
  queryClient.invalidateQueries({ queryKey: ['community'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}

function useUpdateListMutation<T, TPayload>(
  key: string,
  path: string,
  entityType: string
) {
  const queryClient = useQueryClient();
  const userId = useOptionalAuth()?.user?.id;

  return useMutation({
    mutationFn: ({
      id,
      payload,
      syncVersion
    }: {
      id: number;
      payload: Partial<TPayload>;
      syncVersion?: number;
    }) =>
      executeOrQueue({
        action: 'update',
        entityId: id,
        entityType,
        payload: payload as Record<string, unknown>,
        syncVersion,
        userId,
        execute: () => apiPatch<T, Partial<TPayload>>(`${path}${id}/`, payload)
      }),
    onSuccess: () => invalidateOperationalQueries(queryClient, key)
  });
}

export function useUpdateCommunityMutation() {
  return useUpdateListMutation<Community, CommunityCreateInput>(
    'communities',
    '/api/v1/communities/',
    'community'
  );
}

function useListQuery<T>(key: string, path: string, params: ListParams, enabled = true) {
  return useQuery({
    queryKey: [key, params],
    queryFn: () => apiGet<PaginatedResponse<T>>(path, params),
    enabled
  });
}

function useCreateListMutation<T, TPayload>(
  key: string,
  path: string,
  entityType: string
) {
  const queryClient = useQueryClient();
  const userId = useOptionalAuth()?.user?.id;

  return useMutation({
    mutationFn: (payload: TPayload) =>
      executeOrQueue({
        action: 'create',
        entityType,
        payload: payload as Record<string, unknown>,
        userId,
        execute: () => apiPost<T, TPayload>(path, payload)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [key] });
      if (key === 'members') {
        queryClient.invalidateQueries({ queryKey: ['group-members'] });
      }
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

const entityTypeByKey: Record<string, string> = {
  communities: 'community',
  groups: 'group',
  'group-activities': 'group_activity',
  members: 'member',
  institutions: 'institution',
  committees: 'committee',
  cooperatives: 'cooperative',
  resources: 'resource',
  'impact-records': 'impact_record',
  'approval-requests': 'approval_request'
};

function cachedSyncVersion(
  queryClient: ReturnType<typeof useQueryClient>,
  key: string,
  id: number
) {
  for (const [, value] of queryClient.getQueriesData({ queryKey: [key] })) {
    const results = (value as { results?: Array<{ id?: number; sync_version?: number }> })
      ?.results;
    const match = results?.find((record) => record.id === id);
    if (match?.sync_version !== undefined) {
      return match.sync_version;
    }
  }
  return undefined;
}

export function useArchiveRecordsMutation(key: string, path: string) {
  const queryClient = useQueryClient();
  const userId = useOptionalAuth()?.user?.id;

  return useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          executeOrQueue({
            action: 'delete',
            entityId: id,
            entityType: entityTypeByKey[key] ?? key.replace(/-/g, '_'),
            syncVersion: cachedSyncVersion(queryClient, key, id),
            userId,
            execute: () => apiDelete(`${path}${id}/`)
          })
        )
      );
      const failedIds = results.flatMap((result, index) => result.status === 'rejected' ? [ids[index]] : []);
      const successfulIds = results.flatMap((result, index) => result.status === 'fulfilled' ? [ids[index]] : []);
      if (failedIds.length > 0) {
        const firstFailure = results.find((result) => result.status === 'rejected');
        throw new BatchArchiveError(failedIds, successfulIds, firstFailure?.status === 'rejected' ? firstFailure.reason : undefined);
      }
      return { successfulIds };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [key] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export class BatchArchiveError extends Error {
  failedIds: number[];
  successfulIds: number[];

  constructor(failedIds: number[], successfulIds: number[], cause: unknown) {
    const detail = cause instanceof Error ? cause.message : 'The selected record could not be archived.';
    super(failedIds.length === 1 ? detail : `${failedIds.length} records could not be archived. ${detail}`);
    this.name = 'BatchArchiveError';
    this.failedIds = failedIds;
    this.successfulIds = successfulIds;
  }
}

export function useRestoreRecordsMutation(key: string, path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: number[]) =>
      Promise.all(ids.map((id) => apiPost(`${path}${id}/restore/`, {}))),
    onSuccess: () => invalidateOperationalQueries(queryClient, key)
  });
}

export function usePermanentDeleteMutation(key: string, path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => apiDelete(`${path}${id}/permanent-delete/`),
    onSettled: () => invalidateOperationalQueries(queryClient, key)
  });
}

export function useMembersQuery(params: ListParams, enabled = true) {
  return useListQuery<Member>('members', '/api/v1/members/', params, enabled);
}

export function useMemberQuery(memberId?: string | number, enabled = true) {
  return useQuery({
    queryKey: ['member', memberId],
    queryFn: () => apiGet<Member>(`/api/v1/members/${memberId}/`),
    enabled: Boolean(memberId) && enabled
  });
}

export function useCreateMemberMutation() {
  return useCreateListMutation<Member, MemberCreateInput>(
    'members',
    '/api/v1/members/',
    'member'
  );
}

export function useUpdateMemberMutation() {
  return useUpdateListMutation<Member, MemberCreateInput>(
    'members',
    '/api/v1/members/',
    'member'
  );
}

export function useGroupsQuery(params: ListParams, enabled = true) {
  return useListQuery<Group>('groups', '/api/v1/groups/', params, enabled);
}

export function useGroupQuery(groupId?: string | number, enabled = true) {
  return useQuery({
    queryKey: ['group', groupId],
    queryFn: () => apiGet<Group>(`/api/v1/groups/${groupId}/`),
    enabled: Boolean(groupId) && enabled
  });
}

export function useGroupMembersQuery(groupId?: string | number, enabled = true) {
  return useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => apiGet<Member[]>(`/api/v1/groups/${groupId}/members/`),
    enabled: Boolean(groupId) && enabled
  });
}

export function useCreateGroupMutation() {
  return useCreateListMutation<Group, GroupCreateInput>(
    'groups',
    '/api/v1/groups/',
    'group'
  );
}

export function useUpdateGroupMutation() {
  return useUpdateListMutation<Group, GroupCreateInput>(
    'groups',
    '/api/v1/groups/',
    'group'
  );
}

export function useGroupActivitiesQuery(params: ListParams, enabled = true) {
  return useListQuery<GroupActivity>(
    'group-activities',
    '/api/v1/group-activities/',
    params,
    enabled
  );
}

export function useCreateGroupActivityMutation() {
  return useCreateListMutation<GroupActivity, GroupActivityCreateInput>(
    'group-activities',
    '/api/v1/group-activities/',
    'group_activity'
  );
}

export function useUpdateGroupActivityMutation() {
  return useUpdateListMutation<GroupActivity, GroupActivityCreateInput>(
    'group-activities',
    '/api/v1/group-activities/',
    'group_activity'
  );
}

export function useInstitutionsQuery(params: ListParams, enabled = true) {
  return useListQuery<Institution>('institutions', '/api/v1/institutions/', params, enabled);
}

export function useInstitutionQuery(institutionId?: string | number, enabled = true) {
  return useQuery({
    queryKey: ['institution', institutionId],
    queryFn: () => apiGet<Institution>(`/api/v1/institutions/${institutionId}/`),
    enabled: Boolean(institutionId) && enabled
  });
}

export function useCreateInstitutionMutation() {
  return useCreateListMutation<Institution, InstitutionCreateInput>(
    'institutions',
    '/api/v1/institutions/',
    'institution'
  );
}

export function useUpdateInstitutionMutation() {
  return useUpdateListMutation<Institution, InstitutionCreateInput>(
    'institutions',
    '/api/v1/institutions/',
    'institution'
  );
}

export function useCommitteesQuery(params: ListParams, enabled = true) {
  return useListQuery<Committee>('committees', '/api/v1/committees/', params, enabled);
}

export function useCommitteeQuery(committeeId?: string | number, enabled = true) {
  return useQuery({
    queryKey: ['committee', committeeId],
    queryFn: () => apiGet<Committee>(`/api/v1/committees/${committeeId}/`),
    enabled: Boolean(committeeId) && enabled
  });
}

export function useCommitteeMembershipsQuery(params: ListParams, enabled = true) {
  return useListQuery<CommitteeMembership>(
    'committee-memberships',
    '/api/v1/committee-memberships/',
    params,
    enabled
  );
}

export function useCreateCommitteeMembershipMutation() {
  return useCreateListMutation<CommitteeMembership, CommitteeMembershipInput>(
    'committee-memberships',
    '/api/v1/committee-memberships/',
    'committee_membership'
  );
}

export function useUpdateCommitteeMembershipMutation() {
  return useUpdateListMutation<CommitteeMembership, CommitteeMembershipInput>(
    'committee-memberships',
    '/api/v1/committee-memberships/',
    'committee_membership'
  );
}

export function useCreateCommitteeMutation() {
  return useCreateListMutation<Committee, CommitteeCreateInput>(
    'committees',
    '/api/v1/committees/',
    'committee'
  );
}

export function useUpdateCommitteeMutation() {
  return useUpdateListMutation<Committee, CommitteeCreateInput>(
    'committees',
    '/api/v1/committees/',
    'committee'
  );
}

export function useCooperativesQuery(params: ListParams, enabled = true) {
  return useListQuery<Cooperative>('cooperatives', '/api/v1/cooperatives/', params, enabled);
}

export function useCooperativeQuery(cooperativeId?: string | number, enabled = true) {
  return useQuery({
    queryKey: ['cooperative', cooperativeId],
    queryFn: () => apiGet<Cooperative>(`/api/v1/cooperatives/${cooperativeId}/`),
    enabled: Boolean(cooperativeId) && enabled
  });
}

export function useCooperativeMembershipsQuery(params: ListParams, enabled = true) {
  return useListQuery<CooperativeMembership>(
    'cooperative-memberships',
    '/api/v1/cooperative-memberships/',
    params,
    enabled
  );
}

export function useCreateCooperativeMembershipMutation() {
  return useCreateListMutation<CooperativeMembership, CooperativeMembershipInput>(
    'cooperative-memberships',
    '/api/v1/cooperative-memberships/',
    'cooperative_membership'
  );
}

export function useUpdateCooperativeMembershipMutation() {
  return useUpdateListMutation<CooperativeMembership, CooperativeMembershipInput>(
    'cooperative-memberships',
    '/api/v1/cooperative-memberships/',
    'cooperative_membership'
  );
}

export function useCreateCooperativeMutation() {
  return useCreateListMutation<Cooperative, CooperativeCreateInput>(
    'cooperatives',
    '/api/v1/cooperatives/',
    'cooperative'
  );
}

export function useUpdateCooperativeMutation() {
  return useUpdateListMutation<Cooperative, CooperativeCreateInput>(
    'cooperatives',
    '/api/v1/cooperatives/',
    'cooperative'
  );
}

export function useResourcesQuery(params: ListParams, enabled = true) {
  return useListQuery<Resource>('resources', '/api/v1/resources/', params, enabled);
}

export function useResourceDetailQuery(id?: number) {
  return useQuery({
    queryKey: ['resource-detail', id],
    queryFn: () => apiGet<ResourceDetail>(`/api/v1/resources/${id}/detail/`),
    enabled: Boolean(id)
  });
}

export function useCreateResourcePaymentObligationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ResourcePaymentObligationInput) =>
      apiPost<ResourcePaymentObligation | ApprovalSubmission, ResourcePaymentObligationInput>(
        '/api/v1/resource-payment-obligations/',
        payload
      ),
    onSuccess: (_result, payload) => {
      queryClient.invalidateQueries({ queryKey: ['resource-detail', payload.resource] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    }
  });
}

export function useCreateResourcePaymentTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ResourcePaymentTransactionInput) =>
      apiPost<ResourcePaymentTransaction | ApprovalSubmission, ResourcePaymentTransactionInput>(
        '/api/v1/resource-payment-transactions/',
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-detail'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    }
  });
}

export function useReverseResourcePaymentTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload
    }: {
      id: number;
      payload: { effective_on: string; reference?: string; notes?: string };
    }) =>
      apiPost<
        ResourcePaymentTransaction | ApprovalSubmission,
        { effective_on: string; reference?: string; notes?: string }
      >(
        `/api/v1/resource-payment-transactions/${id}/reverse/`,
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-detail'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    }
  });
}

export function useCreateResourceMutation() {
  const queryClient = useQueryClient();
  const userId = useOptionalAuth()?.user?.id;

  return useMutation({
    mutationFn: (payload: ResourceCreateInput) =>
      executeOrQueue({
        action: 'create',
        entityType: 'resource',
        payload: payload as unknown as Record<string, unknown>,
        userId,
        execute: () =>
          apiPost<Resource | ApprovalSubmission, ResourceCreateInput>(
            '/api/v1/resources/',
            payload
          )
      }),
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
  const userId = useOptionalAuth()?.user?.id;

  return useMutation({
    mutationFn: ({
      id,
      payload,
      syncVersion
    }: {
      id: number;
      payload: Partial<ResourceCreateInput>;
      syncVersion?: number;
    }) =>
      executeOrQueue({
        action: 'update',
        entityId: id,
        entityType: 'resource',
        payload,
        syncVersion,
        userId,
        execute: () =>
          apiPatch<Resource | ApprovalSubmission, Partial<ResourceCreateInput>>(
            `/api/v1/resources/${id}/`,
            payload
          )
      }),
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
  const userId = useOptionalAuth()?.user?.id;

  return useMutation({
    mutationFn: (payload: ImpactRecordCreateInput) =>
      executeOrQueue({
        action: 'create',
        entityType: 'impact_record',
        payload: payload as unknown as Record<string, unknown>,
        userId,
        execute: () =>
          apiPost<ImpactRecord | ApprovalSubmission, ImpactRecordCreateInput>(
            '/api/v1/impact-records/',
            payload
          )
      }),
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
  const userId = useOptionalAuth()?.user?.id;

  return useMutation({
    mutationFn: ({
      id,
      payload,
      syncVersion
    }: {
      id: number;
      payload: Partial<ImpactRecordCreateInput>;
      syncVersion?: number;
    }) =>
      executeOrQueue({
        action: 'update',
        entityId: id,
        entityType: 'impact_record',
        payload,
        syncVersion,
        userId,
        execute: () =>
          apiPatch<
            ImpactRecord | ApprovalSubmission,
            Partial<ImpactRecordCreateInput>
          >(`/api/v1/impact-records/${id}/`, payload)
      }),
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
