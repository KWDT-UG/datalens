from rest_framework.views import exception_handler as drf_exception_handler


def _flatten_error_details(detail, attr=None):
    errors = []
    if isinstance(detail, dict):
        for key, value in detail.items():
            errors.extend(_flatten_error_details(value, key))
        return errors

    if isinstance(detail, list):
        for value in detail:
            errors.extend(_flatten_error_details(value, attr))
        return errors

    normalized_attr = None if attr in {None, "non_field_errors", "detail"} else attr
    errors.append(
        {
            "attr": normalized_attr,
            "detail": str(detail),
            "code": getattr(detail, "code", "error"),
        }
    )
    return errors


def api_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    payload = response.data
    if isinstance(payload, dict):
        response.data = {
            "errors": _flatten_error_details(payload),
            **payload,
        }
        return response

    response.data = {
        "errors": _flatten_error_details(payload),
        "detail": str(payload),
    }
    return response
