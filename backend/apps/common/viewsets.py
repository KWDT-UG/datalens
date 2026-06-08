from django.db import IntegrityError
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.common.models import ApprovalActionType, ApprovalSubmissionSource

TRUTHY_VALUES = {"1", "true", "yes", "on"}


class AuditFieldsMixin:
    def perform_create(self, serializer):
        user_id = self.request.user.pk if self.request.user.is_authenticated else None
        serializer.save(created_by_user_id=user_id, updated_by_user_id=user_id)

    def perform_update(self, serializer):
        user_id = self.request.user.pk if self.request.user.is_authenticated else None
        save_kwargs = {"updated_by_user_id": user_id}
        if hasattr(serializer.instance, "sync_version"):
            save_kwargs["sync_version"] = serializer.instance.sync_version + 1
        serializer.save(**save_kwargs)


class SoftDeleteMixin:
    def perform_destroy(self, instance):
        instance.is_deleted = True
        user_id = self.request.user.pk if self.request.user.is_authenticated else None
        instance.updated_by_user_id = user_id
        update_fields = ["is_deleted", "updated_by_user_id", "updated_at"]
        if hasattr(instance, "sync_version"):
            instance.sync_version += 1
            update_fields.append("sync_version")
        instance.save(update_fields=update_fields)

    @action(detail=True, methods=["post"])
    def restore(self, request, *args, **kwargs):
        instance = self.get_object()
        if not instance.is_deleted:
            raise ValidationError({"is_deleted": "Record is not archived."})
        instance.is_deleted = False
        instance.updated_by_user_id = (
            request.user.pk if request.user.is_authenticated else None
        )
        update_fields = ["is_deleted", "updated_by_user_id", "updated_at"]
        if hasattr(instance, "sync_version"):
            instance.sync_version += 1
            update_fields.append("sync_version")
        try:
            instance.save(update_fields=update_fields)
        except IntegrityError as exc:
            raise ValidationError(
                {"restore": "Record conflicts with an active record."}
            ) from exc
        return Response(self.get_serializer(instance).data)


class ActionPermissionMixin:
    permission_classes_by_action = {}

    def get_permissions(self):
        permission_classes = self.permission_classes_by_action.get(
            getattr(self, "action", None),
            self.permission_classes,
        )
        return [permission() for permission in permission_classes]


class ApprovalPolicyMixin:
    approval_entity_type = None

    def get_approval_entity_type(self):
        return self.approval_entity_type or getattr(self, "basename", "").replace(
            "-", "_"
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        queued_response = self._queue_if_required(
            serializer=serializer,
            action_type=ApprovalActionType.CREATE,
            entity_id=0,
            instance=None,
        )
        if queued_response is not None:
            return queued_response
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        queued_response = self._queue_if_required(
            serializer=serializer,
            action_type=ApprovalActionType.UPDATE,
            entity_id=instance.pk,
            instance=instance,
        )
        if queued_response is not None:
            return queued_response
        self.perform_update(serializer)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        queued_response = self._queue_if_required(
            serializer=None,
            action_type=ApprovalActionType.DELETE,
            entity_id=instance.pk,
            instance=instance,
        )
        if queued_response is not None:
            return queued_response
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _queue_if_required(
        self,
        *,
        serializer,
        action_type,
        entity_id,
        instance,
        entity_type=None,
        payload=None,
    ):
        from apps.approvals.policy import (
            approval_policy_for_change,
            community_id_for_change,
            queue_approval_request,
            resource_change_is_financial,
        )
        from apps.approvals.serializers import ApprovalRequestSerializer

        if payload is None:
            payload = (
                dict(self.request.data)
                if action_type != ApprovalActionType.DELETE
                else {}
            )
        entity_type = entity_type or self.get_approval_entity_type()
        from apps.common.permissions import (
            MANAGE_RESOURCE_FINANCIALS,
            user_has_capability,
        )
        from apps.common.scoping import enforce_change_scope

        enforce_change_scope(
            user=self.request.user,
            entity_type=entity_type,
            payload=payload,
            instance=instance,
        )
        if (
            entity_type == "resource"
            and resource_change_is_financial(
                action_type=action_type,
                payload=payload,
                instance=instance,
            )
            and not user_has_capability(
                self.request.user,
                MANAGE_RESOURCE_FINANCIALS,
            )
        ):
            raise PermissionDenied(
                "User cannot change sensitive resource financial values."
            )
        if self.request.user.is_superuser:
            return None

        decision = approval_policy_for_change(
            entity_type=entity_type,
            action_type=action_type,
            payload=payload,
            instance=instance,
        )
        if not decision.required:
            return None

        community_id = community_id_for_change(
            entity_type=entity_type,
            payload=payload,
            instance=instance,
        )
        if community_id is None:
            raise ValidationError(
                {"community": "Could not determine the community for approval."}
            )
        user_id = (
            self.request.user.pk if self.request.user.is_authenticated else None
        )
        approval_request, _created = queue_approval_request(
            community_id=community_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action_type=action_type,
            payload=payload,
            submitted_by_user_id=user_id,
            decision=decision,
            submission_source=ApprovalSubmissionSource.API,
            client_mutation_id=payload.get("client_mutation_id", ""),
            instance=instance,
        )
        return Response(
            {
                "approval_required": True,
                "detail": "Change submitted for approval.",
                "approval_request": ApprovalRequestSerializer(
                    approval_request,
                    context=self.get_serializer_context(),
                ).data,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class SimpleFilterMixin:
    filter_fields: tuple[str, ...] = ()
    search_fields: tuple[str, ...] = ()
    ordering_fields: tuple[str, ...] = ()

    def _is_truthy(self, value):
        return str(value).strip().lower() in TRUTHY_VALUES

    def get_queryset(self):
        queryset = super().get_queryset()
        from apps.common.permissions import (
            required_archive_capability,
            required_restore_capability,
            user_has_capability,
        )
        from apps.common.scoping import scope_queryset_for_user

        queryset = scope_queryset_for_user(queryset, self.request.user)
        include_deleted = self._is_truthy(
            self.request.query_params.get("include_deleted", "")
        )
        if getattr(self, "action", "") == "restore":
            queryset = queryset.filter(is_deleted=True)
        elif hasattr(queryset.model, "is_deleted") and include_deleted:
            if not (
                user_has_capability(
                    self.request.user,
                    required_archive_capability(self),
                )
                or user_has_capability(
                    self.request.user,
                    required_restore_capability(self),
                )
            ):
                raise PermissionDenied(
                    "User cannot view archived records for this resource."
                )
        elif hasattr(queryset.model, "is_deleted"):
            queryset = queryset.filter(is_deleted=False)
        for field in self.filter_fields:
            value = self.request.query_params.get(field)
            if value:
                if "," in value and "__" not in field:
                    queryset = queryset.filter(**{f"{field}__in": value.split(",")})
                else:
                    queryset = queryset.filter(**{field: value})

        search = self.request.query_params.get("search")
        if search and self.search_fields:
            from django.db.models import Q

            query = Q()
            for field in self.search_fields:
                query |= Q(**{f"{field}__icontains": search})
            queryset = queryset.filter(query)

        ordering = self.request.query_params.get("ordering")
        if ordering and self.ordering_fields:
            requested_fields = [
                item.strip()
                for item in ordering.split(",")
                if item.strip()
            ]
            valid_fields = []
            for field in requested_fields:
                normalized = field.lstrip("-")
                if normalized in self.ordering_fields:
                    valid_fields.append(field)
            if valid_fields:
                queryset = queryset.order_by(*valid_fields)
        return queryset
