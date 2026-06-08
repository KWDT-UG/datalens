import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.models import (
    InvitationStatus,
    UserInvitation,
    UserProfile,
    UserRole,
    WorkforceType,
)
from apps.common.permissions import (
    AdminUserAccess,
    GROUP_NAME_BY_ROLE,
    ROLE_CAPABILITIES,
    assign_role,
    ensure_role_groups,
    user_role_names,
)
from apps.communities.models import Community
from apps.resources.models import ThematicArea


class AssignmentFieldsMixin(serializers.Serializer):
    assigned_districts = serializers.ListField(
        child=serializers.CharField(max_length=255),
        required=False,
    )
    assigned_community_ids = serializers.PrimaryKeyRelatedField(
        queryset=Community.objects.filter(is_deleted=False),
        many=True,
        required=False,
        source="assigned_communities",
    )
    assigned_thematic_area_ids = serializers.PrimaryKeyRelatedField(
        queryset=ThematicArea.objects.filter(is_deleted=False),
        many=True,
        required=False,
        source="assigned_thematic_areas",
    )

    def validate_assigned_districts(self, value):
        return sorted({district.strip() for district in value if district.strip()})

    def pop_assignments(self, validated_data):
        return {
            "assigned_districts": validated_data.pop("assigned_districts", None),
            "assigned_communities": validated_data.pop(
                "assigned_communities", None
            ),
            "assigned_thematic_areas": validated_data.pop(
                "assigned_thematic_areas", None
            ),
        }

    def save_assignments(self, profile, assignments):
        if assignments["assigned_districts"] is not None:
            profile.assigned_districts = assignments["assigned_districts"]
            profile.save(update_fields=["assigned_districts", "updated_at"])
        if assignments["assigned_communities"] is not None:
            profile.assigned_communities.set(assignments["assigned_communities"])
        if assignments["assigned_thematic_areas"] is not None:
            profile.assigned_thematic_areas.set(
                assignments["assigned_thematic_areas"]
            )


def serialize_admin_user(user):
    roles = sorted(user_role_names(user))
    profile = getattr(user, "datalens_profile", None)
    return {
        "id": user.id,
        "username": user.get_username(),
        "email": user.email,
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "role": roles[0] if roles else None,
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
        "first_name": user.first_name,
        "last_name": user.last_name,
        "last_login": user.last_login,
        "date_joined": user.date_joined,
    }


class AdminUserCreateSerializer(AssignmentFieldsMixin, serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(min_length=8, write_only=True)
    role = serializers.ChoiceField(choices=UserRole.choices)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    workforce_type = serializers.ChoiceField(
        choices=WorkforceType.choices,
        default=WorkforceType.STAFF,
    )
    position_title = serializers.CharField(required=False, allow_blank=True, max_length=160)
    is_active = serializers.BooleanField(default=True)

    def validate_username(self, value):
        if get_user_model().objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def create(self, validated_data):
        assignments = self.pop_assignments(validated_data)
        role = validated_data.pop("role")
        workforce_type = validated_data.pop("workforce_type")
        position_title = validated_data.pop("position_title", "")
        user = get_user_model().objects.create_user(**validated_data)
        assign_role(user, role)
        profile = UserProfile.objects.create(
            user=user,
            workforce_type=workforce_type,
            position_title=position_title,
        )
        self.save_assignments(profile, assignments)
        return user


class AdminUserUpdateSerializer(AssignmentFieldsMixin, serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(
        required=False,
        allow_blank=False,
        min_length=8,
        write_only=True,
    )
    role = serializers.ChoiceField(choices=UserRole.choices, required=False)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    workforce_type = serializers.ChoiceField(
        choices=WorkforceType.choices,
        required=False,
    )
    position_title = serializers.CharField(required=False, allow_blank=True, max_length=160)
    is_active = serializers.BooleanField(required=False)

    def validate(self, attrs):
        target = self.instance
        request = self.context["request"]

        if target.is_superuser and not request.user.is_superuser:
            raise serializers.ValidationError(
                {"user": "Only a Django superuser can modify another superuser."}
            )
        if target.pk == request.user.pk:
            if attrs.get("is_active") is False:
                raise serializers.ValidationError(
                    {"is_active": "You cannot deactivate your own account."}
                )
            role = attrs.get("role")
            if role is not None and role != UserRole.SYSTEM_ADMINISTRATOR:
                raise serializers.ValidationError(
                    {"role": "You cannot remove your own system administrator role."}
                )
        return attrs

    def update(self, instance, validated_data):
        assignments = self.pop_assignments(validated_data)
        role = validated_data.pop("role", None)
        password = validated_data.pop("password", None)
        workforce_type = validated_data.pop("workforce_type", None)
        position_title = validated_data.pop("position_title", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        if role is not None:
            assign_role(instance, role)
        if (
            workforce_type is not None
            or position_title is not None
            or any(value is not None for value in assignments.values())
        ):
            profile, _created = UserProfile.objects.get_or_create(user=instance)
            if workforce_type is not None:
                profile.workforce_type = workforce_type
            if position_title is not None:
                profile.position_title = position_title
            profile.save()
            self.save_assignments(profile, assignments)
        return instance


def hash_invitation_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def serialize_invitation(invitation):
    is_expired = (
        invitation.status == InvitationStatus.PENDING
        and invitation.expires_at <= timezone.now()
    )
    return {
        "id": invitation.id,
        "email": invitation.email,
        "first_name": invitation.first_name,
        "last_name": invitation.last_name,
        "workforce_type": invitation.workforce_type,
        "position_title": invitation.position_title,
        "role": invitation.role,
        "status": "expired" if is_expired else invitation.status,
        "invited_by_user_id": invitation.invited_by_user_id,
        "invited_at": invitation.invited_at,
        "expires_at": invitation.expires_at,
        "accepted_at": invitation.accepted_at,
        "accepted_user_id": invitation.accepted_user_id,
    }


class AdminInvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    workforce_type = serializers.ChoiceField(
        choices=WorkforceType.choices,
        default=WorkforceType.STAFF,
    )
    position_title = serializers.CharField(required=False, allow_blank=True, max_length=160)
    role = serializers.ChoiceField(choices=UserRole.choices)

    def validate_email(self, value):
        if get_user_model().objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        if UserInvitation.objects.filter(
            email__iexact=value,
            status=InvitationStatus.PENDING,
            expires_at__gt=timezone.now(),
        ).exists():
            raise serializers.ValidationError("A pending invitation already exists.")
        return value


class AcceptInvitationSerializer(serializers.Serializer):
    token = serializers.CharField()
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(min_length=8, write_only=True)

    def validate_username(self, value):
        if get_user_model().objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate(self, attrs):
        invitation = UserInvitation.objects.filter(
            token_hash=hash_invitation_token(attrs["token"])
        ).first()
        if invitation is None:
            raise serializers.ValidationError({"token": "Invitation token is invalid."})
        if invitation.status != InvitationStatus.PENDING:
            raise serializers.ValidationError({"token": "Invitation is no longer pending."})
        if invitation.expires_at <= timezone.now():
            raise serializers.ValidationError({"token": "Invitation has expired."})
        attrs["invitation"] = invitation
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        invitation = validated_data["invitation"]
        user = get_user_model().objects.create_user(
            username=validated_data["username"],
            email=invitation.email,
            password=validated_data["password"],
            first_name=invitation.first_name,
            last_name=invitation.last_name,
        )
        assign_role(user, invitation.role)
        UserProfile.objects.create(
            user=user,
            workforce_type=invitation.workforce_type,
            position_title=invitation.position_title,
        )
        invitation.status = InvitationStatus.ACCEPTED
        invitation.accepted_at = timezone.now()
        invitation.accepted_user = user
        invitation.save(
            update_fields=["status", "accepted_at", "accepted_user"]
        )
        return user


class AdminUserListCreateView(APIView):
    permission_classes = [AdminUserAccess]

    def get(self, request):
        queryset = get_user_model().objects.prefetch_related(
            "datalens_profile__assigned_communities",
            "datalens_profile__assigned_thematic_areas",
        ).order_by("username")
        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) | Q(email__icontains=search)
            )
        users = [serialize_admin_user(user) for user in queryset]
        return Response(
            {
                "data": {"users": users},
                "meta": {"count": len(users)},
                "errors": [],
            }
        )

    def post(self, request):
        serializer = AdminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {"data": {"user": serialize_admin_user(user)}, "meta": {}, "errors": []},
            status=status.HTTP_201_CREATED,
        )


class AdminUserDetailView(APIView):
    permission_classes = [AdminUserAccess]

    def patch(self, request, user_id):
        user = get_user_model().objects.filter(pk=user_id).first()
        if user is None:
            return Response(
                {
                    "errors": [
                        {
                            "attr": None,
                            "detail": "User account was not found.",
                            "code": "not_found",
                        }
                    ]
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = AdminUserUpdateSerializer(
            user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        updated_user = serializer.save()
        return Response(
            {
                "data": {"user": serialize_admin_user(updated_user)},
                "meta": {},
                "errors": [],
            }
        )


class AdminRoleListView(APIView):
    permission_classes = [AdminUserAccess]

    def get(self, request):
        ensure_role_groups()
        roles = [
            {
                "value": role,
                "label": UserRole(role).label,
                "capabilities": sorted(ROLE_CAPABILITIES[role]),
                "group_name": GROUP_NAME_BY_ROLE[role],
            }
            for role in UserRole.values
        ]
        return Response(
            {
                "data": {"roles": roles},
                "meta": {"count": len(roles)},
                "errors": [],
            }
        )


class AdminInvitationListCreateView(APIView):
    permission_classes = [AdminUserAccess]

    def get(self, request):
        invitations = [
            serialize_invitation(invitation)
            for invitation in UserInvitation.objects.all()
        ]
        return Response(
            {
                "data": {"invitations": invitations},
                "meta": {"count": len(invitations)},
                "errors": [],
            }
        )

    def post(self, request):
        serializer = AdminInvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = secrets.token_urlsafe(32)
        invitation = UserInvitation.objects.create(
            **serializer.validated_data,
            token_hash=hash_invitation_token(token),
            invited_by_user_id=request.user.id,
            expires_at=timezone.now() + timedelta(days=7),
        )
        invitation_url = f"{settings.FRONTEND_APP_URL.rstrip('/')}/accept-invite?token={token}"
        send_mail(
            subject="You are invited to KWDT Data Lens",
            message=(
                f"You have been invited to KWDT Data Lens as "
                f"{UserRole(invitation.role).label}.\n\n"
                f"Accept your invitation: {invitation_url}\n\n"
                "This invitation expires in 7 days."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invitation.email],
        )
        return Response(
            {
                "data": {
                    "invitation": serialize_invitation(invitation),
                    "invitation_url": invitation_url,
                },
                "meta": {},
                "errors": [],
            },
            status=status.HTTP_201_CREATED,
        )


class AdminInvitationDetailView(APIView):
    permission_classes = [AdminUserAccess]

    def patch(self, request, invitation_id):
        invitation = UserInvitation.objects.filter(pk=invitation_id).first()
        if invitation is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if request.data.get("status") != InvitationStatus.REVOKED:
            raise serializers.ValidationError(
                {"status": "Only invitation revocation is supported."}
            )
        if invitation.status != InvitationStatus.PENDING:
            raise serializers.ValidationError(
                {"status": "Only pending invitations can be revoked."}
            )
        invitation.status = InvitationStatus.REVOKED
        invitation.save(update_fields=["status"])
        return Response(
            {
                "data": {"invitation": serialize_invitation(invitation)},
                "meta": {},
                "errors": [],
            }
        )


class AcceptInvitationView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "data": {"user": serialize_admin_user(user)},
                "meta": {},
                "errors": [],
            },
            status=status.HTTP_201_CREATED,
        )
