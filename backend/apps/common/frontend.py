from urllib.parse import urlsplit

from django.conf import settings


def is_local_frontend_url(url):
    hostname = urlsplit(url).hostname
    return hostname in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}


def frontend_app_url_for_request(request):
    configured_url = settings.FRONTEND_APP_URL.rstrip("/")
    if configured_url and not is_local_frontend_url(configured_url):
        return configured_url

    origin = request.headers.get("Origin")
    if origin and not is_local_frontend_url(origin):
        parsed_origin = urlsplit(origin)
        if parsed_origin.scheme in {"http", "https"} and parsed_origin.netloc:
            return f"{parsed_origin.scheme}://{parsed_origin.netloc}"

    return configured_url
