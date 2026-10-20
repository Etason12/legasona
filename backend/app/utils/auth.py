from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from app import db
from app.models import User


def _current_user():
    user_id = get_jwt_identity()
    if user_id is None:
        return None
    try:
        user = db.session.get(User, int(user_id))
    except (ValueError, TypeError):
        return None
    if user and user.status != 'active':
        return None
    return user


def _coerce_id(value):
    """Return ``value`` as an int, or None when it is missing/unparseable.

    Branch and user ids arrive from ``request.args`` as strings while the
    matching columns are Integer. Comparing an Integer column to a string
    renders ``branch_id = '2'``, which Postgres rejects with
    ``operator does not exist: integer = character varying`` (SQLite silently
    coerces, which is why this only surfaced in production). Coercing once
    here keeps every caller safe.
    """
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


# Roles that may view and modify records in any branch. Managers get full
# cross-branch access (list, view and record against any branch); cashiers,
# storekeepers and accountants stay confined to their assigned branch.
UNRESTRICTED_ROLES = frozenset({'admin', 'manager'})


def is_unrestricted(user):
    """Whether ``user`` may act across every branch."""
    return user is not None and user.role in UNRESTRICTED_ROLES


def effective_branch_id(user, requested_branch_id):
    """Resolve the branch scope for a request.

    Admins and managers may explicitly request any branch (or None for all
    branches). Everyone else is confined to their assigned branch. The result
    is always an ``int`` (or ``None``) so it can be compared against Integer
    columns on Postgres.
    """
    if is_unrestricted(user):
        return _coerce_id(requested_branch_id)
    return user.branch_id


def user_can_access_branch(user, branch_id):
    """Whether ``user`` may read/write a record that belongs to ``branch_id``.

    Admins and managers can touch any branch. Everyone else is confined to the
    branch they are assigned to; a non-admin with no branch assignment gets
    nothing.
    """
    if user is None:
        return False
    if is_unrestricted(user):
        return True
    if user.branch_id is None:
        return False
    return _coerce_id(branch_id) == user.branch_id


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
