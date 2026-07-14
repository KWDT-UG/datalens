from .base import *  # noqa: F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "test.sqlite3",  # noqa: F405
    }
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_RATES": {
        **REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],  # noqa: F405
        "auth": "1000/minute",
    },
}

# Tests must never inherit a developer's Mailtrap credentials from `.env`.
MAILTRAP_API_KEY = ""
MAILTRAP_USE_SANDBOX = True
MAILTRAP_INBOX_ID = ""
