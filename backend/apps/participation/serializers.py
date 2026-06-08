from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.common.serializers import ApprovalStateSerializerMixin

from .models import (
    Committee,
    CommitteeMembership,
    Cooperative,
    CooperativeMembership,
)


class CommitteeSerializer(ApprovalStateSerializerMixin, serializers.ModelSerializer):
    community_name = serializers.CharField(source="community.name", read_only=True)

    class Meta:
        model = Committee
        fields = [
            "id",
            "community",
            "community_name",
            "name",
            "committee_type",
            "status",
            "description",
            "formed_on",
            "closed_on",
            "approval_status",
            "pending_approval_request_id",
            "approval_history_count",
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
        instance = Committee(**data)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs


class CommitteeMembershipSerializer(
    ApprovalStateSerializerMixin,
    serializers.ModelSerializer,
):
    class Meta:
        model = CommitteeMembership
        validators = []
        fields = [
            "id",
            "committee",
            "member",
            "role_name",
            "status",
            "start_date",
            "end_date",
            "notes",
            "approval_status",
            "pending_approval_request_id",
            "approval_history_count",
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
        instance = CommitteeMembership(**data)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs


class CooperativeSerializer(ApprovalStateSerializerMixin, serializers.ModelSerializer):
    community_name = serializers.CharField(source="community.name", read_only=True)

    class Meta:
        model = Cooperative
        fields = [
            "id",
            "community",
            "community_name",
            "name",
            "cooperative_type",
            "status",
            "description",
            "formed_on",
            "closed_on",
            "approval_status",
            "pending_approval_request_id",
            "approval_history_count",
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
        instance = Cooperative(**data)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs


class CooperativeMembershipSerializer(
    ApprovalStateSerializerMixin,
    serializers.ModelSerializer,
):
    class Meta:
        model = CooperativeMembership
        validators = []
        fields = [
            "id",
            "cooperative",
            "member",
            "role_name",
            "status",
            "start_date",
            "end_date",
            "notes",
            "approval_status",
            "pending_approval_request_id",
            "approval_history_count",
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
        instance = CooperativeMembership(**data)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs
