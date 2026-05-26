from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.models import Customer, Sale, Order, db
from app.utils.auth import admin_required, role_required
from sqlalchemy import or_

customers_bp = Blueprint('customers', __name__)

@customers_bp.route('', methods=['GET'])
@jwt_required()
def get_customers():
    search = request.args.get('search', '')
    query  = Customer.query
    if search:
        query = query.filter(or_(
            Customer.full_name.ilike(f"%{search}%"),
            Customer.phone.ilike(f"%{search}%")
        ))
    customers = query.order_by(Customer.full_name.asc()).all()
    return jsonify([{
        'id': c.id, 'full_name': c.full_name, 'phone': c.phone,
        'email': c.email, 'address': c.address, 'type': c.customer_type,
        'credit_limit': c.credit_limit, 'points': c.loyalty_points
    } for c in customers]), 200

@customers_bp.route('', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'cashier')
def add_customer():
    data = request.get_json()
    if Customer.query.filter_by(phone=data.get('phone')).first():
        return jsonify({'message': 'Customer with this phone already exists'}), 409
    c = Customer(
        full_name=data.get('full_name'), phone=data.get('phone'),
        email=data.get('email'), address=data.get('address'),
        customer_type=data.get('type', 'individual'),
        credit_limit=float(data.get('credit_limit', 0)),
        branch_id=data.get('branch_id')
    )
    db.session.add(c)
    db.session.commit()
    return jsonify({'message': 'Customer created', 'id': c.id}), 201

@customers_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
def get_customer_details(id):
    c      = Customer.query.get_or_404(id)
    sales  = Sale.query.filter_by(customer_id=id).all()
    orders = Order.query.filter_by(customer_id=id).all()
    return jsonify({
        'id': c.id, 'full_name': c.full_name, 'phone': c.phone,
        'email': c.email, 'address': c.address, 'type': c.customer_type,
        'credit_limit': c.credit_limit, 'points': c.loyalty_points,
        'history': {
            'sales':  [{'id': s.id, 'number': s.sale_number, 'amount': s.total_amount,
                        'date': s.sale_date.isoformat(), 'status': s.status} for s in sales],
            'orders': [{'id': o.id, 'specs': o.vehicle_specs,
                        'date': o.order_date.isoformat(), 'status': o.status} for o in orders]
        }
    }), 200

@customers_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
@role_required('admin', 'manager', 'cashier')
def update_customer(id):
    c    = Customer.query.get_or_404(id)
    data = request.get_json()
    c.full_name     = data.get('full_name', c.full_name)
    c.email         = data.get('email', c.email)
    c.address       = data.get('address', c.address)
    c.customer_type = data.get('type', c.customer_type)
    c.credit_limit  = float(data.get('credit_limit', c.credit_limit))
    db.session.commit()
    return jsonify({'message': 'Customer updated'}), 200

@customers_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_customer(id):
    c = Customer.query.get_or_404(id)
    db.session.delete(c)
    db.session.commit()
    return jsonify({'message': 'Customer deleted'}), 200
