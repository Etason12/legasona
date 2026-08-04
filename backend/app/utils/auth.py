from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from app.models import User


def _current_user():
    user_id = get_jwt_identity()
    if user_id is None:
        return None
    try:
        user = User.query.get(int(user_id))
    except (ValueError, TypeError):
        return None
    if user and user.status != 'active':
        return None
    return user


def effective_branch_id(user, requested_branch_id):
    """Non-admin users are always confined to their assigned branch.

    Admins may explicitly request any branch (or None for all branches).
    """
    if user.role == 'admin':
        return requested_branch_id
    return user.branch_id


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = _current_user()
        if not user:
            return jsonify({'message': 'Authentication required'}), 401
        if user.role != 'admin':
            return jsonify({'message': 'Admin access required'}), 403
        return fn(*args, **kwargs)
    return wrapper


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = _current_user()
            if not user:
                return jsonify({'message': 'Authentication required'}), 401
            if user.role not in roles:
                return jsonify({'message': f'Access restricted to: {", ".join(roles)}'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator
