import logging
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.exceptions import HTTPException
from app.models import Order, Customer, User, Branch, Sale, Payment, Vehicle, db
from app.utils.auth import role_required
from app.utils.logging import log_activity
from app.utils.notifications import send_notification
from app.utils.validation import safe_int
from app.utils.image_utils import compress_to_base64

orders_bp = Blueprint('orders', __name__)
logger = logging.getLogger(__name__)

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
    current_user = db.session.get(User, current_user_id)
    
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

    from sqlalchemy import func, text
    last_order = db.session.query(func.coalesce(func.max(Order.sequence_number), 0)).scalar()
    next_seq = last_order + 1

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
    db.session.flush()
    user_id = get_jwt_identity()
    log_activity(user_id, 'CREATE_ORDER', f"Order #{next_seq} created for {data.get('customer_name')}")
    db.session.commit()
    send_notification(
        'New Order Created',
        f'Order #{next_seq} for {data.get("customer_name")} — deposit ETB {data.get("deposit_amount", 0):,.0f}',
        {'type': 'order', 'sequence_number': next_seq}
    )
    return jsonify({'message': 'Order created', 'sequence_number': next_seq}), 201

@orders_bp.route('', methods=['GET'])
@jwt_required()
def get_orders():
    current_user_id = get_jwt_identity()
    current_user = db.session.get(User, current_user_id)
    branch_id = request.args.get('branch_id')
    
    page = safe_int(request.args.get('page', 1), default=1, min_val=1)
    per_page = safe_int(request.args.get('per_page', 20), default=20, min_val=1, max_val=10000)
    
    query = Order.query
    
    if current_user.role != 'admin' and current_user.branch_id:
        query = query.filter(Order.branch_id == current_user.branch_id)
    elif branch_id:
        query = query.filter(Order.branch_id == branch_id)
        
    paginated_orders = query.order_by(Order.sequence_number).paginate(page=page, per_page=per_page, error_out=False)
    orders = paginated_orders.items
    total = paginated_orders.total
    pages = paginated_orders.pages
    
    branch_ids = {o.branch_id for o in orders if o.branch_id}
    branches = {b.id: b.name for b in Branch.query.filter(Branch.id.in_(branch_ids)).all()}

    from sqlalchemy import func
    base = query
    agg = base.with_entities(
        func.count(Order.id).filter(Order.status == 'waiting').label('waiting_count'),
        func.count(Order.id).filter(Order.status == 'fulfilled').label('fulfilled_count'),
        func.count(Order.id).filter(Order.status == 'cancelled').label('cancelled_count'),
        func.coalesce(func.sum(Order.deposit_amount).filter(Order.status == 'waiting'), 0).label('waiting_deposits_sum'),
        func.coalesce(func.sum(Order.refund_amount).filter(Order.status == 'cancelled'), 0).label('refunds_sum')
    ).first()

    return jsonify({
        'items': [{
            'id': o.id, 'customer_name': o.customer_name,
            'customer_phone': o.customer_phone, 'customer_id': o.customer_id,
            'vehicle_specs': o.vehicle_specs, 'sequence_number': o.sequence_number,
            'deposit_amount': o.deposit_amount, 'status': o.status,
            'deposit_method': o.deposit_method,
            'deposit_bank': o.deposit_bank,
            'deposit_account_holder': o.deposit_account_holder,
            'deposit_transaction_reference': o.deposit_transaction_reference,
            'deposit_receipt_image': o.deposit_receipt_image,
            'order_date': o.order_date.isoformat(),
            'remark': o.remark,
            'branch_id': o.branch_id,
            'branch_name': branches.get(o.branch_id),
            'sale_id': o.sale_id,
            'cancelled_at': o.cancelled_at.isoformat() if o.cancelled_at else None,
            'cancellation_reason': o.cancellation_reason,
            'refund_amount': o.refund_amount,
            'refund_method': o.refund_method,
            'refund_bank': o.refund_bank,
            'refund_transaction_reference': o.refund_transaction_reference,
            'refund_date': o.refund_date.isoformat() if o.refund_date else None,
        } for o in orders],
        'total': total,
        'pages': pages,
        'current_page': page,
        'all_waiting_count': agg.waiting_count if agg else 0,
        'all_fulfilled_count': agg.fulfilled_count if agg else 0,
        'all_cancelled_count': agg.cancelled_count if agg else 0,
        'all_deposits_sum': agg.waiting_deposits_sum if agg else 0,
        'all_refunds_sum': agg.refunds_sum if agg else 0
    }), 200


@orders_bp.route('/available-vehicles', methods=['GET'])
@jwt_required()
def get_available_vehicles():
    branch_id = request.args.get('branch_id')
    query = Vehicle.query.filter(Vehicle.status == 'available')
    if branch_id:
        query = query.filter(Vehicle.branch_id == int(branch_id))
    vehicles = query.order_by(Vehicle.model).all()
    return jsonify([{
        'id': v.id, 'vin': v.vin, 'model': v.model, 'color': v.color,
        'type': v.type, 'power_type': v.power_type,
        'chassis_number': v.chassis_number, 'engine_number': v.engine_number,
        'selling_price': float(v.selling_price or 0),
        'branch_id': v.branch_id, 'image': v.image
    } for v in vehicles]), 200


@orders_bp.route('/<int:id>/deposit', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'cashier')
def add_deposit(id):
    order = db.get_or_404(Order, id)
    if request.content_type and 'multipart' in request.content_type:
        amount = float(request.form.get('amount', 0))
        method = request.form.get('method', 'cash')
        bank = request.form.get('bank', '')
        account_holder = request.form.get('account_holder', '')
        reference = request.form.get('reference', '')
        receipt_file = request.files.get('receipt')
    else:
        data = request.get_json() or {}
        amount = float(data.get('amount', 0))
        method = data.get('method', 'cash')
        bank = data.get('bank', '')
        account_holder = data.get('account_holder', '')
        reference = data.get('reference', '')
        receipt_file = None

    if amount <= 0:
        return jsonify({'message': 'Deposit amount must be greater than zero'}), 400
    order.deposit_amount = (order.deposit_amount or 0) + amount
    order.deposit_method = method
    if method == 'bank':
        order.deposit_bank = bank.upper()
        order.deposit_account_holder = account_holder.upper()
        order.deposit_transaction_reference = reference.upper()
    if receipt_file and receipt_file.filename:
        receipt_data = compress_to_base64(receipt_file)
        if receipt_data:
            order.deposit_receipt_image = receipt_data
    db.session.commit()
    return jsonify({'message': 'Deposit added', 'deposit_amount': order.deposit_amount}), 200

@orders_bp.route('/<int:id>/fulfill', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager')
def fulfill_order(id):
    try:
        return _fulfill_order(id)
    except HTTPException:
        raise  # keep proper status codes (e.g. 404 from get_or_404)
    except Exception as e:
        db.session.rollback()
        logger.error(f"fulfill_order failed for order {id}: {e}", exc_info=True)
        return jsonify({'message': 'Failed to fulfill order. Please try again.'}), 500


def _fulfill_order(id):
    order = db.get_or_404(Order, id)
    if order.status != 'waiting':
        return jsonify({'message': 'Order is not in waiting status'}), 400

    order.status = 'fulfilled'

    current_user_id = int(get_jwt_identity())
    log_activity(current_user_id, 'FULFILL_ORDER',
        f"Fulfilled order #{order.sequence_number} for {order.customer_name}")

    db.session.commit()
    send_notification(
        'Order Fulfilled',
        f'Order #{order.sequence_number} fulfilled for {order.customer_name}',
        {'type': 'order_fulfilled'}
    )
    return jsonify({'message': 'Order fulfilled successfully', 'status': 'fulfilled'}), 200

@orders_bp.route('/<int:id>/cancel', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager')
def cancel_order(id):
    order = db.get_or_404(Order, id)
    if order.status == 'cancelled':
        return jsonify({'message': 'Order is already cancelled'}), 400
    if order.status == 'fulfilled':
        return jsonify({'message': 'Cannot cancel a fulfilled order. Reverse via sales instead.'}), 400

    data = request.get_json() or {}
    current_user_id = int(get_jwt_identity())

    order.status = 'cancelled'
    order.cancelled_at = datetime.now(timezone.utc)
    order.cancelled_by = current_user_id
    order.cancellation_reason = data.get('reason', '').strip()[:200]
    order.refund_amount = float(data.get('refund_amount', order.deposit_amount or 0))
    order.refund_date = datetime.now(timezone.utc)

    refund_method = data.get('refund_method', 'cash')
    order.refund_method = refund_method
    if refund_method == 'bank':
        order.refund_bank = data.get('refund_bank', '').upper()
        order.refund_transaction_reference = data.get('refund_transaction_reference', '').upper()
    else:
        order.refund_bank = None
        order.refund_transaction_reference = None

    # Re-sequence remaining waiting orders in the same branch
    remaining = Order.query.filter(
        Order.branch_id == order.branch_id,
        Order.status == 'waiting',
        Order.id != order.id
    ).order_by(Order.sequence_number).all()
    for i, o in enumerate(remaining, 1):
        o.sequence_number = i

    log_activity(current_user_id, 'CANCEL_ORDER',
        f"Cancelled order #{order.sequence_number} for {order.customer_name}, "
        f"refund ETB {order.refund_amount} via {refund_method}")

    db.session.commit()
    return jsonify({
        'message': 'Order cancelled',
        'refund_amount': order.refund_amount,
        'refund_method': refund_method
    }), 200

@orders_bp.route('/reorder', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager')
def reorder_orders():
    data = request.get_json()
    order_id = data.get('id')
    direction = data.get('direction')  # 'up' or 'down'
    if not order_id or direction not in ('up', 'down'):
        return jsonify({'message': 'id and direction (up/down) are required'}), 400

    order = db.get_or_404(Order, order_id)
    branch_id = order.branch_id

    adjacent = Order.query.filter(
        Order.branch_id == branch_id,
        Order.status == 'waiting',
        Order.id != order_id
    )
    if direction == 'up':
        adjacent = adjacent.filter(Order.sequence_number < order.sequence_number).order_by(Order.sequence_number.desc()).first()
    else:
        adjacent = adjacent.filter(Order.sequence_number > order.sequence_number).order_by(Order.sequence_number.asc()).first()

    if not adjacent:
        return jsonify({'message': 'Cannot move further'}), 400

    order.sequence_number, adjacent.sequence_number = adjacent.sequence_number, order.sequence_number
    db.session.commit()
    return jsonify({'message': 'Order reordered'}), 200

@orders_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
@role_required('admin', 'manager', 'cashier')
def update_order(id):
    order = db.get_or_404(Order, id)
    data = request.get_json()
    current_user = db.session.get(User, get_jwt_identity())
    
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
    order = db.get_or_404(Order, id)
    db.session.delete(order)
    db.session.commit()
    return jsonify({'message': 'Order deleted'}), 200
