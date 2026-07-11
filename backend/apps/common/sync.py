import base64
import binascii
import hashlib
import json

from django.db.models import Q
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
from apps.common.models import (
    ApprovalActionType,
    ApprovalSubmissionSource,
    SyncMutationReceipt,
)
from apps.common.permissions import (
    SUBMIT_FOR_APPROVAL,
    user_has_capability,
    user_is_mvp_staff_admin,
)
from apps.common.scoping import enforce_change_scope, scope_queryset_for_user

MAX_SYNC_RECORDS = 100
MAX_SYNC_PAGE_SIZE = 200


def encode_sync_cursor(updated_at, object_id):
    payload = json.dumps(
        {"updated_at": updated_at.isoformat(), "id": object_id},
        separators=(",", ":"),
    ).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def decode_sync_cursor(value):
    try:
        padded = value + "=" * (-len(value) % 4)
        payload = json.loads(
            base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
        )
        updated_at = parse_datetime(payload["updated_at"])
        object_id = int(payload["id"])
    except (
        binascii.Error,
        KeyError,
        TypeError,
        UnicodeDecodeError,
        ValueError,
        json.JSONDecodeError,
    ) as exc:
        raise ValidationError(
            {"cursor": "Cursor is invalid or malformed."}
        ) from exc
    if updated_at is None:
        raise ValidationError({"cursor": "Cursor timestamp is invalid."})
    return updated_at, object_id


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
        cursor = request.query_params.get("cursor")
        include_deleted = request.query_params.get("include_deleted", "1").lower()
        try:
            page_size = min(
                max(int(request.query_params.get("page_size", MAX_SYNC_RECORDS)), 1),
                MAX_SYNC_PAGE_SIZE,
            )
        except ValueError:
            raise ValidationError({"page_size": "page_size must be an integer."})
        if cursor and not entity_type:
            raise ValidationError(
                {"entity_type": "entity_type is required when using cursor."}
            )

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
        cursor_position = decode_sync_cursor(cursor) if cursor else None
        cursors = {}
        has_more_by_entity = {}

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
            if cursor_position is not None:
                cursor_time, cursor_id = cursor_position
                queryset = queryset.filter(
                    Q(updated_at__gt=cursor_time)
                    | Q(updated_at=cursor_time, id__gt=cursor_id)
                )
            rows = list(queryset[: page_size + 1])
            has_more = len(rows) > page_size
            page = rows[:page_size]
            data[current_type] = serializer_class(
                page,
                many=True,
                context={"request": request},
            ).data
            has_more_by_entity[current_type] = has_more
            cursors[current_type] = (
                encode_sync_cursor(page[-1].updated_at, page[-1].pk)
                if page
                else None
            )

        response_status = status.HTTP_400_BAD_REQUEST if errors else status.HTTP_200_OK
        return Response(
            {
                "data": data,
                "meta": {
                    "page_size": page_size,
                    "max_page_size": MAX_SYNC_PAGE_SIZE,
                    "next_cursor": cursors.get(entity_type) if entity_type else None,
                    "next_cursors": cursors,
                    "has_more": (
                        has_more_by_entity.get(entity_type, False)
                        if entity_type
                        else any(has_more_by_entity.values())
                    ),
                    "has_more_by_entity": has_more_by_entity,
                    "sync_contract": "record_version_v2",
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
            if not isinstance(payload, dict):
                errors.append(
                    {
                        "index": index,
                        "attr": "payload",
                        "detail": "payload must be an object.",
                        "code": "invalid",
                    }
                )
                continue
            client_mutation_id = change.get("client_mutation_id", "") or payload.get(
                "client_mutation_id", ""
            )
            if not isinstance(client_mutation_id, str) or len(client_mutation_id) > 128:
                errors.append(
                    {
                        "index": index,
                        "attr": "client_mutation_id",
                        "detail": (
                            "client_mutation_id must be a string of at most "
                            "128 characters."
                        ),
                        "code": "invalid",
                    }
                )
                continue

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
            receipt = None
            if client_mutation_id:
                receipt, replayed_item, receipt_error = self.claim_mutation(
                    request=request,
                    change=change,
                    model=model,
                    action=action,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    client_mutation_id=client_mutation_id,
                )
                if receipt_error is not None:
                    receipt_error["index"] = index
                    errors.append(receipt_error)
                    continue
                if replayed_item is not None:
                    replayed_item["index"] = index
                    accepted.append(replayed_item)
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
                self.release_mutation(receipt)
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
                self.release_mutation(receipt)
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
                if decision.required and not user_is_mvp_staff_admin(request.user):
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
                    accepted_item = {
                        "index": index,
                        "entity_type": entity_type,
                        "id": entity_id,
                        "action": action,
                        "status": "pending_approval",
                        "client_mutation_id": client_mutation_id,
                        "replayed": not _created,
                        "approval_request": ApprovalRequestSerializer(
                            approval_request,
                            context={"request": request},
                        ).data,
                    }
                    self.complete_mutation(receipt, accepted_item)
                    accepted.append(accepted_item)
                    continue
                applied = self.apply_change(
                    action=action,
                    payload=payload,
                    instance=instance,
                    serializer_class=serializer_class,
                    user=request.user if request.user.is_authenticated else None,
                    client_mutation_id=client_mutation_id,
                )
            except ValidationError as exc:
                self.release_mutation(receipt)
                errors.append(
                    {
                        "index": index,
                        "attr": "payload",
                        "detail": exc.detail,
                        "code": "invalid",
                    }
                )
                continue

            accepted_item = {
                "index": index,
                "entity_type": entity_type,
                "id": applied.pk if applied is not None else entity_id,
                "action": action,
                "status": "applied",
                "client_mutation_id": client_mutation_id,
                "replayed": False,
            }
            self.complete_mutation(receipt, accepted_item)
            accepted.append(accepted_item)

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
                    "sync_contract": "record_version_v2",
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

    def mutation_fingerprint(self, change):
        payload = {
            "action": change.get("action"),
            "entity_type": change.get("entity_type"),
            "id": change.get("id"),
            "payload": change.get("payload", {}),
            "sync_version": change.get("sync_version"),
        }
        encoded = json.dumps(
            payload,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def claim_mutation(
        self,
        *,
        request,
        change,
        model,
        action,
        entity_type,
        entity_id,
        client_mutation_id,
    ):
        fingerprint = self.mutation_fingerprint(change)
        receipt, created = SyncMutationReceipt.objects.get_or_create(
            user_id=request.user.pk,
            client_mutation_id=client_mutation_id,
            defaults={"request_fingerprint": fingerprint},
        )
        if created:
            return receipt, None, None
        if receipt.request_fingerprint != fingerprint:
            return (
                receipt,
                None,
                {
                    "attr": "client_mutation_id",
                    "detail": (
                        "client_mutation_id was already used for a different change."
                    ),
                    "code": "mutation_id_reused",
                },
            )
        if receipt.response_payload:
            replayed_item = dict(receipt.response_payload)
            replayed_item["replayed"] = True
            return receipt, replayed_item, None

        replayed = self.find_replayed_change(
            model=model,
            action=action,
            entity_id=entity_id,
            client_mutation_id=client_mutation_id,
            user_id=request.user.pk,
            user=request.user,
        )
        if replayed is not None:
            replayed_item = {
                "entity_type": entity_type,
                "id": replayed.pk,
                "action": action,
                "status": "applied",
                "client_mutation_id": client_mutation_id,
                "replayed": True,
            }
            self.complete_mutation(receipt, replayed_item)
            return receipt, replayed_item, None
        return (
            receipt,
            None,
            {
                "attr": "client_mutation_id",
                "detail": "This mutation is already being processed.",
                "code": "mutation_in_progress",
            },
        )

    def complete_mutation(self, receipt, accepted_item):
        if receipt is None:
            return
        receipt.response_payload = {
            key: value for key, value in accepted_item.items() if key != "index"
        }
        receipt.save(update_fields=["response_payload", "updated_at"])

    def release_mutation(self, receipt):
        if receipt is not None and not receipt.response_payload:
            receipt.delete()

    def find_replayed_change(
        self,
        *,
        model,
        action,
        entity_id,
        client_mutation_id,
        user_id,
        user,
    ):
        if not client_mutation_id:
            return None
        queryset = model.objects.filter(
            client_mutation_id=client_mutation_id,
            updated_by_user_id=user_id,
        )
        if action == ApprovalActionType.CREATE:
            queryset = queryset.filter(created_by_user_id=user_id)
        elif entity_id is not None:
            queryset = queryset.filter(pk=entity_id)
        return scope_queryset_for_user(queryset, user).first()

    def apply_change(
        self,
        action,
        payload,
        instance,
        serializer_class,
        user=None,
        client_mutation_id="",
    ):
        user_id = user.pk if user is not None else None
        save_kwargs = {}
        if user_id is not None:
            save_kwargs["updated_by_user_id"] = user_id

        if action == ApprovalActionType.CREATE:
            serializer = serializer_class(data=payload)
            serializer.is_valid(raise_exception=True)
            if user_id is not None:
                save_kwargs["created_by_user_id"] = user_id
            if client_mutation_id:
                save_kwargs["client_mutation_id"] = client_mutation_id
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
            if client_mutation_id:
                save_kwargs["client_mutation_id"] = client_mutation_id
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
            if client_mutation_id:
                instance.client_mutation_id = client_mutation_id
                update_fields.append("client_mutation_id")
            instance.save(update_fields=update_fields)
            return instance

        raise ValidationError({"action": "Unsupported sync action."})
