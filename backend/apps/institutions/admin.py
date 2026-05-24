from django.contrib import admin

from .models import Institution


@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "institution_type", "community", "status")
    list_filter = ("institution_type", "status", "community")
    search_fields = ("code", "name", "contact_name", "phone", "email")
