"""Email delivery helpers with Mailtrap API support."""

from email.utils import parseaddr
from importlib import import_module
import logging

from django.conf import settings
from django.core.mail import send_mail


logger = logging.getLogger(__name__)


class EmailDeliveryError(Exception):
    """Raised when a configured provider cannot accept an email."""


def send_transactional_email(*, subject, message, recipient_list, html_message=None):
    """Send through Mailtrap when configured, otherwise use Django's backend."""
    if not settings.MAILTRAP_API_KEY:
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipient_list,
                html_message=html_message,
            )
        except Exception as error:
            logger.warning(
                "Configured Django email backend rejected a transactional email (%s): %s",
                type(error).__name__,
                error,
            )
            raise EmailDeliveryError(
                "The configured email backend rejected the email."
            ) from error
        return

    if settings.MAILTRAP_USE_SANDBOX and not settings.MAILTRAP_INBOX_ID:
        raise EmailDeliveryError(
            "MAILTRAP_INBOX_ID is required when MAILTRAP_USE_SANDBOX is enabled."
        )

    sender_name, sender_email = parseaddr(settings.DEFAULT_FROM_EMAIL)
    if not sender_email:
        raise EmailDeliveryError(
            "DJANGO_DEFAULT_FROM_EMAIL must contain a valid sender email address."
        )

    try:
        mailtrap = import_module("mailtrap")
        client = mailtrap.MailtrapClient(
            token=settings.MAILTRAP_API_KEY,
            sandbox=settings.MAILTRAP_USE_SANDBOX,
            inbox_id=(
                settings.MAILTRAP_INBOX_ID if settings.MAILTRAP_USE_SANDBOX else None
            ),
        )
        mail_kwargs = {
            "sender": mailtrap.Address(email=sender_email, name=sender_name),
            "to": [mailtrap.Address(email=recipient) for recipient in recipient_list],
            "subject": subject,
            "text": message,
        }
        if html_message:
            mail_kwargs["html"] = html_message
        email = mailtrap.Mail(**mail_kwargs)
        result = client.send(email)
    except Exception as error:
        logger.warning(
            "Mailtrap rejected a transactional email (%s): %s",
            type(error).__name__,
            error,
        )
        raise EmailDeliveryError("Mailtrap could not accept the email.") from error

    if isinstance(result, dict) and not result.get("success", False):
        logger.warning("Mailtrap returned an unsuccessful transactional-email response.")
        raise EmailDeliveryError("Mailtrap could not accept the email.")
