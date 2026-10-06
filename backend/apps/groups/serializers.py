from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from apps.common.models import UserRole
from apps.common.permissions import user_role_names
from apps.common.serializers import ApprovalStateSerializerMixin

from .models import (
    ActivityParty,
    ActivityPartyRole,
    ActivityPartyType,
    Group,
    GroupActivity,
    GroupActivityStatus,
    GroupActivityType,
    resolve_activity_party,
)


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


class ActivityPartySerializer(serializers.ModelSerializer):
    party_name = serializers.SerializerMethodField()

    class Meta:
        model = ActivityParty
        fields = ["id", "party_type", "party_id", "party_name", "role"]
        read_only_fields = ["id", "party_name"]

    @staticmethod
    def get_party_name(obj):
        cached_name = getattr(obj, "_resolved_party_name", None)
        return cached_name if cached_name is not None else obj.party_name


class GroupActivityListSerializer(serializers.ListSerializer):
    """Resolve polymorphic party names in four bulk queries for list responses."""

    def to_representation(self, data):
        instances = list(data.all() if hasattr(data, "all") else data)
        parties = [
            party
            for activity in instances
            for party in getattr(activity, "active_parties", [])
        ]
        model_by_type = {
            ActivityPartyType.GROUP: Group,
        }
        from apps.institutions.models import Institution
        from apps.participation.models import Committee, Cooperative

        model_by_type.update(
            {
                ActivityPartyType.COMMITTEE: Committee,
                ActivityPartyType.COOPERATIVE: Cooperative,
                ActivityPartyType.INSTITUTION: Institution,
            }
        )
        names = {}
        for party_type, model in model_by_type.items():
            ids = {p.party_id for p in parties if p.party_type == party_type}
            names.update(
                {
                    (party_type, pk): name
                    for pk, name in model.objects.filter(pk__in=ids).values_list(
                        "pk", "name"
                    )
                }
            )
        for party in parties:
            party._resolved_party_name = names.get(
                (party.party_type, party.party_id), ""
            )
        return super().to_representation(instances)


class GroupActivitySerializer(
    ApprovalStateSerializerMixin, serializers.ModelSerializer
):
    community_name = serializers.CharField(source="community.name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    committee_name = serializers.CharField(source="committee.name", read_only=True)
    actual_participant_count = serializers.SerializerMethodField()
    record_status = serializers.SerializerMethodField()
    parties = ActivityPartySerializer(many=True, required=False)

    class Meta:
        model = GroupActivity
        list_serializer_class = GroupActivityListSerializer
        fields = [
            "id",
            "community",
            "community_name",
            "group",
            "group_name",
            "committee",
            "committee_name",
            "parties",
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

    @staticmethod
    def _default_parties(data):
        committee = data.get("committee")
        group = data.get("group")
        if committee:
            parties = [
                {
                    "party_type": ActivityPartyType.COMMITTEE,
                    "party_id": committee.pk,
                    "role": ActivityPartyRole.SUBJECT,
                }
            ]
            if group:
                parties.append(
                    {
                        "party_type": ActivityPartyType.GROUP,
                        "party_id": group.pk,
                        "role": ActivityPartyRole.AUDIENCE,
                    }
                )
            return parties
        if group:
            return [
                {
                    "party_type": ActivityPartyType.GROUP,
                    "party_id": group.pk,
                    "role": ActivityPartyRole.SUBJECT,
                }
            ]
        return []

    def _validate_parties(self, parties, community):
        if not parties:
            raise serializers.ValidationError(
                {"parties": "At least one activity party is required."}
            )
        subject_count = sum(
            party["role"] == ActivityPartyRole.SUBJECT for party in parties
        )
        if subject_count != 1:
            raise serializers.ValidationError(
                {"parties": "Exactly one activity party must have the subject role."}
            )
        seen = set()
        existing = (
            {
                (party.party_type, party.party_id, party.role)
                for party in self.instance.parties.filter(is_deleted=False)
            }
            if self.instance is not None
            else set()
        )
        for party_data in parties:
            key = (
                party_data["party_type"],
                party_data["party_id"],
                party_data["role"],
            )
            if key in seen:
                raise serializers.ValidationError(
                    {"parties": "Duplicate activity party roles are not allowed."}
                )
            seen.add(key)
            party = resolve_activity_party(
                party_data["party_type"],
                party_data["party_id"],
                include_deleted=False,
            )
            if party is None:
                if key in existing:
                    party = resolve_activity_party(
                        party_data["party_type"], party_data["party_id"]
                    )
                if party is not None:
                    if getattr(party, "community_id", None) != community.pk:
                        raise serializers.ValidationError(
                            {"parties": "Activity parties must belong to the same community."}
                        )
                    continue
                raise serializers.ValidationError(
                    {"parties": "An activity party could not be found."}
                )
            if getattr(party, "community_id", None) != community.pk:
                raise serializers.ValidationError(
                    {"parties": "Activity parties must belong to the same community."}
                )

    @staticmethod
    def _replace_parties(instance, parties, user_id=None):
        instance.parties.filter(is_deleted=False).update(
            is_deleted=True,
            updated_by_user_id=user_id,
        )
        created_parties = ActivityParty.objects.bulk_create(
            [
                ActivityParty(
                    activity=instance,
                    created_by_user_id=user_id,
                    updated_by_user_id=user_id,
                    **party_data,
                )
                for party_data in parties
            ]
        )
        if hasattr(instance, "active_parties"):
            instance.active_parties = created_parties

    @staticmethod
    def _project_legacy_fields(parties):
        def projected_id(party_type):
            matches = [p for p in parties if p["party_type"] == party_type]
            subject = next(
                (p for p in matches if p["role"] == ActivityPartyRole.SUBJECT),
                None,
            )
            selected = subject or (matches[0] if matches else None)
            return selected["party_id"] if selected else None

        return {
            "group_id": projected_id(ActivityPartyType.GROUP),
            "committee_id": projected_id(ActivityPartyType.COMMITTEE),
        }

    @staticmethod
    def _current_parties(instance):
        return [
            {
                "party_type": party.party_type,
                "party_id": party.party_id,
                "role": party.role,
            }
            for party in instance.parties.filter(is_deleted=False)
        ]

    @transaction.atomic
    def create(self, validated_data):
        parties = validated_data.pop("parties", None)
        parties = (
            parties
            if parties is not None
            else self._default_parties(validated_data)
        )
        validated_data.update(self._project_legacy_fields(parties))
        instance = super().create(validated_data)
        self._replace_parties(instance, parties, instance.created_by_user_id)
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        parties = validated_data.pop("parties", None)
        legacy_changed = bool({"group", "committee"} & validated_data.keys())
        if parties is None and legacy_changed:
            effective = {
                "group": validated_data.get("group", instance.group),
                "committee": validated_data.get("committee", instance.committee),
            }
            parties = self._default_parties(effective)
        elif parties is None and not self._current_parties(instance):
            parties = self._default_parties(
                {
                    "group": validated_data.get("group", instance.group),
                    "committee": validated_data.get("committee", instance.committee),
                }
            )
        if parties is not None:
            validated_data.update(self._project_legacy_fields(parties))
        instance = super().update(instance, validated_data)
        if parties is not None:
            self._replace_parties(instance, parties, instance.updated_by_user_id)
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        active_parties = getattr(instance, "active_parties", None)
        if active_parties is None:
            active_parties = instance.parties.filter(is_deleted=False)
        data["parties"] = ActivityPartySerializer(
            active_parties, many=True
        ).data
        request = self.context.get("request")
        if request and user_role_names(request.user) == {
            UserRole.COMMUNICATIONS_VIEWER
        }:
            data["parties"] = [
                party
                for party in data["parties"]
                if party["party_type"] != ActivityPartyType.INSTITUTION
            ]
        return data

    def validate(self, attrs):
        parties = attrs.get("parties")
        data = {}
        if self.instance is not None:
            data.update(
                {
                    field.name: getattr(self.instance, field.name)
                    for field in self.instance._meta.fields
                }
            )
        data.update(attrs)
        data.pop("parties", None)
        if parties is not None:
            projection = self._project_legacy_fields(parties)
            data["group_id"] = projection["group_id"]
            data["committee_id"] = projection["committee_id"]
            data.pop("group", None)
            data.pop("committee", None)
        instance = GroupActivity(**data)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        legacy_changed = bool({"group", "committee"} & attrs.keys())
        effective_parties = parties
        if effective_parties is None and self.instance is None:
            effective_parties = self._default_parties(data)
        elif effective_parties is None and legacy_changed:
            effective_parties = self._default_parties(data)
        elif effective_parties is None and self.instance is not None:
            effective_parties = self._current_parties(self.instance)
            if not effective_parties:
                effective_parties = self._default_parties(data)
        self._validate_parties(effective_parties, data["community"])
        return attrs
