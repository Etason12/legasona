from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.models import Branch, db
from app.utils.auth import admin_required, role_required
from app.utils.validation import safe_int
from app.utils.cache import cached, invalidate_cache

branches_bp = Blueprint('branches', __name__)

@branches_bp.route('', methods=['GET'])
@jwt_required()
def get_branches():
    page = safe_int(request.args.get('page', 1), default=1, min_val=1)
    per_page = safe_int(request.args.get('per_page', 100), default=100, min_val=1, max_val=200)

    query = Branch.query.order_by(Branch.name.asc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'items': [{
            'id': b.id, 'name': b.name, 'location': b.location,
            'address': b.address, 'phone': b.phone, 'status': b.status,
            'monthly_budget': b.monthly_budget
        } for b in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages,
        'current_page': page
    }), 200

@branches_bp.route('', methods=['POST'])
@jwt_required()
@admin_required
def add_branch():
    data = request.get_json()
    new_branch = Branch(
        name=data.get('name'), location=data.get('location'),
        address=data.get('address'), phone=data.get('phone'), status='active'
    )
    db.session.add(new_branch)
    db.session.commit()
    invalidate_cache('get_branches')
    return jsonify({'message': 'Branch added', 'id': new_branch.id}), 201

@branches_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
@admin_required
def update_branch(id):
    b    = db.get_or_404(Branch, id)
    data = request.get_json()
    b.name     = data.get('name', b.name)
    b.location = data.get('location', b.location)
    b.address  = data.get('address', b.address)
    b.phone    = data.get('phone', b.phone)
    b.status   = data.get('status', b.status)
    db.session.commit()
    invalidate_cache('get_branches')
    return jsonify({'message': 'Branch updated'}), 200

@branches_bp.route('/<int:id>/budget', methods=['PATCH'])
@jwt_required()
@role_required('admin', 'manager')
def update_branch_budget(id):
    b = db.get_or_404(Branch, id)
    data = request.get_json()
    b.monthly_budget = data.get('monthly_budget', b.monthly_budget)
    db.session.commit()
    invalidate_cache('get_branches')
    return jsonify({'message': 'Budget updated', 'monthly_budget': b.monthly_budget}), 200

@branches_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_branch(id):
    b = db.get_or_404(Branch, id)
    db.session.delete(b)
    db.session.commit()
    invalidate_cache('get_branches')
    return jsonify({'message': 'Branch deleted'}), 200
