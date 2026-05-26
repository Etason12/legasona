from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from app.models import SparePart
from app import db

parts_bp = Blueprint('parts', __name__)

@parts_bp.route('/parts', methods=['GET'])
@jwt_required()
def get_parts():
    """Return a JSON list of all spare parts."""
    parts = SparePart.query.all()
    result = []
    for part in parts:
        result.append({
            'id': part.id,
            'part_number': part.part_number,
            'name': part.name,
            'quantity': part.quantity,
            'branch_id': part.branch_id,
            'unit_price': part.unit_price,
        })
    return jsonify(parts=result), 200
