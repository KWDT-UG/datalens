from django.utils.dateparse import parse_datetime
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.approvals.policy import (
    approval_policy_for_change,
    community_id_for_change,
    queue_approval_request,
    required_capability_for_entity,
)
from apps.approvals.serializers import ApprovalRequestSerializer
from apps.approvals.services import APPROVAL_ENTITY_REGISTRY
from apps.common.models import ApprovalActionType, ApprovalSubmissionSource
from apps.common.permissions import SUBMIT_FOR_APPROVAL, user_has_capability
from apps.common.scoping import enforce_change_scope, scope_queryset_for_user

MAX_SYNC_RECORDS = 100


class SyncPushSerializer(serializers.Serializer):
    changes = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=True,
    )


class SyncPullView(APIView):
    """Read-side sync stub for offline-ready clients."""

    def get(self, request):
        entity_type = request.query_params.get("entity_type")
        updated_after = request.query_params.get("updated_after")
        include_deleted = request.query_params.get("include_deleted", "1").lower()

        entity_types = (
            [entity_type] if entity_type else sorted(APPROVAL_ENTITY_REGISTRY)
        )
        data = {}
        errors = []

        since = parse_datetime(updated_after) if updated_after else None
        if updated_after and since is None:
            return Response(
                {
                    "data": {},
                    "meta": {},
                    "errors": [
                        {
                            "attr": "updated_after",
                            "detail": "updated_after must be an ISO 8601 datetime.",
                            "code": "invalid",
                        }
                    ],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        for current_type in entity_types:
            registry_item = APPROVAL_ENTITY_REGISTRY.get(current_type)
            if registry_item is None:
                errors.append(
                    {
                        "attr": "entity_type",
                        "detail": f"Unsupported entity_type '{current_type}'.",
                        "code": "invalid",
                    }
                )
                continue

            model, serializer_class = registry_item
            queryset = scope_queryset_for_user(
                model.objects.all(),
                request.user,
            ).order_by("updated_at", "id")
            if hasattr(model, "is_deleted") and include_deleted not in {
                "1",
                "true",
                "yes",
            }:
                queryset = queryset.filter(is_deleted=False)
            if since is not None and hasattr(model, "updated_at"):
                queryset = queryset.filter(updated_at__gt=since)
            data[current_type] = serializer_class(
                queryset[:MAX_SYNC_RECORDS],
                many=True,
                context={"request": request},
            ).data

        response_status = status.HTTP_400_BAD_REQUEST if errors else status.HTTP_200_OK
        return Response(
            {
                "data": data,
                "meta": {
                    "max_records_per_entity": MAX_SYNC_RECORDS,
                    "sync_contract": "record_version_v1",
                },
                "errors": errors,
            },
            status=response_status,
        )


class SyncPushView(APIView):
    """Write-side sync endpoint with coarse record-level conflict detection."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SyncPushSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        accepted = []
        conflicts = []
        errors = []

        for index, change in enumerate(serializer.validated_data["changes"]):
            entity_type = change.get("entity_type")
            entity_id = change.get("id")
            client_sync_version = change.get("sync_version")
            action = change.get(
                "action",
                ApprovalActionType.UPDATE if entity_id else ApprovalActionType.CREATE,
            )
            payload = change.get("payload", {})

            registry_item = APPROVAL_ENTITY_REGISTRY.get(entity_type)
            if registry_item is None:
                errors.append(
                    {
                        "index": index,
                        "attr": "entity_type",
                        "detail": "Unsupported entity_type.",
                        "code": "invalid",
                    }
                )
                continue

            model, serializer_class = registry_item
            required_capability = required_capability_for_entity(entity_type)
            if not user_has_capability(request.user, required_capability):
                errors.append(
                    {
                        "index": index,
                        "attr": "entity_type",
                        "detail": "User cannot mutate this entity type.",
                        "code": "permission_denied",
                    }
                )
                continue
            instance = (
                scope_queryset_for_user(
                    model.objects.filter(pk=entity_id),
                    request.user,
                ).first()
                if entity_id is not None
                else None
            )
            if entity_id is not None and instance is None:
                conflicts.append(
                    {
                        "index": index,
                        "entity_type": entity_type,
                        "id": entity_id,
                        "code": "not_found",
                        "server": None,
                    }
                )
                continue

            server_sync_version = getattr(instance, "sync_version", None)
            if (
                client_sync_version is not None
                and server_sync_version is not None
                and client_sync_version != server_sync_version
            ):
                conflicts.append(
                    {
                        "index": index,
                        "entity_type": entity_type,
                        "id": entity_id,
                        "code": "version_mismatch",
                        "client_sync_version": client_sync_version,
                        "server_sync_version": server_sync_version,
                        "server": serializer_class(instance).data,
                    }
                )
                continue

            try:
                if entity_type == "resource":
                    from apps.approvals.policy import resource_change_is_financial
                    from apps.common.permissions import MANAGE_RESOURCE_FINANCIALS

                    if resource_change_is_financial(
                        action_type=action,
                        payload=payload,
                        instance=instance,
                    ) and not user_has_capability(
                        request.user,
                        MANAGE_RESOURCE_FINANCIALS,
                    ):
                        raise ValidationError(
                            {
                                "value_amount": (
                                    "User cannot change sensitive resource "
                                    "financial values."
                                )
                            }
                        )
                enforce_change_scope(
                    user=request.user,
                    entity_type=entity_type,
                    payload=payload,
                    instance=instance,
                )
                self.validate_change(
                    action=action,
                    payload=payload,
                    instance=instance,
                    serializer_class=serializer_class,
                )
                decision = approval_policy_for_change(
                    entity_type=entity_type,
                    action_type=action,
                    payload=payload,
                    instance=instance,
                )
                if decision.required and not request.user.is_superuser:
                    if not user_has_capability(request.user, SUBMIT_FOR_APPROVAL):
                        raise ValidationError(
                            {
                                "approval": (
                                    "User cannot submit changes for approval."
                                )
                            }
                        )
                    community_id = community_id_for_change(
                        entity_type=entity_type,
                        payload=payload,
                        instance=instance,
                    )
                    if community_id is None:
                        raise ValidationError(
                            {
                                "community": (
                                    "Could not determine the community for approval."
                                )
                            }
                        )
                    approval_request, _created = queue_approval_request(
                        community_id=community_id,
                        entity_type=entity_type,
                        entity_id=entity_id or 0,
                        action_type=action,
                        payload=payload,
                        submitted_by_user_id=request.user.pk,
                        decision=decision,
                        submission_source=ApprovalSubmissionSource.OFFLINE_SYNC,
                        client_mutation_id=change.get("client_mutation_id", "")
                        or payload.get("client_mutation_id", ""),
                        instance=instance,
                    )
                    accepted.append(
                        {
                            "index": index,
                            "entity_type": entity_type,
                            "id": entity_id,
                            "action": action,
                            "status": "pending_approval",
                            "approval_request": ApprovalRequestSerializer(
                                approval_request,
                                context={"request": request},
                            ).data,
                        }
                    )
                    continue
                applied = self.apply_change(
                    action=action,
                    payload=payload,
                    instance=instance,
                    serializer_class=serializer_class,
                    user=request.user if request.user.is_authenticated else None,
                )
            except ValidationError as exc:
                errors.append(
                    {
                        "index": index,
                        "attr": "payload",
                        "detail": exc.detail,
                        "code": "invalid",
                    }
                )
                continue

            accepted.append(
                {
                    "index": index,
                    "entity_type": entity_type,
                    "id": applied.pk if applied is not None else entity_id,
                    "action": action,
                    "status": "applied",
                }
            )

        return Response(
            {
                "data": {
                    "accepted": accepted,
                    "conflicts": conflicts,
                },
                "meta": {
                    "applied": sum(
                        item["status"] == "applied" for item in accepted
                    ),
                    "pending_approval": sum(
                        item["status"] == "pending_approval" for item in accepted
                    ),
                    "sync_contract": "record_version_v1",
                },
                "errors": errors,
            },
            status=status.HTTP_409_CONFLICT if conflicts else status.HTTP_200_OK,
        )

    def validate_change(self, action, payload, instance, serializer_class):
        if action == ApprovalActionType.CREATE:
            serializer = serializer_class(data=payload)
            serializer.is_valid(raise_exception=True)
            return
        if instance is None:
            raise ValidationError(
                {"id": "Existing record id is required for this action."}
            )
        if action == ApprovalActionType.UPDATE:
            serializer = serializer_class(instance, data=payload, partial=True)
            serializer.is_valid(raise_exception=True)
            return
        if action != ApprovalActionType.DELETE:
            raise ValidationError({"action": "Unsupported sync action."})

    def apply_change(self, action, payload, instance, serializer_class, user=None):
        user_id = user.pk if user is not None else None
        save_kwargs = {}
        if user_id is not None:
            save_kwargs["updated_by_user_id"] = user_id

        if action == ApprovalActionType.CREATE:
            serializer = serializer_class(data=payload)
            serializer.is_valid(raise_exception=True)
            if user_id is not None:
                save_kwargs["created_by_user_id"] = user_id
            return serializer.save(**save_kwargs)

        if instance is None:
            raise ValidationError(
                {"id": "Existing record id is required for this action."}
            )

        if action == ApprovalActionType.UPDATE:
            serializer = serializer_class(instance, data=payload, partial=True)
            serializer.is_valid(raise_exception=True)
            if hasattr(instance, "sync_version"):
                save_kwargs["sync_version"] = instance.sync_version + 1
            return serializer.save(**save_kwargs)

        if action == ApprovalActionType.DELETE:
            instance.is_deleted = True
            update_fields = ["is_deleted", "updated_at"]
            if user_id is not None:
                instance.updated_by_user_id = user_id
                update_fields.append("updated_by_user_id")
            if hasattr(instance, "sync_version"):
                instance.sync_version += 1
                update_fields.append("sync_version")
            instance.save(update_fields=update_fields)
            return instance

        raise ValidationError({"action": "Unsupported sync action."})
