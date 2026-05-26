from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.models import Order, db
from app.utils.auth import role_required

orders_bp = Blueprint('orders', __name__)

@orders_bp.route('', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'cashier')
def create_order():
    data = request.get_json()
    last_order = Order.query.order_by(Order.sequence_number.desc()).first()
    next_seq   = (last_order.sequence_number + 1) if last_order else 1

    new_order = Order(
        customer_name=data.get('customer_name'),
        customer_phone=data.get('customer_phone'),
        customer_id=data.get('customer_id'),
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
        'order_date': o.order_date.isoformat()
    } for o in orders]), 200

@orders_bp.route('/<int:id>/fulfill', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager')
def fulfill_order(id):
    order = Order.query.get_or_404(id)
    order.status = 'fulfilled'
    db.session.commit()
    return jsonify({'message': 'Order marked as fulfilled'}), 200
