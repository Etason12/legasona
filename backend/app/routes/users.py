from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.models import User, db
from app.utils.auth import admin_required

users_bp = Blueprint('users', __name__)

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
    data     = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    role     = data.get('role', 'cashier')
    branch_id = data.get('branch_id') or None

    if not username or not password:
        return jsonify({'message': 'Username and password are required'}), 400
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
    user = User.query.get_or_404(id)
    data = request.get_json()
    user.role      = data.get('role', user.role)
    user.branch_id = data.get('branch_id') or None
    user.status    = data.get('status', user.status)
    if data.get('password'):
        user.set_password(data['password'])
    db.session.commit()
    return jsonify({'message': 'User updated'}), 200

@users_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_user(id):
    user = User.query.get_or_404(id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'User deleted'}), 200
