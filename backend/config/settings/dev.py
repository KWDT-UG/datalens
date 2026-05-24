from .base import *  # noqa: F403


DEBUG = env_bool("DJANGO_DEBUG", True)  # noqa: F405
ALLOWED_HOSTS = env_list(  # noqa: F405
    "DJANGO_ALLOWED_HOSTS",
    ["localhost", "127.0.0.1", "0.0.0.0", "backend"],
)

REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"] = [  # noqa: F405
    "rest_framework.permissions.AllowAny",
]
