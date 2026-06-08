from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.common.viewsets import (
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SimpleFilterMixin,
    SoftDeleteMixin,
)
from apps.members.serializers import MemberSerializer

from .models import Group
from .serializers import GroupSerializer


class GroupViewSet(
    ApprovalPolicyMixin,
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    queryset = Group.objects.select_related("community").all()
    serializer_class = GroupSerializer
    filter_fields = ("community", "status")
    search_fields = ("code", "name", "community__name")
    ordering_fields = ("code", "name", "formed_on", "closed_on", "created_at")

    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        group = self.get_object()
        serializer = MemberSerializer(
            group.members.filter(is_deleted=False),
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(serializer.data)
