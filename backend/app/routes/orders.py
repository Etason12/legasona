from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.models import Order, Customer, db
from app.utils.auth import role_required

orders_bp = Blueprint('orders', __name__)

def _ensure_customer(data):
    customer_id = data.get('customer_id')
    name = (data.get('customer_name') or '').strip().title()
    phone = (data.get('customer_phone') or '').strip()
    if not customer_id and name and phone:
        existing = Customer.query.filter_by(phone=phone).first()
        if existing:
            customer_id = existing.id
        else:
            customer = Customer(full_name=name, phone=phone, branch_id=data.get('branch_id'))
            db.session.add(customer)
            db.session.flush()
            customer_id = customer.id
    return customer_id

@orders_bp.route('', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'cashier')
def create_order():
    data = request.get_json()
    last_order = Order.query.order_by(Order.sequence_number.desc()).first()
    next_seq   = (last_order.sequence_number + 1) if last_order else 1

    customer_id = _ensure_customer(data) or data.get('customer_id') or None

    new_order = Order(
        customer_name=(data.get('customer_name') or '').strip().title(),
        customer_phone=data.get('customer_phone'),
        customer_id=customer_id,
        vehicle_specs=data.get('vehicle_specs'),
        sequence_number=next_seq,
        deposit_amount=data.get('deposit_amount', 0),
        branch_id=data.get('branch_id')
    )
    db.session.add(new_order)
    db.session.commit()
    return jsonify({'message': 'Order created', 'sequence_number': next_seq}), 201

@orders_bp.route('', methods=['GET'])
@jwt_required()
def get_orders():
    orders = Order.query.order_by(Order.sequence_number).all()
    return jsonify([{
        'id': o.id, 'customer_name': o.customer_name,
        'customer_phone': o.customer_phone, 'customer_id': o.customer_id,
        'vehicle_specs': o.vehicle_specs, 'sequence_number': o.sequence_number,
        'deposit_amount': o.deposit_amount, 'status': o.status,
        'deposit_method': o.deposit_method,
        'deposit_bank': o.deposit_bank,
        'deposit_account_holder': o.deposit_account_holder,
        'deposit_transaction_reference': o.deposit_transaction_reference,
        'order_date': o.order_date.isoformat()
    } for o in orders]), 200

@orders_bp.route('/<int:id>/deposit', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'cashier')
def add_deposit(id):
    order = Order.query.get_or_404(id)
    data = request.get_json()
    amount = float(data.get('amount', 0))
    if amount <= 0:
        return jsonify({'message': 'Deposit amount must be greater than zero'}), 400
    order.deposit_amount = (order.deposit_amount or 0) + amount
    method = data.get('method', 'cash')
    order.deposit_method = method
    if method == 'bank':
        order.deposit_bank = data.get('bank', '').upper()
        order.deposit_account_holder = data.get('account_holder', '').upper()
        order.deposit_transaction_reference = data.get('reference', '').upper()
    db.session.commit()
    return jsonify({'message': 'Deposit added', 'deposit_amount': order.deposit_amount}), 200

@orders_bp.route('/<int:id>/fulfill', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager')
def fulfill_order(id):
    order = Order.query.get_or_404(id)
    order.status = 'fulfilled'
    db.session.commit()
    return jsonify({'message': 'Order marked as fulfilled'}), 200
