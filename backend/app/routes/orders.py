from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Order, Customer, User, Branch, db
from app.utils.auth import role_required

orders_bp = Blueprint('orders', __name__)

def _ensure_customer(data, branch_id):
    customer_id = data.get('customer_id')
    name = (data.get('customer_name') or '').strip().title()
    phone = (data.get('customer_phone') or '').strip()
    if not customer_id and name and phone:
        existing = Customer.query.filter_by(phone=phone).first()
        if existing:
            customer_id = existing.id
        else:
            customer = Customer(full_name=name, phone=phone, branch_id=branch_id)
            db.session.add(customer)
            db.session.flush()
            customer_id = customer.id
    return customer_id

@orders_bp.route('', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'cashier')
def create_order():
    data = request.get_json()
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    # Determine branch_id
    # Admins can always select a branch. Restricted users are forced to their assigned branch.
    if current_user.role == 'admin':
        branch_id = data.get('branch_id')
    elif current_user.branch_id:
        branch_id = current_user.branch_id
    else:
        branch_id = data.get('branch_id')

    if not branch_id:
        return jsonify({'message': 'Branch ID is required'}), 400

    last_order = Order.query.order_by(Order.sequence_number.desc()).first()
    next_seq   = (last_order.sequence_number + 1) if last_order else 1

    customer_id = _ensure_customer(data, branch_id) or data.get('customer_id') or None

    deposit_method = data.get('deposit_method', 'cash')
    new_order = Order(
        customer_name=(data.get('customer_name') or '').strip().title(),
        customer_phone=data.get('customer_phone'),
        customer_id=customer_id,
        vehicle_specs=data.get('vehicle_specs'),
        sequence_number=next_seq,
        deposit_amount=data.get('deposit_amount', 0),
        deposit_method=deposit_method,
        branch_id=branch_id,
        remark=data.get('remark')
    )
    if deposit_method == 'bank':
        new_order.deposit_bank = data.get('deposit_bank', '').upper()
        new_order.deposit_account_holder = data.get('deposit_account_holder', '').upper()
        new_order.deposit_transaction_reference = data.get('deposit_transaction_reference', '').upper()
    db.session.add(new_order)
    db.session.commit()
    return jsonify({'message': 'Order created', 'sequence_number': next_seq}), 201

@orders_bp.route('', methods=['GET'])
@jwt_required()
def get_orders():
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    branch_id = request.args.get('branch_id')
    
    query = Order.query
    
    # If the user is not an admin, enforce filtering by their branch.
    # Admin can filter by branch_id if provided.
    if current_user.role != 'admin' and current_user.branch_id:
        query = query.filter(Order.branch_id == current_user.branch_id)
    elif branch_id:
        query = query.filter(Order.branch_id == branch_id)
    # If admin and no branch_id provided, show all orders.
        
    orders = query.order_by(Order.sequence_number).all()
    
    branch_ids = {o.branch_id for o in orders if o.branch_id}
    branches = {b.id: b.name for b in Branch.query.filter(Branch.id.in_(branch_ids)).all()}
    
    return jsonify([{
        'id': o.id, 'customer_name': o.customer_name,
        'customer_phone': o.customer_phone, 'customer_id': o.customer_id,
        'vehicle_specs': o.vehicle_specs, 'sequence_number': o.sequence_number,
        'deposit_amount': o.deposit_amount, 'status': o.status,
        'deposit_method': o.deposit_method,
        'deposit_bank': o.deposit_bank,
        'deposit_account_holder': o.deposit_account_holder,
        'deposit_transaction_reference': o.deposit_transaction_reference,
        'order_date': o.order_date.isoformat(),
        'remark': o.remark,
        'branch_id': o.branch_id,
        'branch_name': branches.get(o.branch_id)
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

@orders_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
@role_required('admin', 'manager', 'cashier')
def update_order(id):
    order = Order.query.get_or_404(id)
    data = request.get_json()
    current_user = User.query.get(get_jwt_identity())
    
    if 'customer_name' in data:
        order.customer_name = (data['customer_name'] or '').strip().title()
    if 'customer_phone' in data:
        order.customer_phone = data['customer_phone']
    if 'vehicle_specs' in data:
        order.vehicle_specs = data['vehicle_specs']
    if 'deposit_amount' in data:
        order.deposit_amount = data['deposit_amount']
    if 'deposit_method' in data:
        order.deposit_method = data['deposit_method']
    if 'remark' in data:
        order.remark = data['remark']
    # Admin can change the branch of an existing order
    if 'branch_id' in data and current_user.role == 'admin':
        order.branch_id = data['branch_id']
        
    if data.get('deposit_method') == 'bank':
        order.deposit_bank = data.get('deposit_bank', order.deposit_bank or '').upper()
        order.deposit_account_holder = data.get('deposit_account_holder', order.deposit_account_holder or '').upper()
        order.deposit_transaction_reference = data.get('deposit_transaction_reference', order.deposit_transaction_reference or '').upper()
    db.session.commit()
    return jsonify({'message': 'Order updated'}), 200

@orders_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@role_required('admin', 'manager')
def delete_order(id):
    order = Order.query.get_or_404(id)
    db.session.delete(order)
    db.session.commit()
    return jsonify({'message': 'Order deleted'}), 200
