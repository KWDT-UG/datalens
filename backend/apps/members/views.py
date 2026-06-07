from rest_framework.viewsets import ModelViewSet

from apps.common.viewsets import (
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SimpleFilterMixin,
    SoftDeleteMixin,
)

from .models import Member
from .serializers import MemberSerializer


class MemberViewSet(
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    queryset = Member.objects.select_related("community", "group").all()
    serializer_class = MemberSerializer
    filter_fields = ("community", "group", "status")
    search_fields = (
        "member_number",
        "first_name",
        "last_name",
        "preferred_name",
        "phone",
        "email",
    )
    ordering_fields = ("member_number", "first_name", "last_name", "joined_on", "created_at")
