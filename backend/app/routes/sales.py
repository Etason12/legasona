import os
import json
from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils.auth import admin_required, role_required
from werkzeug.utils import secure_filename
from datetime import datetime
from sqlalchemy import func, or_
from app.models import Sale, Payment, Vehicle, SparePart, User, db
from app.utils.logging import log_activity

sales_bp = Blueprint('sales', __name__)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', '..'))


RECEIPT_DIR = os.path.join(ROOT_DIR, 'uploads', 'receipts')

# ── Serve uploaded receipt images (public — loaded directly by <img>/<a> tags) ──
@sales_bp.route('/receipts/<path:filename>')
def serve_receipt(filename):
    return send_from_directory(RECEIPT_DIR, filename)

# ── Record Vehicle Sale ──────────────────────────────────────────────
def _save_payment_receipt(sale_id, file, index):
    if not file or not file.filename:
        return None
    os.makedirs(RECEIPT_DIR, exist_ok=True)
    filename = secure_filename(f"rcpt_{sale_id}_{index}_{int(datetime.utcnow().timestamp())}_{file.filename}")
    file.save(os.path.join(RECEIPT_DIR, filename))
    return filename


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

    new_sale = Sale(
        sale_number=sale_number, sale_type='vehicle', item_id=vehicle_id,
        customer_name=data.get('customer_name'), customer_phone=data.get('customer_phone'),
        customer_id=data.get('customer_id') or None,
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
            if not ref:
                db.session.rollback()
                return jsonify({'message': 'Transaction reference is required for bank payments'}), 400
            if Payment.query.filter(func.lower(Payment.transaction_reference) == func.lower(ref)).first():
                db.session.rollback()
                return jsonify({'message': f'Transaction reference {ref} already exists'}), 400

        receipt_file = request.files.get(f'receipt_{idx}') if request.content_type and 'multipart' in request.content_type else None
        receipt_filename = _save_payment_receipt(new_sale.id, receipt_file, idx)

        db.session.add(Payment(
            sale_id=new_sale.id, payment_method=method,
            bank_name=p.get('bank'), account_holder=p.get('accountHolder'),
            amount=float(p.get('amount', 0)),
            transaction_reference=ref, receipt_image=receipt_filename
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

    new_sale = Sale(
        sale_number=sale_number, sale_type='spare_part', item_id=part_id,
        customer_name=data.get('customer_name'), customer_phone=data.get('customer_phone'),
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
            if not ref:
                return jsonify({'message': 'Transaction reference is required for bank payments'}), 400
            if Payment.query.filter(func.lower(Payment.transaction_reference) == func.lower(ref)).first():
                return jsonify({'message': f'Transaction reference {ref} already exists'}), 400

        db.session.add(Payment(
            sale_id=new_sale.id, payment_method=method,
            bank_name=p.get('bank'), account_holder=p.get('accountHolder'),
            amount=float(p.get('amount', 0)),
            transaction_reference=ref
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
        'id': p.id, 'method': p.payment_method, 'bank': p.bank_name,
        'account_holder': p.account_holder,
        'amount': p.amount, 'reference': p.transaction_reference,
        'receipt_image': p.receipt_image,
        'date': p.payment_date.isoformat()
    } for p in payments]), 200

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

    receipt_filename = None
    file = request.files.get('receipt')
    if file and file.filename:
        os.makedirs(RECEIPT_DIR, exist_ok=True)
        filename = secure_filename(f"rcpt_{sale.id}_{int(datetime.utcnow().timestamp())}_{file.filename}")
        file.save(os.path.join(RECEIPT_DIR, filename))
        receipt_filename = filename

    if method == 'bank':
        if not reference:
            return jsonify({'message': 'Transaction reference is required for bank payments'}), 400
        if Payment.query.filter(func.lower(Payment.transaction_reference) == func.lower(reference)).first():
            return jsonify({'message': f'Transaction reference {reference} already exists'}), 400

    new_payment = Payment(
        sale_id=sale.id, payment_method=method, bank_name=bank,
        account_holder=account_holder,
        amount=amount, transaction_reference=reference, receipt_image=receipt_filename
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
    result = []
    for s in sales:
        total_paid = db.session.query(func.sum(Payment.amount)).filter(
            Payment.sale_id == s.id).scalar() or 0

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

        cashier = User.query.get(s.user_id) if s.user_id else None

        sale_payments = Payment.query.filter_by(sale_id=s.id).order_by(Payment.payment_date.asc()).all()
        payments_list = [{
            'method': p.payment_method,
            'bank': p.bank_name,
            'account_holder': p.account_holder,
            'amount': float(p.amount),
            'reference': p.transaction_reference,
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
