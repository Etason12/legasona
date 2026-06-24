import requests
import json
import logging
from app.models import OneSignalConfig, db

logger = logging.getLogger(__name__)

ONESIGNAL_API = 'https://api.onesignal.com/notifications'

def send_notification(title, message, data=None):
    config = OneSignalConfig.query.first()
    if not config or not config.app_id or not config.api_key:
        logger.warning('OneSignal not configured — skipping push notification')
        return False

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Key {config.api_key}',
    }

    payload = {
        'app_id': config.app_id,
        'included_segments': ['Total Subscriptions'],
        'headings': {'en': title},
        'contents': {'en': message},
        'android_channel_id': config.channel_id or None,
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
