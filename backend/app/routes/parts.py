from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import SparePart, User
from app import db
from app.utils.auth import effective_branch_id
from app.utils.validation import safe_int

parts_bp = Blueprint('parts', __name__)

@parts_bp.route('/parts', methods=['GET'])
@jwt_required()
def get_parts():
    """Return the spare parts visible to the current user.

    Deliberately not cached: the result depends on the caller's branch, and a
    global cache key would leak one branch's inventory to another.
    """
    current_user = db.session.get(User, get_jwt_identity())
    branch_id = effective_branch_id(current_user, request.args.get('branch_id'))
    query = SparePart.query
    if branch_id:
        query = query.filter(SparePart.branch_id == safe_int(branch_id))
    result = []
    for part in query.all():
        result.append({
            'id': part.id,
            'part_number': part.part_number,
            'name': part.name,
            'quantity': part.quantity,
            'branch_id': part.branch_id,
            'unit_price': part.unit_price,
        })
    return jsonify(parts=result), 200
