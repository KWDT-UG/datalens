from django.contrib.auth import authenticate
from django.contrib.auth.models import Group
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.models import UserRole
from apps.common.permissions import GROUP_NAME_BY_ROLE, ensure_role_groups, user_role_names


class UserSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField(allow_blank=True)
    is_staff = serializers.BooleanField()
    is_superuser = serializers.BooleanField()
    roles = serializers.ListField(child=serializers.CharField())


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


def serialize_user(user):
    roles = sorted(user_role_names(user))
    return {
        "id": user.id,
        "username": user.get_username(),
        "email": user.email,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "roles": roles,
    }


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        ensure_role_groups()
        if not user.groups.filter(name__in=GROUP_NAME_BY_ROLE.values()).exists():
            user.groups.add(Group.objects.get(name=GROUP_NAME_BY_ROLE[UserRole.FIELD_OFFICER]))
        token, _created = Token.objects.get_or_create(user=user)
        return Response(
            {
                "data": {
                    "token": token.key,
                    "user": serialize_user(user),
                },
                "meta": {"token_type": "Token"},
                "errors": [],
            }
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
