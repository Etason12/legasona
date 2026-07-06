from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.models import User, Branch
from app import db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
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

    return jsonify({'message': 'Invalid credentials'}), 401

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
    data = request.get_json() or {}
    reset_key = data.get('reset_key', '')
    if reset_key != current_app.config['SECRET_KEY']:
        return jsonify({'message': 'Invalid reset key'}), 401
    if data.get('list_users'):
        users = User.query.with_entities(User.id, User.username, User.role).all()
        return jsonify({'users': [{'id': u.id, 'username': u.username, 'role': u.role} for u in users]}), 200
    admin = User.query.filter_by(role='admin').first()
    if not admin:
        return jsonify({'message': 'No admin user found'}), 404
    admin.set_password('admin123')
    db.session.commit()
    return jsonify({'message': f"Password reset for admin user '{admin.username}' (id={admin.id}) to admin123"}), 200

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')

    if not current_password or not new_password:
        return jsonify({'message': 'Current password and new password are required'}), 400

    if not user.check_password(current_password):
        return jsonify({'message': 'Current password is incorrect'}), 401

    if len(new_password) < 4:
        return jsonify({'message': 'New password must be at least 4 characters'}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({'message': 'Password changed successfully'}), 200
