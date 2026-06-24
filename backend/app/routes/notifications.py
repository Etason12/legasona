from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import OneSignalConfig, User, db
from app.utils.auth import admin_required

notifications_bp = Blueprint('notifications', __name__)

@notifications_bp.route('/onesignal-config', methods=['GET'])
@jwt_required()
def get_config():
    config = OneSignalConfig.query.first()
    if not config:
        return jsonify({'app_id': '', 'api_key': '', 'channel_id': ''}), 200
    return jsonify({
        'app_id': config.app_id,
        'api_key': config.api_key,
        'channel_id': config.channel_id or '',
    }), 200

@notifications_bp.route('/onesignal-config', methods=['PUT'])
@jwt_required()
@admin_required
def update_config():
    data = request.get_json()
    app_id = (data.get('app_id') or '').strip()
    api_key = (data.get('api_key') or '').strip()
    channel_id = (data.get('channel_id') or '').strip()
    if not app_id or not api_key:
        return jsonify({'message': 'App ID and API Key are required'}), 400
    config = OneSignalConfig.query.first()
    if config:
        config.app_id = app_id
        config.api_key = api_key
        config.channel_id = channel_id or None
    else:
        config = OneSignalConfig(app_id=app_id, api_key=api_key, channel_id=channel_id or None)
        db.session.add(config)
    db.session.commit()
    return jsonify({'message': 'OneSignal configuration saved'}), 200

@notifications_bp.route('/onesignal-config/test', methods=['POST'])
@jwt_required()
@admin_required
def test_notification():
    from app.utils.notifications import send_notification
    ok = send_notification('Test Notification', 'Your OneSignal setup is working!')
    if ok:
        return jsonify({'message': 'Test notification sent'}), 200
    return jsonify({'message': 'Failed to send. Check your config.'}), 400
