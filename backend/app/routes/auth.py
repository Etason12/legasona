import hmac
import logging
import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.models import User, Branch
from app import db
from app.utils.rate_limit import is_rate_limited, record_attempt, get_client_ip
from app.utils.sanitization import sanitize_string

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

_DEFAULT_SECRET = 'dev-secret-key'
_DEFAULT_RESET_KEY = 'dev-reset-key'

def _valid_reset_key(reset_key):
    secret = os.environ.get('ADMIN_RESET_KEY', _DEFAULT_RESET_KEY)
    if secret == _DEFAULT_RESET_KEY:
        return False
    return hmac.compare_digest(reset_key, secret)

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        try:
            client_ip = get_client_ip()
        except Exception:
            client_ip = 'unknown'

        if is_rate_limited(f'login:{client_ip}', 5, 60):
            return jsonify({'message': 'Too many login attempts. Please try again later.'}), 429

        user = User.query.filter_by(username=username).first()
        if user and user.status != 'active':
            record_attempt(f'login:{client_ip}')
            return jsonify({'message': 'Invalid credentials'}), 401
        if user:
            if not user.password_hash:
                logger.error(f"User '{username}' has no password_hash — re-seeding password")
                user.set_password(os.environ.get('ADMIN_DEFAULT_PASSWORD', 'admin123'))
                db.session.commit()
            if user.check_password(password):
                access_token = create_access_token(identity=str(user.id))
                branch_name = user.branch.name if user.branch else "All"
                return jsonify({
                    'token': access_token,
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'role': user.role,
                        'branch_id': user.branch_id,
                        'branch_name': branch_name
                    }
                }), 200
        record_attempt(f'login:{client_ip}')
        return jsonify({'message': 'Invalid credentials'}), 401
    except Exception as e:
        logger.error(f'Login failed: {e}', exc_info=True)
        return jsonify({'message': f'Login error: {str(e)}'}), 500

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    """Lightweight token-validation endpoint called on app load."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
    branch_name = user.branch.name if user.branch else "All"
    return jsonify({
        'id': user.id,
        'username': user.username,
        'role': user.role,
        'branch_id': user.branch_id,
        'branch_name': branch_name
    }), 200

@auth_bp.route('/user', methods=['GET'])
@jwt_required()
def get_user():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if user:
        return jsonify({
            'id': user.id,
            'username': user.username,
            'role': user.role,
            'branch_id': user.branch_id
        }), 200
    return jsonify({'message': 'User not found'}), 404

@auth_bp.route('/reset-admin', methods=['POST'])
def reset_admin():
    client_ip = get_client_ip()
    if is_rate_limited(f'reset-admin:{client_ip}', 3, 300):
        return jsonify({'message': 'Too many attempts. Please try again in 5 minutes.'}), 429

    data = request.get_json() or {}
    if not _valid_reset_key(data.get('reset_key', '')):
        record_attempt(f'reset-admin:{client_ip}')
        return jsonify({'message': 'Invalid reset key'}), 401
    if data.get('list_users'):
        users = User.query.with_entities(User.id, User.username, User.role).all()
        return jsonify({'users': [{'id': u.id, 'username': u.username, 'role': u.role} for u in users]}), 200
    admin = User.query.filter_by(role='admin').first()
    if not admin:
        return jsonify({'message': 'No admin user found'}), 404
    new_password = sanitize_string((data.get('new_password') or '').strip(), max_length=128)
    if len(new_password) < 8:
        return jsonify({'message': 'new_password must be at least 8 characters'}), 400
    admin.set_password(new_password)
    db.session.commit()
    return jsonify({'message': f"Password reset for admin user '{admin.username}' (id={admin.id})"}), 200

@auth_bp.route('/create-admin', methods=['POST'])
def create_admin():
    client_ip = get_client_ip()
    if is_rate_limited(f'create-admin:{client_ip}', 3, 300):
        return jsonify({'message': 'Too many attempts. Please try again in 5 minutes.'}), 429

    data = request.get_json() or {}
    if not _valid_reset_key(data.get('reset_key', '')):
        record_attempt(f'create-admin:{client_ip}')
        return jsonify({'message': 'Invalid reset key'}), 401
    username = sanitize_string(data.get('username', '').strip(), max_length=50)
    password = data.get('password', '')
    if not username or not password:
        return jsonify({'message': 'username and password required'}), 400
    if len(password) < 8:
        return jsonify({'message': 'password must be at least 8 characters'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'message': 'Username already exists'}), 409
    user = User(username=username, role='admin')
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({'message': f"Admin user '{username}' created"}), 201

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)

    client_ip = get_client_ip()
    if is_rate_limited(f'change-pw:{user_id}:{client_ip}', 5, 60):
        return jsonify({'message': 'Too many attempts. Please try again later.'}), 429

    data = request.get_json()
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')

    if not current_password or not new_password:
        return jsonify({'message': 'Current password and new password are required'}), 400

    if not user.check_password(current_password):
        record_attempt(f'change-pw:{user_id}:{client_ip}')
        return jsonify({'message': 'Current password is incorrect'}), 401

    if len(new_password) < 8:
        return jsonify({'message': 'New password must be at least 8 characters'}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({'message': 'Password changed successfully'}), 200
