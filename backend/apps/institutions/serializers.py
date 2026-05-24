from rest_framework import serializers

from .models import Institution


class InstitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Institution
        fields = [
            "id",
            "community",
            "code",
            "name",
            "institution_type",
            "status",
            "contact_name",
            "phone",
            "email",
            "location_text",
            "notes",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "client_created_at",
            "client_updated_at",
            "client_mutation_id",
            "sync_version",
            "is_deleted",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "sync_version",
            "is_deleted",
        ]
