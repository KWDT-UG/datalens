from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from .models import (
    Resource,
    ResourceBeneficiary,
    ResourceStatusEvent,
    ResourceThematicArea,
    ThematicArea,
)


class ThematicAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ThematicArea
        fields = [
            "id",
            "code",
            "name",
            "description",
            "status",
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


class ResourceThematicAreaReadSerializer(serializers.ModelSerializer):
    thematic_area_id = serializers.IntegerField(source="thematic_area.id", read_only=True)
    code = serializers.CharField(source="thematic_area.code", read_only=True)
    name = serializers.CharField(source="thematic_area.name", read_only=True)

    class Meta:
        model = ResourceThematicArea
        fields = ["id", "thematic_area_id", "code", "name", "is_primary"]


class ResourceThematicAreaSerializer(serializers.ModelSerializer):
    code = serializers.CharField(source="thematic_area.code", read_only=True)
    name = serializers.CharField(source="thematic_area.name", read_only=True)

    class Meta:
        model = ResourceThematicArea
        validators = []
        fields = [
            "id",
            "resource",
            "thematic_area",
            "code",
            "name",
            "is_primary",
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
            "code",
            "name",
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "sync_version",
            "is_deleted",
        ]

    def validate(self, attrs):
        resource = attrs.get("resource", self.instance.resource if self.instance else None)
        thematic_area = attrs.get(
            "thematic_area",
            self.instance.thematic_area if self.instance else None,
        )
        if resource is not None and thematic_area is not None:
            queryset = ResourceThematicArea.objects.filter(
                resource=resource,
                thematic_area=thematic_area,
            )
            if self.instance is not None:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"thematic_area": "This thematic area is already linked to the resource."}
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        instance = super().create(validated_data)
        self._ensure_single_primary(instance)
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self._ensure_single_primary(instance)
        return instance

    def _ensure_single_primary(self, instance):
        if instance.is_primary:
            ResourceThematicArea.objects.filter(resource=instance.resource).exclude(
                pk=instance.pk
            ).update(is_primary=False)


class ResourceSerializer(serializers.ModelSerializer):
    thematic_areas = ResourceThematicAreaReadSerializer(
        source="thematic_links",
        many=True,
        read_only=True,
    )
    thematic_area_ids = serializers.PrimaryKeyRelatedField(
        queryset=ThematicArea.objects.filter(is_deleted=False),
        many=True,
        write_only=True,
        required=False,
    )
    primary_thematic_area_id = serializers.PrimaryKeyRelatedField(
        queryset=ThematicArea.objects.filter(is_deleted=False),
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Resource
        fields = [
            "id",
            "community",
            "owner_type",
            "owner_id",
            "resource_type",
            "name",
            "description",
            "quantity",
            "unit",
            "value_amount",
            "value_currency",
            "acquired_on",
            "status",
            "location_text",
            "serial_or_tag_number",
            "source_notes",
            "thematic_areas",
            "thematic_area_ids",
            "primary_thematic_area_id",
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
        data.update(
            {
                key: value
                for key, value in attrs.items()
                if key not in {"thematic_area_ids", "primary_thematic_area_id"}
            }
        )
        instance = Resource(**data)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc

        thematic_areas = attrs.get("thematic_area_ids")
        primary_area = attrs.get("primary_thematic_area_id")
        if thematic_areas is not None:
            thematic_area_ids = {area.id for area in thematic_areas}
            if primary_area is not None and primary_area.id not in thematic_area_ids:
                raise serializers.ValidationError(
                    {
                        "primary_thematic_area_id": (
                            "Primary thematic area must be included in thematic_area_ids."
                        )
                    }
                )
        elif primary_area is not None:
            if self.instance is None:
                raise serializers.ValidationError(
                    {
                        "primary_thematic_area_id": (
                            "thematic_area_ids are required when creating a primary thematic area."
                        )
                    }
                )
            current_ids = set(
                self.instance.thematic_links.filter(is_deleted=False).values_list(
                    "thematic_area_id",
                    flat=True,
                )
            )
            if primary_area.id not in current_ids:
                raise serializers.ValidationError(
                    {
                        "primary_thematic_area_id": (
                            "Primary thematic area must already be linked to the resource."
                        )
                    }
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        thematic_areas = validated_data.pop("thematic_area_ids", None)
        primary_area = validated_data.pop("primary_thematic_area_id", None)
        instance = super().create(validated_data)
        if thematic_areas is not None or primary_area is not None:
            self._sync_thematic_areas(instance, thematic_areas, primary_area)
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        thematic_areas = validated_data.pop("thematic_area_ids", None)
        primary_area = validated_data.pop("primary_thematic_area_id", serializers.empty)
        instance = super().update(instance, validated_data)
        if thematic_areas is not None or primary_area is not serializers.empty:
            actual_primary = None if primary_area is serializers.empty else primary_area
            self._sync_thematic_areas(instance, thematic_areas, actual_primary)
        return instance

    def _sync_thematic_areas(self, instance, thematic_areas, primary_area):
        if thematic_areas is None:
            thematic_areas = [
                link.thematic_area
                for link in instance.thematic_links.filter(is_deleted=False).select_related(
                    "thematic_area"
                )
            ]

        instance.thematic_links.all().delete()
        for thematic_area in thematic_areas:
            ResourceThematicArea.objects.create(
                resource=instance,
                thematic_area=thematic_area,
                is_primary=primary_area is not None and thematic_area.id == primary_area.id,
            )


class ResourceBeneficiarySerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceBeneficiary
        fields = [
            "id",
            "resource",
            "beneficiary_type",
            "beneficiary_id",
            "relationship_type",
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
        instance = ResourceBeneficiary(**data)
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs


class ResourceStatusEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceStatusEvent
        fields = [
            "id",
            "resource",
            "event_type",
            "effective_at",
            "notes",
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
            "created_at",
            "updated_at",
            "created_by_user_id",
            "updated_by_user_id",
            "sync_version",
            "is_deleted",
            "recorded_by_user_id",
        ]
