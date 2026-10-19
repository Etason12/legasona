from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import User, Branch, db
from app.utils.auth import admin_required
from app.utils.validation import safe_int, truncate
from sqlalchemy.exc import IntegrityError

users_bp = Blueprint('users', __name__)

_VALID_ROLES = {'admin', 'manager', 'cashier', 'storekeeper', 'accountant'}

@users_bp.route('/me', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    if not username:
        return jsonify({'message': 'Username is required'}), 400
    if username != user.username and User.query.filter_by(username=username).first():
        return jsonify({'message': 'Username already exists'}), 409

    # Changing the password requires proving knowledge of the current one.
    new_password = data.get('password')
    if new_password:
        current_password = str(data.get('current_password') or '')
        if not user.password_hash or not user.check_password(current_password):
            return jsonify({'message': 'Current password is incorrect'}), 403
        if len(str(new_password)) < 8:
            return jsonify({'message': 'New password must be at least 8 characters'}), 400
        user.set_password(str(new_password))

    user.username = truncate(username, 64)
    db.session.commit()
    return jsonify({'message': 'Profile updated', 'username': user.username}), 200

@users_bp.route('', methods=['GET'])
@jwt_required()
@admin_required
def get_users():
    users = User.query.all()
    return jsonify([{
        'id': u.id, 'username': u.username, 'role': u.role,
        'branch_id': u.branch_id,
        'branch_name': u.branch.name if u.branch else 'All Branches',
        'status': u.status
    } for u in users]), 200

@users_bp.route('', methods=['POST'])
@jwt_required()
@admin_required
def create_user():
    data     = request.get_json() or {}
    username = truncate(data.get('username'), 64)
    password = str(data.get('password') or '')
    role     = data.get('role', 'cashier')
    branch_id = safe_int(data.get('branch_id'))

    if not username or not password:
        return jsonify({'message': 'Username and password are required'}), 400
    if role not in _VALID_ROLES:
        return jsonify({'message': 'Invalid role'}), 400
    if len(password) < 8:
        return jsonify({'message': 'Password must be at least 8 characters'}), 400
    if branch_id and not db.session.get(Branch, branch_id):
        return jsonify({'message': 'Branch not found'}), 404
    if User.query.filter_by(username=username).first():
        return jsonify({'message': 'Username already exists'}), 409

    user = User(username=username, role=role, branch_id=branch_id, status='active')
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({'message': 'User created', 'id': user.id}), 201


@users_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
@admin_required
def update_user(id):
    user = db.get_or_404(User, id)
    data = request.get_json() or {}
    new_role = data.get('role', user.role)
    new_status = data.get('status', user.status)
    if new_role not in _VALID_ROLES:
        return jsonify({'message': 'Invalid role'}), 400

    # Never allow the only remaining admin to be demoted or deactivated.
    if user.role == 'admin' and (new_role != 'admin' or new_status != 'active'):
        if User.query.filter_by(role='admin').count() <= 1:
            return jsonify({'message': 'Cannot change the last admin account'}), 400

    branch_id = safe_int(data.get('branch_id'))
    if branch_id and not db.session.get(Branch, branch_id):
        return jsonify({'message': 'Branch not found'}), 404

    if data.get('password'):
        if len(str(data['password'])) < 8:
            return jsonify({'message': 'Password must be at least 8 characters'}), 400
        user.set_password(str(data['password']))
    user.role      = new_role
    user.branch_id = branch_id
    user.status    = new_status
    db.session.commit()
    return jsonify({'message': 'User updated'}), 200


@users_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_user(id):
    user = db.get_or_404(User, id)
    if str(user.id) == str(get_jwt_identity()):
        return jsonify({'message': 'You cannot delete your own account'}), 400
    if user.role == 'admin' and User.query.filter_by(role='admin').count() <= 1:
        return jsonify({'message': 'Cannot delete the last admin account'}), 400
    try:
        db.session.delete(user)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'message': 'Cannot delete this user because other records reference them; deactivate the account instead'}), 400
    return jsonify({'message': 'User deleted'}), 200
