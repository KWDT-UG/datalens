from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Group


class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = [
            "id",
            "community",
            "code",
            "name",
            "status",
            "formed_on",
            "closed_on",
            "meeting_day",
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
        instance = Group(**data)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs
