from rest_framework import serializers

from apps.common.serializers import ApprovalStateSerializerMixin

from .models import Community


class CommunitySerializer(ApprovalStateSerializerMixin, serializers.ModelSerializer):
    # Keep queued offline changes and pending approvals from before the field
    # rename applicable while exposing only the new name in responses.
    area_name = serializers.CharField(write_only=True, required=False)
    member_count = serializers.IntegerField(read_only=True)
    group_count = serializers.IntegerField(read_only=True)
    committee_count = serializers.IntegerField(read_only=True)
    cooperative_count = serializers.IntegerField(read_only=True)
    resource_count = serializers.IntegerField(read_only=True)
    institution_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Community
        fields = [
            "id",
            "name",
            "subcounty_name",
            "area_name",
            "district_name",
            "region_name",
            "country",
            "resident_count",
            "status",
            "notes",
            "member_count",
            "group_count",
            "committee_count",
            "cooperative_count",
            "resource_count",
            "institution_count",
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
        legacy_area_name = attrs.pop("area_name", serializers.empty)
        subcounty_name = attrs.get("subcounty_name", serializers.empty)
        if legacy_area_name is not serializers.empty:
            if (
                subcounty_name is not serializers.empty
                and subcounty_name != legacy_area_name
            ):
                raise serializers.ValidationError(
                    {
                        "area_name": (
                            "Use subcounty_name; the legacy area_name value "
                            "must match when both are supplied."
                        )
                    }
                )
            attrs["subcounty_name"] = legacy_area_name
        return super().validate(attrs)
