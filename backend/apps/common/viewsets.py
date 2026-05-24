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


class ActionPermissionMixin:
    permission_classes_by_action = {}

    def get_permissions(self):
        permission_classes = self.permission_classes_by_action.get(
            getattr(self, "action", None),
            self.permission_classes,
        )
        return [permission() for permission in permission_classes]


class SimpleFilterMixin:
    filter_fields: tuple[str, ...] = ()
    search_fields: tuple[str, ...] = ()
    ordering_fields: tuple[str, ...] = ()

    def _is_truthy(self, value):
        return str(value).strip().lower() in TRUTHY_VALUES

    def get_queryset(self):
        queryset = super().get_queryset()
        if hasattr(queryset.model, "is_deleted") and not self._is_truthy(
            self.request.query_params.get("include_deleted", "")
        ):
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
            requested_fields = [item.strip() for item in ordering.split(",") if item.strip()]
            valid_fields = []
            for field in requested_fields:
                normalized = field.lstrip("-")
                if normalized in self.ordering_fields:
                    valid_fields.append(field)
            if valid_fields:
                queryset = queryset.order_by(*valid_fields)
        return queryset
