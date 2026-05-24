from rest_framework.viewsets import ModelViewSet

from apps.common.viewsets import AuditFieldsMixin, SimpleFilterMixin, SoftDeleteMixin

from .models import Institution
from .serializers import InstitutionSerializer


class InstitutionViewSet(
    AuditFieldsMixin,
    SoftDeleteMixin,
    SimpleFilterMixin,
    ModelViewSet,
):
    queryset = Institution.objects.select_related("community").all()
    serializer_class = InstitutionSerializer
    filter_fields = ("community", "status", "institution_type")
    search_fields = ("code", "name", "contact_name", "phone", "email")
    ordering_fields = ("code", "name", "institution_type", "created_at")
