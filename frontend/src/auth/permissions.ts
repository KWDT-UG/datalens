import type { AuthUser } from '../api/types';

export const capabilities = {
  read: 'read',
  manageOperations: 'manage_operations',
  manageResources: 'manage_resources',
  manageImpact: 'manage_impact',
  archiveOperations: 'archive_operations',
  archiveResources: 'archive_resources',
  archiveImpact: 'archive_impact',
  submitForApproval: 'submit_for_approval',
  reviewApprovals: 'review_approvals',
  reviewImpactApprovals: 'review_impact_approvals',
  reviewFinanceApprovals: 'review_finance_approvals',
  export: 'export',
  manageUsers: 'manage_users',
  manageRoles: 'manage_roles',
  manageSettings: 'manage_settings'
} as const;

export function hasCapability(user: AuthUser | null, capability: string) {
  return Boolean(user?.capabilities.includes(capability));
}

export function hasAnyCapability(user: AuthUser | null, required: string[]) {
  return required.some((capability) => hasCapability(user, capability));
}

export function canReviewApprovals(user: AuthUser | null) {
  return hasAnyCapability(user, [
    capabilities.reviewApprovals,
    capabilities.reviewImpactApprovals,
    capabilities.reviewFinanceApprovals
  ]);
}
