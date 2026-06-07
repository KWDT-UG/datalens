from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.approvals.views import ApprovalRequestViewSet
from apps.common.admin_api import (
    AcceptInvitationView,
    AdminInvitationDetailView,
    AdminInvitationListCreateView,
    AdminRoleListView,
    AdminUserDetailView,
    AdminUserListCreateView,
)
from apps.common.auth import LoginView, LogoutView, MeView
from apps.common.dashboard import DashboardView
from apps.common.sync import SyncPullView, SyncPushView
from apps.communities.views import CommunityViewSet
from apps.groups.views import GroupViewSet
from apps.impacts.views import ImpactRecordViewSet
from apps.institutions.views import InstitutionViewSet
from apps.members.views import MemberViewSet
from apps.participation.views import (
    CommitteeMembershipViewSet,
    CommitteeViewSet,
    CooperativeMembershipViewSet,
    CooperativeViewSet,
)
from apps.resources.views import (
    ResourceBeneficiaryViewSet,
    ResourceThematicAreaViewSet,
    ResourceViewSet,
    ThematicAreaViewSet,
)


def health_check(_request):
    return JsonResponse({"status": "ok"})


router = DefaultRouter()
router.register("communities", CommunityViewSet, basename="community")
router.register("groups", GroupViewSet, basename="group")
router.register("members", MemberViewSet, basename="member")
router.register("institutions", InstitutionViewSet, basename="institution")
router.register("committees", CommitteeViewSet, basename="committee")
router.register(
    "committee-memberships",
    CommitteeMembershipViewSet,
    basename="committee-membership",
)
router.register("cooperatives", CooperativeViewSet, basename="cooperative")
router.register(
    "cooperative-memberships",
    CooperativeMembershipViewSet,
    basename="cooperative-membership",
)
router.register("thematic-areas", ThematicAreaViewSet, basename="thematic-area")
router.register("resources", ResourceViewSet, basename="resource")
router.register(
    "resource-beneficiaries",
    ResourceBeneficiaryViewSet,
    basename="resource-beneficiary",
)
router.register(
    "resource-thematic-areas",
    ResourceThematicAreaViewSet,
    basename="resource-thematic-area",
)
router.register("impact-records", ImpactRecordViewSet, basename="impact-record")
router.register(
    "approval-requests", ApprovalRequestViewSet, basename="approval-request"
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health_check, name="health-check"),
    path("api/v1/auth/login/", LoginView.as_view(), name="auth-login"),
    path("api/v1/auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("api/v1/auth/me/", MeView.as_view(), name="auth-me"),
    path("api/v1/dashboard/", DashboardView.as_view(), name="dashboard"),
    path(
        "api/v1/auth/accept-invitation/",
        AcceptInvitationView.as_view(),
        name="accept-invitation",
    ),
    path(
        "api/v1/admin/users/", AdminUserListCreateView.as_view(), name="admin-user-list"
    ),
    path(
        "api/v1/admin/users/<int:user_id>/",
        AdminUserDetailView.as_view(),
        name="admin-user-detail",
    ),
    path("api/v1/admin/roles/", AdminRoleListView.as_view(), name="admin-role-list"),
    path(
        "api/v1/admin/invitations/",
        AdminInvitationListCreateView.as_view(),
        name="admin-invitation-list",
    ),
    path(
        "api/v1/admin/invitations/<int:invitation_id>/",
        AdminInvitationDetailView.as_view(),
        name="admin-invitation-detail",
    ),
    path("api/v1/", include(router.urls)),
    path("api/v1/sync/pull/", SyncPullView.as_view(), name="sync-pull"),
    path("api/v1/sync/push/", SyncPushView.as_view(), name="sync-push"),
]
