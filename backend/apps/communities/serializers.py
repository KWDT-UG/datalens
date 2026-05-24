from rest_framework import serializers

from .models import Community


class CommunitySerializer(serializers.ModelSerializer):
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
            "area_name",
            "district_name",
            "region_name",
            "country",
            "status",
            "notes",
            "member_count",
            "group_count",
            "committee_count",
            "cooperative_count",
            "resource_count",
            "institution_count",
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
