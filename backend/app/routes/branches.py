from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Branch, User, db
from app.utils.auth import admin_required, role_required, user_can_access_branch
from app.utils.validation import safe_int, safe_float, truncate
from app.utils.cache import cached, invalidate_cache
from sqlalchemy.exc import IntegrityError

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
    data = request.get_json() or {}
    name = truncate(data.get('name'), 100)
    if not name:
        return jsonify({'message': 'Branch name is required'}), 400
    new_branch = Branch(
        name=name, location=truncate(data.get('location'), 200),
        address=truncate(data.get('address'), 200), phone=truncate(data.get('phone'), 20),
        status='active'
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
    data = request.get_json() or {}
    b.name     = truncate(data.get('name'), 100, b.name)
    b.location = truncate(data.get('location'), 200, b.location)
    b.address  = truncate(data.get('address'), 200, b.address)
    b.phone    = truncate(data.get('phone'), 20, b.phone)
    b.status   = truncate(data.get('status'), 20, b.status)
    db.session.commit()
    invalidate_cache('get_branches')
    return jsonify({'message': 'Branch updated'}), 200


@branches_bp.route('/<int:id>/budget', methods=['PATCH'])
@jwt_required()
@role_required('admin', 'manager')
def update_branch_budget(id):
    b = db.get_or_404(Branch, id)
    current_user = db.session.get(User, get_jwt_identity())
    if not user_can_access_branch(current_user, b.id):
        return jsonify({'message': 'Branch not found'}), 404
    data = request.get_json() or {}
    new_budget = safe_float(data.get('monthly_budget'), default=b.monthly_budget, min_val=0)
    b.monthly_budget = new_budget
    db.session.commit()
    invalidate_cache('get_branches')
    return jsonify({'message': 'Budget updated', 'monthly_budget': b.monthly_budget}), 200


@branches_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_branch(id):
    b = db.get_or_404(Branch, id)
    if User.query.filter_by(branch_id=id).first():
        return jsonify({'message': 'Cannot delete a branch that still has users assigned; reassign them first'}), 400
    try:
        db.session.delete(b)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'message': 'Cannot delete this branch because other records still reference it'}), 400
    invalidate_cache('get_branches')
    return jsonify({'message': 'Branch deleted'}), 200
