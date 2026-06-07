from django.db import models
from django.conf import settings


class RecordStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"
    ARCHIVED = "archived", "Archived"


class MemberStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"
    DECEASED = "deceased", "Deceased"
    EXITED = "exited", "Exited"


class InstitutionType(models.TextChoices):
    SCHOOL = "school", "School"
    CHURCH = "church", "Church"
    CLINIC = "clinic", "Clinic"
    COMMUNITY_CENTER = "community_center", "Community Center"
    COOPERATIVE_PARTNER = "cooperative_partner", "Cooperative Partner"
    OTHER = "other", "Other"


class MembershipStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"
    ENDED = "ended", "Ended"
    ARCHIVED = "archived", "Archived"


class UserRole(models.TextChoices):
    FIELD_OFFICER = "field_officer", "Field Officer"
    PROGRAMME_MANAGER = "programme_manager", "Programme Manager"
    EXECUTIVE_LEADERSHIP = "executive_leadership", "Executive Leadership"
    FINANCE_ADMINISTRATOR = "finance_administrator", "Finance Administrator"
    MONITORING_EVALUATION_MANAGER = (
        "monitoring_evaluation_manager",
        "Monitoring & Evaluation Manager",
    )
    COMMUNICATIONS_VIEWER = "communications_viewer", "Communications Viewer"
    RESOURCE_PROCUREMENT_OFFICER = (
        "resource_procurement_officer",
        "Resource & Procurement Officer",
    )
    SYSTEM_ADMINISTRATOR = "system_administrator", "System Administrator"


class WorkforceType(models.TextChoices):
    STAFF = "staff", "Staff"
    INTERN = "intern", "Intern"
    VOLUNTEER = "volunteer", "Volunteer"
    CONTRACTOR = "contractor", "Contractor"
    OTHER = "other", "Other"


class InvitationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    REVOKED = "revoked", "Revoked"


class ResourcePartyType(models.TextChoices):
    COMMUNITY = "community", "Community"
    GROUP = "group", "Group"
    COOPERATIVE = "cooperative", "Cooperative"
    MEMBER = "member", "Member"
    INSTITUTION = "institution", "Institution"


class BeneficiaryRelationshipType(models.TextChoices):
    PRIMARY = "primary", "Primary"
    SECONDARY = "secondary", "Secondary"
    INDIRECT = "indirect", "Indirect"


class ResourceType(models.TextChoices):
    LIVESTOCK = "livestock", "Livestock"
    TOOL = "tool", "Tool"
    MACHINERY = "machinery", "Machinery"
    LAND_PLOT = "land_plot", "Land Plot"
    GRANT = "grant", "Grant"
    CASH_ASSET = "cash_asset", "Cash Asset"
    BUILDING_MATERIAL = "building_material", "Building Material"
    OTHER = "other", "Other"


class ResourceStatus(models.TextChoices):
    PLANNED = "planned", "Planned"
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"
    TRANSFERRED = "transferred", "Transferred"
    DISPOSED = "disposed", "Disposed"


class ResourceEventType(models.TextChoices):
    CREATED = "created", "Created"
    APPLICATION_SUBMITTED = "application_submitted", "Application Submitted"
    APPROVED = "approved", "Approved"
    PROCUREMENT_STARTED = "procurement_started", "Procurement Started"
    DELIVERED = "delivered", "Delivered"
    IN_USE = "in_use", "In Use"
    MAINTENANCE = "maintenance", "Maintenance"
    COMPLETED = "completed", "Completed"
    TRANSFERRED = "transferred", "Transferred"
    DISPOSED = "disposed", "Disposed"
    OTHER = "other", "Other"


class ImpactMethod(models.TextChoices):
    OBSERVED = "observed", "Observed"
    ESTIMATED = "estimated", "Estimated"
    DERIVED = "derived", "Derived"


class ApprovalActionType(models.TextChoices):
    CREATE = "create", "Create"
    UPDATE = "update", "Update"
    DELETE = "delete", "Delete"


class ApprovalStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    SUPERSEDED = "superseded", "Superseded"


class ApprovalReviewScope(models.TextChoices):
    STANDARD = "standard", "Programme Review"
    IMPACT = "impact", "Impact Review"
    FINANCE = "finance", "Finance Review"


class ApprovalSubmissionSource(models.TextChoices):
    API = "api", "API"
    OFFLINE_SYNC = "offline_sync", "Offline Sync"
    MANUAL = "manual", "Manual"


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class AuditModel(models.Model):
    created_by_user_id = models.PositiveBigIntegerField(null=True, blank=True)
    updated_by_user_id = models.PositiveBigIntegerField(null=True, blank=True)

    class Meta:
        abstract = True


class OfflineMetadataModel(models.Model):
    client_created_at = models.DateTimeField(null=True, blank=True)
    client_updated_at = models.DateTimeField(null=True, blank=True)
    client_mutation_id = models.CharField(max_length=128, blank=True)
    sync_version = models.PositiveIntegerField(default=1)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        abstract = True


class CoreModel(TimestampedModel, AuditModel, OfflineMetadataModel):
    class Meta:
        abstract = True


class UserProfile(TimestampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="datalens_profile",
    )
    workforce_type = models.CharField(
        max_length=32,
        choices=WorkforceType.choices,
        default=WorkforceType.STAFF,
    )
    position_title = models.CharField(max_length=160, blank=True)

    def __str__(self):
        return f"{self.user.get_username()} profile"


class UserInvitation(models.Model):
    email = models.EmailField()
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    workforce_type = models.CharField(
        max_length=32,
        choices=WorkforceType.choices,
        default=WorkforceType.STAFF,
    )
    position_title = models.CharField(max_length=160, blank=True)
    role = models.CharField(max_length=64, choices=UserRole.choices)
    token_hash = models.CharField(max_length=64, unique=True)
    status = models.CharField(
        max_length=32,
        choices=InvitationStatus.choices,
        default=InvitationStatus.PENDING,
    )
    invited_by_user_id = models.PositiveBigIntegerField()
    invited_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="accepted_datalens_invitations",
    )

    class Meta:
        ordering = ["-invited_at"]

    def __str__(self):
        return f"{self.email} [{self.status}]"
