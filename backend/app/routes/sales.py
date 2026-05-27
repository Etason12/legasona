import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils.auth import admin_required, role_required
from app.utils.image_utils import compress_to_base64
from datetime import datetime
from sqlalchemy import func, or_
from app.models import Sale, Payment, Vehicle, SparePart, User, Customer, db
from app.utils.logging import log_activity

sales_bp = Blueprint('sales', __name__)

def _ensure_customer(data):
    """Create a Customer record if one doesn't exist for this phone number.
       Returns the customer_id to link to the sale."""
    customer_id = data.get('customer_id')
    name = (data.get('customer_name') or '').strip()
    phone = (data.get('customer_phone') or '').strip()
    branch_id = data.get('branch_id')
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

# ── Record Vehicle Sale ──────────────────────────────────────────────
@sales_bp.route('/vehicle', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'cashier')
def record_vehicle_sale():
    if request.content_type and 'multipart' in request.content_type:
        data = request.form
        payments_raw = data.get('payments', '[]')
        payments_data = json.loads(payments_raw) if isinstance(payments_raw, str) else payments_raw
    else:
        body = request.get_json() or {}
        data = body
        payments_data = body.get('payments', [])

    vehicle_id = data.get('vehicle_id')
    vehicle = Vehicle.query.get(vehicle_id)

    if not vehicle or vehicle.status not in ['available', 'reserved']:
        return jsonify({'message': 'Vehicle not available'}), 400

    selling_price = float(vehicle.selling_price or 0)
    if selling_price <= 0:
        return jsonify({'message': 'Vehicle has no selling price set in inventory'}), 400
    total_amount = selling_price
    paid_amount = sum(float(p.get('amount', 0)) for p in payments_data)
    status = 'completed' if paid_amount >= total_amount else 'pending'
    sale_number = f"VS-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    sale_date_str = data.get('sale_date')
    sale_date = datetime.fromisoformat(sale_date_str) if sale_date_str else datetime.utcnow()

    customer_id = _ensure_customer(data) or data.get('customer_id') or None

    new_sale = Sale(
        sale_number=sale_number, sale_type='vehicle', item_id=vehicle_id,
        customer_name=data.get('customer_name'), customer_phone=data.get('customer_phone'),
        customer_id=customer_id,
        total_amount=total_amount,
        chassis_number=vehicle.vin, motor_number=data.get('motor_number'),
        status=status, branch_id=vehicle.branch_id,
        user_id=int(get_jwt_identity()) if get_jwt_identity() else data.get('user_id'),
        sale_date=sale_date,
        cost_at_sale=vehicle.cost_price or 0.0,
        category='Vehicle'
    )
    db.session.add(new_sale)
    db.session.flush()

    for idx, p in enumerate(payments_data):
        method = p.get('method')
        ref = p.get('reference')
        if method == 'bank':
            if not p.get('bank'):
                db.session.rollback()
                return jsonify({'message': 'Bank name is required for bank payments'}), 400
            if not p.get('accountHolder'):
                db.session.rollback()
                return jsonify({'message': 'Account holder is required for bank payments'}), 400
            if not ref:
                db.session.rollback()
                return jsonify({'message': 'Transaction reference is required for bank payments'}), 400
            if Payment.query.filter(func.lower(Payment.transaction_reference) == func.lower(ref)).first():
                db.session.rollback()
                return jsonify({'message': f'Transaction reference {ref} already exists'}), 400

        receipt_file = request.files.get(f'receipt_{idx}') if request.content_type and 'multipart' in request.content_type else None
        receipt_data = compress_to_base64(receipt_file)

        db.session.add(Payment(
            sale_id=new_sale.id, payment_method=method,
            bank_name=p.get('bank', '').upper(), account_holder=p.get('accountHolder', '').upper(),
            amount=float(p.get('amount', 0)),
            transaction_reference=ref.upper() if ref else None, receipt_image=receipt_data,
            payment_date=sale_date
        ))

    vehicle.status = 'sold' if status == 'completed' else 'reserved'

    log_activity(data.get('user_id'), 'VEHICLE_SALE', f"Recorded sale {sale_number} for {data.get('customer_name')} - ETB {total_amount}")

    db.session.commit()
    return jsonify({
        'message': f'Sale recorded as {status}',
        'sale_id': new_sale.id, 'sale_number': sale_number, 'status': status
    }), 201

# ── Record Spare Part Sale ───────────────────────────────────────────
@sales_bp.route('/spare-part', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'cashier')
def record_spare_part_sale():
    data = request.get_json()
    part_id = data.get('part_id')
    part = SparePart.query.get(part_id)
    if not part:
        return jsonify({'message': 'Spare part not found'}), 404

    qty = int(data.get('quantity', 1))
    if part.quantity < qty:
        return jsonify({'message': 'Insufficient stock'}), 400

    total_amount = float(data.get('total_amount'))
    payments_data = data.get('payments', [])
    paid_amount = sum(float(p.get('amount', 0)) for p in payments_data)
    status = 'completed' if paid_amount >= total_amount else 'pending'
    sale_number = f"SP-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    sale_date_str = data.get('sale_date')
    sale_date = datetime.fromisoformat(sale_date_str) if sale_date_str else datetime.utcnow()

    customer_id = _ensure_customer(data) or data.get('customer_id') or None

    new_sale = Sale(
        sale_number=sale_number, sale_type='spare_part', item_id=part_id,
        customer_name=data.get('customer_name'), customer_phone=data.get('customer_phone'),
        customer_id=customer_id,
        total_amount=total_amount, status=status,
        category=part.category,
        branch_id=part.branch_id, user_id=data.get('user_id'),
        sale_date=sale_date,
        cost_at_sale=(part.cost_price or 0.0) * qty
    )
    db.session.add(new_sale)
    db.session.flush()

    for p in payments_data:
        method = p.get('method')
        ref = p.get('reference')
        if method == 'bank':
            if not p.get('bank'):
                return jsonify({'message': 'Bank name is required for bank payments'}), 400
            if not p.get('accountHolder'):
                return jsonify({'message': 'Account holder is required for bank payments'}), 400
            if not ref:
                return jsonify({'message': 'Transaction reference is required for bank payments'}), 400
            if Payment.query.filter(func.lower(Payment.transaction_reference) == func.lower(ref)).first():
                return jsonify({'message': f'Transaction reference {ref} already exists'}), 400

        db.session.add(Payment(
            sale_id=new_sale.id, payment_method=method,
            bank_name=p.get('bank', '').upper(), account_holder=p.get('accountHolder', '').upper(),
            amount=float(p.get('amount', 0)),
            transaction_reference=ref.upper() if ref else None,
            payment_date=sale_date
        ))

    part.quantity -= qty

    log_activity(data.get('user_id'), 'SPARE_PART_SALE', f"Recorded sale {sale_number} for {data.get('customer_name')} - ETB {total_amount}")

    db.session.commit()
    return jsonify({'message': f'Sale recorded as {status}', 'sale_number': sale_number}), 201

# ── Get Payment History for a Sale ──────────────────────────────────
@sales_bp.route('/<int:id>/payments', methods=['GET'])
@jwt_required()
def get_sale_payments(id):
    sale = Sale.query.get(id)
    if not sale:
        return jsonify({'message': 'Sale not found'}), 404
    payments = Payment.query.filter_by(sale_id=id).order_by(Payment.payment_date.asc()).all()
    return jsonify([{
        'id': p.id, 'method': p.payment_method, 'bank': p.bank_name.upper() if p.bank_name else None,
        'account_holder': p.account_holder.upper() if p.account_holder else None,
        'amount': p.amount, 'reference': p.transaction_reference.upper() if p.transaction_reference else None,
        'receipt_image': p.receipt_image,
        'date': p.payment_date.isoformat()
    } for p in payments]), 200

# ── Update Payment ──────────────────────────────────────────────────
@sales_bp.route('/<int:sale_id>/payments/<int:payment_id>', methods=['PUT'])
@jwt_required()
@admin_required
def update_payment(sale_id, payment_id):
    sale = Sale.query.get(sale_id)
    if not sale:
        return jsonify({'message': 'Sale not found'}), 404

    payment = Payment.query.get(payment_id)
    if not payment or payment.sale_id != sale_id:
        return jsonify({'message': 'Payment not found'}), 404

    if request.content_type and 'multipart' in request.content_type:
        receipt_file = request.files.get('receipt')
        if receipt_file and receipt_file.filename:
            payment.receipt_image = compress_to_base64(receipt_file)
        data = {}
        for key in ('method', 'amount', 'bank', 'account_holder', 'reference'):
            v = request.form.get(key)
            if v is not None:
                data[key] = v
        # Map form field names to expected keys
        if 'account_holder' in data:
            data['accountHolder'] = data.pop('account_holder')
    else:
        data = request.get_json()

    if not data:
        return jsonify({'message': 'No data provided'}), 400

    method = data.get('method', payment.payment_method)
    amount = float(data.get('amount', payment.amount))

    if method == 'bank':
        bank = data.get('bank', payment.bank_name or '')
        account_holder = data.get('accountHolder', payment.account_holder or '')
        reference = data.get('reference', payment.transaction_reference or '')
        if not bank:
            return jsonify({'message': 'Bank name is required for bank payments'}), 400
        if not account_holder:
            return jsonify({'message': 'Account holder is required for bank payments'}), 400
        if not reference:
            return jsonify({'message': 'Transaction reference is required for bank payments'}), 400
        existing = Payment.query.filter(
            Payment.transaction_reference.ilike(reference),
            Payment.id != payment_id,
            Payment.sale_id == sale_id
        ).first()
        if existing:
            return jsonify({'message': f'Transaction reference {reference} already exists'}), 400
        payment.bank_name = bank.upper()
        payment.account_holder = account_holder.upper()
        payment.transaction_reference = reference.upper()
    else:
        payment.bank_name = None
        payment.account_holder = None
        payment.transaction_reference = None

    payment.payment_method = method
    payment.amount = amount

    # Recalculate sale status
    total_paid = db.session.query(func.sum(Payment.amount)).filter(Payment.sale_id == sale.id).scalar() or 0
    if total_paid >= sale.total_amount:
        sale.status = 'completed'
        if sale.sale_type == 'vehicle':
            v = Vehicle.query.get(sale.item_id)
            if v:
                v.status = 'sold'
    else:
        sale.status = 'pending'
        if sale.sale_type == 'vehicle':
            v = Vehicle.query.get(sale.item_id)
            if v and v.status == 'sold':
                v.status = 'reserved'

    user_id = get_jwt_identity()
    log_activity(user_id, 'UPDATE_PAYMENT', f"Updated payment ETB {amount} on sale {sale.sale_number}")

    db.session.commit()
    return jsonify({'message': 'Payment updated', 'status': sale.status}), 200


# ── Delete Payment ──────────────────────────────────────────────────
@sales_bp.route('/<int:sale_id>/payments/<int:payment_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_payment(sale_id, payment_id):
    sale = Sale.query.get(sale_id)
    if not sale:
        return jsonify({'message': 'Sale not found'}), 404

    payment = Payment.query.get(payment_id)
    if not payment or payment.sale_id != sale_id:
        return jsonify({'message': 'Payment not found'}), 404

    db.session.delete(payment)
    db.session.flush()

    # Recalculate sale status
    total_paid = db.session.query(func.sum(Payment.amount)).filter(Payment.sale_id == sale.id).scalar() or 0
    if total_paid >= sale.total_amount:
        sale.status = 'completed'
    else:
        sale.status = 'pending'
        if sale.sale_type == 'vehicle':
            v = Vehicle.query.get(sale.item_id)
            if v and v.status == 'sold':
                v.status = 'reserved'

    user_id = get_jwt_identity()
    log_activity(user_id, 'DELETE_PAYMENT', f"Deleted payment ETB {payment.amount} from sale {sale.sale_number}")

    db.session.commit()
    return jsonify({'message': 'Payment deleted', 'status': sale.status}), 200


# ── Add Payment to Pending Sale ──────────────────────────────────────
@sales_bp.route('/<int:id>/add-payment', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'cashier')
def add_payment(id):
    sale = Sale.query.get(id)
    if not sale:
        return jsonify({'message': 'Sale not found'}), 404
    if sale.status == 'completed':
        return jsonify({'message': 'Sale already fully paid'}), 400

    amount = float(request.form.get('amount', 0))
    method = request.form.get('method', 'cash')
    bank = request.form.get('bank', '')
    account_holder = request.form.get('account_holder', '')
    reference = request.form.get('reference', '')

    receipt_data = compress_to_base64(request.files.get('receipt'))

    if method == 'bank':
        if not bank:
            return jsonify({'message': 'Bank name is required for bank payments'}), 400
        if not account_holder:
            return jsonify({'message': 'Account holder is required for bank payments'}), 400
        if not reference:
            return jsonify({'message': 'Transaction reference is required for bank payments'}), 400
        if Payment.query.filter(func.lower(Payment.transaction_reference) == func.lower(reference)).first():
            return jsonify({'message': f'Transaction reference {reference} already exists'}), 400

    new_payment = Payment(
        sale_id=sale.id, payment_method=method, bank_name=bank.upper() if bank else '',
        account_holder=account_holder.upper() if account_holder else '',
        amount=amount, transaction_reference=reference.upper() if reference else '',
        receipt_image=receipt_data
    )
    db.session.add(new_payment)
    db.session.flush()  # flush so the new payment is included in the aggregate

    total_paid = db.session.query(func.sum(Payment.amount)).filter(Payment.sale_id == sale.id).scalar() or 0

    if total_paid >= sale.total_amount:
        sale.status = 'completed'
        if sale.sale_type == 'vehicle':
            v = Vehicle.query.get(sale.item_id)
            if v:
                v.status = 'sold'

    user_id = get_jwt_identity()
    log_activity(user_id, 'ADD_PAYMENT', f"Added ETB {amount} to sale {sale.sale_number}")

    db.session.commit()
    return jsonify({'message': 'Payment added', 'status': sale.status}), 200

# ── Cancel / Delete Sale ─────────────────────────────────────────────
@sales_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@admin_required
def cancel_sale(id):
    sale = Sale.query.get_or_404(id)
    sale.status = 'cancelled'
    if sale.sale_type == 'vehicle':
        v = Vehicle.query.get(sale.item_id)
        if v:
            v.status = 'available'
    db.session.commit()
    return jsonify({'message': 'Sale cancelled'}), 200

# ── List / Filter Sales ──────────────────────────────────────────────
@sales_bp.route('', methods=['GET'])
@jwt_required()
def get_sales():
    status_filter = request.args.get('status', '')
    search_query = request.args.get('search', '')
    start_date = request.args.get('start_date', '')
    end_date = request.args.get('end_date', '')
    branch_id = request.args.get('branch_id')

    query = Sale.query
    if branch_id:
        query = query.filter(Sale.branch_id == branch_id)
    if status_filter:
        query = query.filter(Sale.status == status_filter)
    if start_date:
        query = query.filter(Sale.sale_date >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Sale.sale_date <= datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59))
    if search_query:
        query = query.filter(or_(
            Sale.customer_name.ilike(f"%{search_query}%"),
            Sale.sale_number.ilike(f"%{search_query}%")
        ))

    sales = query.order_by(Sale.sale_date.desc()).all()
    sale_ids = [s.id for s in sales]

    # Batch-load payment totals
    totals = dict(db.session.query(Payment.sale_id, func.sum(Payment.amount)).filter(Payment.sale_id.in_(sale_ids)).group_by(Payment.sale_id).all())

    # Batch-load all payments
    all_payments = Payment.query.filter(Payment.sale_id.in_(sale_ids)).order_by(Payment.payment_date.asc()).all()
    payments_by_sale = {}
    for p in all_payments:
        payments_by_sale.setdefault(p.sale_id, []).append(p)

    # Batch-load users
    user_ids = {s.user_id for s in sales if s.user_id}
    users = {u.id: u for u in User.query.filter(User.id.in_(user_ids)).all()} if user_ids else {}

    result = []
    for s in sales:
        total_paid = float(totals.get(s.id, 0) or 0)

        item_image = None
        item_name = None
        power_type = None
        chassis_number = s.chassis_number
        motor_number = s.motor_number
        if s.sale_type == 'vehicle':
            v = Vehicle.query.get(s.item_id)
            if v:
                item_image = v.image
                item_name = v.model
                power_type = v.power_type
                chassis_number = chassis_number or v.vin
                motor_number = motor_number or v.engine_number
        else:
            p = SparePart.query.get(s.item_id)
            if p:
                item_image = p.image
                item_name = p.name

        cashier = users.get(s.user_id)

        sale_payments = payments_by_sale.get(s.id, [])
        payments_list = [{
            'method': p.payment_method,
            'bank': p.bank_name.upper() if p.bank_name else None,
            'account_holder': p.account_holder.upper() if p.account_holder else None,
            'amount': float(p.amount),
            'reference': p.transaction_reference.upper() if p.transaction_reference else None,
            'date': p.payment_date.isoformat()
        } for p in sale_payments]

        result.append({
            'id': s.id, 'sale_number': s.sale_number,
            'customer_name': s.customer_name, 'customer_phone': s.customer_phone,
            'total_amount': s.total_amount,
            'amount_paid': float(total_paid), 'sale_type': s.sale_type,
            'category': s.category,
            'chassis_number': chassis_number, 'motor_number': motor_number,
            'status': s.status, 'sale_date': s.sale_date.isoformat(),
            'item_image': item_image, 'item_name': item_name,
            'power_type': power_type, 'payments': payments_list,
            'cashier_name': cashier.username if cashier else None,
            'balance': float(s.total_amount) - float(total_paid),
        })
    return jsonify(result), 200
