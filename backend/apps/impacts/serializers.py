from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import ImpactRecord


class ImpactRecordSerializer(serializers.ModelSerializer):
    resource_name = serializers.CharField(source="resource.name", read_only=True)
    community = serializers.IntegerField(
        source="resource.community_id",
        read_only=True,
    )
    community_name = serializers.CharField(
        source="resource.community.name",
        read_only=True,
    )

    class Meta:
        model = ImpactRecord
        fields = [
            "id",
            "resource",
            "resource_name",
            "community",
            "community_name",
            "beneficiary_type",
            "beneficiary_id",
            "period_type",
            "period_start",
            "period_end",
            "as_of_date",
            "beneficiary_count",
            "household_count",
            "member_count",
            "institution_count",
            "notes",
            "method",
            "recorded_by_user_id",
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
            "recorded_by_user_id",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "sync_version",
            "is_deleted",
        ]

    def validate(self, attrs):
        data = {}
        if self.instance is not None:
            data.update(
                {
                    field.name: getattr(self.instance, field.name)
                    for field in self.instance._meta.fields
                }
            )
        data.update(attrs)
        instance = ImpactRecord(**data)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs
