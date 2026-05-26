from flask import Blueprint, request, jsonify
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
