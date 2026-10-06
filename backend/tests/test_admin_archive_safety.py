from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase

from apps.common.admin import CoreModelAdminMixin
from apps.common.models import CoreModel


class CoreModelAdminArchiveSafetyTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = get_user_model().objects.create_superuser(
            username="archive.admin.safety",
            email="archive.admin.safety@example.com",
            password="test-password",
        )

    def test_registered_core_models_do_not_expose_hard_delete(self):
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        registered_core_models = [
            (model, model_admin)
            for model, model_admin in admin.site._registry.items()
            if issubclass(model, CoreModel)
        ]

        self.assertTrue(registered_core_models)
        for model, model_admin in registered_core_models:
            with self.subTest(model=model._meta.label):
                self.assertIsInstance(model_admin, CoreModelAdminMixin)
                self.assertFalse(model_admin.has_delete_permission(request))
                self.assertNotIn("delete_selected", model_admin.get_actions(request))
