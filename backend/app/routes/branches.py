from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.models import Branch, db
from app.utils.auth import admin_required, role_required

branches_bp = Blueprint('branches', __name__)

@branches_bp.route('', methods=['GET'])
@jwt_required()
def get_branches():
    branches = Branch.query.all()
    return jsonify([{
        'id': b.id, 'name': b.name, 'location': b.location,
        'address': b.address, 'phone': b.phone, 'status': b.status,
        'monthly_budget': b.monthly_budget
    } for b in branches]), 200

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
    return jsonify({'message': 'Branch added', 'id': new_branch.id}), 201

@branches_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
@admin_required
def update_branch(id):
    b    = Branch.query.get_or_404(id)
    data = request.get_json()
    b.name     = data.get('name', b.name)
    b.location = data.get('location', b.location)
    b.address  = data.get('address', b.address)
    b.phone    = data.get('phone', b.phone)
    b.status   = data.get('status', b.status)
    db.session.commit()
    return jsonify({'message': 'Branch updated'}), 200

@branches_bp.route('/<int:id>/budget', methods=['PATCH'])
@jwt_required()
@role_required('admin', 'manager')
def update_branch_budget(id):
    b = Branch.query.get_or_404(id)
    data = request.get_json()
    b.monthly_budget = data.get('monthly_budget', b.monthly_budget)
    db.session.commit()
    return jsonify({'message': 'Budget updated', 'monthly_budget': b.monthly_budget}), 200

@branches_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_branch(id):
    b = Branch.query.get_or_404(id)
    db.session.delete(b)
    db.session.commit()
    return jsonify({'message': 'Branch deleted'}), 200
