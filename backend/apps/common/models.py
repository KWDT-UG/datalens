from django.db import models


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
    PROGRAM_MANAGER = "program_manager", "Program Manager"
    ADMIN = "admin", "Admin"
    LEADERSHIP = "leadership", "Leadership"


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
