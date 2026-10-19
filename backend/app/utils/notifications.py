import requests
import json
import logging
import threading
from app.models import OneSignalConfig, db

logger = logging.getLogger(__name__)

ONESIGNAL_API = 'https://api.onesignal.com/notifications'


def _deliver(app_id, api_key, channel_id, title, message, data):
    """Perform the actual OneSignal HTTP call (safe to run on a worker thread)."""
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Key {api_key}',
    }

    payload = {
        'app_id': app_id,
        'included_segments': ['Total Subscriptions'],
        'headings': {'en': title},
        'contents': {'en': message},
        'android_channel_id': channel_id or None,
    }

    if data:
        payload['data'] = data

    try:
        resp = requests.post(ONESIGNAL_API, json=payload, headers=headers, timeout=10)
        resp.raise_for_status()
        logger.info(f'Push sent: {title} — {resp.json()}')
        return True
    except Exception as e:
        logger.error(f'OneSignal push failed: {e}')
        return False


def send_notification(title, message, data=None):
    """Send a push notification synchronously and report whether it worked.

    Used by the settings "test notification" endpoint where the caller wants
    the result. Write paths should use ``dispatch_notification`` instead so a
    slow/unreachable OneSignal never delays the HTTP response.
    """
    config = OneSignalConfig.query.first()
    if not config or not config.app_id or not config.api_key:
        logger.warning('OneSignal not configured — skipping push notification')
        return False
    return _deliver(config.app_id, config.api_key, config.channel_id, title, message, data)


def dispatch_notification(title, message, data=None):
    """Fire-and-forget push notification.

    The config is read while still inside the request/DB context, then the
    blocking network call runs on a short-lived daemon thread so the caller's
    response is never held up by OneSignal.
    """
    try:
        config = OneSignalConfig.query.first()
    except Exception as e:
        logger.error(f'OneSignal config lookup failed: {e}')
        return
    if not config or not config.app_id or not config.api_key:
        logger.warning('OneSignal not configured — skipping push notification')
        return
    app_id, api_key, channel_id = config.app_id, config.api_key, config.channel_id
    threading.Thread(
        target=_deliver,
        args=(app_id, api_key, channel_id, title, message, data),
        daemon=True,
    ).start()
