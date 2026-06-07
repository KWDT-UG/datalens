from django.conf import settings
from rest_framework.authentication import CSRFCheck, TokenAuthentication
from rest_framework.exceptions import PermissionDenied


def enforce_csrf(request):
    check = CSRFCheck(lambda _request: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise PermissionDenied(f"CSRF Failed: {reason}")


class CookieTokenAuthentication(TokenAuthentication):
    """Authenticate browser requests with an HttpOnly token cookie."""

    def authenticate(self, request):
        token = request.COOKIES.get(settings.DATALENS_AUTH_COOKIE_NAME)
        if token:
            enforce_csrf(request)
            return self.authenticate_credentials(token)
        return super().authenticate(request)
