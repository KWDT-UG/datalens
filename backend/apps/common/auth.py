from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.models import UserProfile
from apps.common.authentication import enforce_csrf
from apps.common.permissions import (
    ensure_role_groups,
    user_capabilities,
    user_role_names,
)


class UserSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField(allow_blank=True)
    first_name = serializers.CharField(allow_blank=True)
    last_name = serializers.CharField(allow_blank=True)
    workforce_type = serializers.CharField(allow_null=True)
    position_title = serializers.CharField(allow_blank=True)
    is_active = serializers.BooleanField()
    is_staff = serializers.BooleanField()
    is_superuser = serializers.BooleanField()
    roles = serializers.ListField(child=serializers.CharField())
    capabilities = serializers.ListField(child=serializers.CharField())


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["username"],
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError(
                {"non_field_errors": ["Unable to log in with provided credentials."]}
            )
        if not user.is_active:
            raise serializers.ValidationError(
                {"non_field_errors": ["User account is inactive."]}
            )
        attrs["user"] = user
        return attrs


class ProfileUpdateSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    position_title = serializers.CharField(required=False, allow_blank=True, max_length=160)
    current_password = serializers.CharField(
        required=False,
        allow_blank=False,
        trim_whitespace=False,
        write_only=True,
    )
    new_password = serializers.CharField(
        required=False,
        allow_blank=False,
        trim_whitespace=False,
        write_only=True,
    )

    def validate_email(self, value):
        if value and get_user_model().objects.filter(email__iexact=value).exclude(
            pk=self.instance.pk
        ).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate(self, attrs):
        unexpected_fields = set(self.initial_data) - set(self.fields)
        if unexpected_fields:
            raise serializers.ValidationError(
                {
                    field: "This field cannot be updated from your profile."
                    for field in sorted(unexpected_fields)
                }
            )

        current_password = attrs.get("current_password")
        new_password = attrs.get("new_password")

        if current_password and not new_password:
            raise serializers.ValidationError(
                {"new_password": "Enter a new password to change your password."}
            )
        if new_password:
            if not current_password:
                raise serializers.ValidationError(
                    {"current_password": "Enter your current password."}
                )
            if not self.instance.check_password(current_password):
                raise serializers.ValidationError(
                    {"current_password": "Current password is incorrect."}
                )
            try:
                validate_password(new_password, user=self.instance)
            except DjangoValidationError as error:
                raise serializers.ValidationError(
                    {"new_password": list(error.messages)}
                ) from error
        return attrs

    def update(self, instance, validated_data):
        new_password = validated_data.pop("new_password", None)
        validated_data.pop("current_password", None)
        position_title = validated_data.pop("position_title", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)
        if new_password:
            instance.set_password(new_password)
        instance.save()

        if position_title is not None:
            profile, _created = UserProfile.objects.get_or_create(user=instance)
            profile.position_title = position_title
            profile.save(update_fields=["position_title", "updated_at"])
        return instance


def serialize_user(user):
    roles = sorted(user_role_names(user))
    profile = getattr(user, "datalens_profile", None)
    return {
        "id": user.id,
        "username": user.get_username(),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "workforce_type": profile.workforce_type if profile else None,
        "position_title": profile.position_title if profile else "",
        "assigned_districts": profile.assigned_districts if profile else [],
        "assigned_community_ids": (
            list(profile.assigned_communities.values_list("pk", flat=True))
            if profile
            else []
        ),
        "assigned_thematic_area_ids": (
            list(profile.assigned_thematic_areas.values_list("pk", flat=True))
            if profile
            else []
        ),
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "roles": roles,
        "capabilities": sorted(user_capabilities(user)),
    }


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        enforce_csrf(request)
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        ensure_role_groups()
        Token.objects.filter(user=user).delete()
        token = Token.objects.create(user=user)
        response = Response(
            {
                "data": {
                    "user": serialize_user(user),
                },
                "meta": {"authentication": "HttpOnly cookie"},
                "errors": [],
            }
        )
        response.set_cookie(
            settings.DATALENS_AUTH_COOKIE_NAME,
            token.key,
            max_age=settings.DATALENS_AUTH_COOKIE_MAX_AGE,
            httponly=True,
            secure=settings.DATALENS_AUTH_COOKIE_SECURE,
            samesite=settings.DATALENS_AUTH_COOKIE_SAMESITE,
            path="/",
        )
        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(
            settings.DATALENS_AUTH_COOKIE_NAME,
            path="/",
            samesite=settings.DATALENS_AUTH_COOKIE_SAMESITE,
        )
        return response


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfTokenView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {"data": {}, "meta": {"csrf_cookie": "set"}, "errors": []}
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "data": {"user": serialize_user(request.user)},
                "meta": {},
                "errors": [],
            }
        )

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "data": {"user": serialize_user(user)},
                "meta": {},
                "errors": [],
            }
        )
