from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.common.serializers import ApprovalStateSerializerMixin

from .models import Group, GroupActivity, GroupActivityStatus, GroupActivityType


class GroupSerializer(ApprovalStateSerializerMixin, serializers.ModelSerializer):
    community_name = serializers.CharField(source="community.name", read_only=True)
    member_count = serializers.SerializerMethodField()
    female_count = serializers.SerializerMethodField()
    male_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            "id",
            "community",
            "community_name",
            "code",
            "name",
            "status",
            "formed_on",
            "closed_on",
            "meeting_day",
            "sub_county",
            "notes",
            "member_count",
            "female_count",
            "male_count",
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

    @staticmethod
    def _member_count(obj, annotation_name, *, gender=None):
        annotated_value = getattr(obj, annotation_name, None)
        if annotated_value is not None:
            return annotated_value
        members = obj.members.filter(is_deleted=False)
        if gender:
            members = members.filter(gender__iexact=gender)
        return members.count()

    def get_member_count(self, obj):
        return self._member_count(obj, "member_count")

    def get_female_count(self, obj):
        return self._member_count(obj, "female_count", gender="female")

    def get_male_count(self, obj):
        return self._member_count(obj, "male_count", gender="male")

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


class GroupActivitySerializer(
    ApprovalStateSerializerMixin, serializers.ModelSerializer
):
    community_name = serializers.CharField(source="community.name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    committee_name = serializers.CharField(source="committee.name", read_only=True)
    actual_participant_count = serializers.SerializerMethodField()
    record_status = serializers.SerializerMethodField()

    class Meta:
        model = GroupActivity
        fields = [
            "id",
            "community",
            "community_name",
            "group",
            "group_name",
            "committee",
            "committee_name",
            "activity_type",
            "title",
            "starts_at",
            "ends_at",
            "status",
            "location_text",
            "facilitator_name",
            "expected_participant_count",
            "women_attendance_count",
            "men_attendance_count",
            "actual_participant_count",
            "agenda",
            "minutes",
            "decisions_actions",
            "training_topic",
            "objectives",
            "report_notes",
            "notes",
            "record_status",
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
            "actual_participant_count",
            "record_status",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "sync_version",
            "is_deleted",
        ]

    def get_actual_participant_count(self, obj):
        if (
            obj.women_attendance_count is None
            and obj.men_attendance_count is None
        ):
            return None
        return (obj.women_attendance_count or 0) + (obj.men_attendance_count or 0)

    def get_record_status(self, obj):
        if obj.status == GroupActivityStatus.CANCELLED:
            return "cancelled"
        if obj.status == GroupActivityStatus.PLANNED:
            return "planned"
        attendance_complete = (
            obj.women_attendance_count is not None
            and obj.men_attendance_count is not None
        )
        narrative_complete = bool(
            obj.report_notes.strip()
            or (
                obj.activity_type == GroupActivityType.MEETING
                and obj.minutes.strip()
            )
        )
        return "complete" if attendance_complete and narrative_complete else "needs_attention"

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
        instance = GroupActivity(**data)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs
