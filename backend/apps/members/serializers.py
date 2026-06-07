from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Member


class MemberSerializer(serializers.ModelSerializer):
    community_name = serializers.CharField(source="community.name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)

    class Meta:
        model = Member
        fields = [
            "id",
            "community",
            "community_name",
            "group",
            "group_name",
            "member_number",
            "first_name",
            "last_name",
            "middle_name",
            "preferred_name",
            "gender",
            "date_of_birth",
            "phone",
            "email",
            "address_text",
            "status",
            "joined_on",
            "left_on",
            "deceased_on",
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
        instance = Member(**data)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs
