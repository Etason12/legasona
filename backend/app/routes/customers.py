from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Customer, Sale, Order, Vehicle, SparePart, User, Payment, db
from app.utils.auth import admin_required, role_required, effective_branch_id
from app.utils.validation import safe_int, safe_float
from app.utils.sanitization import sanitize_string, sanitize_search
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

customers_bp = Blueprint('customers', __name__)

@customers_bp.route('', methods=['GET'])
@jwt_required()
def get_customers():
    search = request.args.get('search', '')
    branch_id = request.args.get('branch_id')
    current_user_id = get_jwt_identity()
    current_user = db.session.get(User, current_user_id)
    page = safe_int(request.args.get('page', 1), default=1, min_val=1)
    per_page = safe_int(request.args.get('per_page', 50), default=50, min_val=1, max_val=100)
    query  = Customer.query
    if search:
        safe_q = sanitize_search(search)
        query = query.filter(or_(
            Customer.full_name.ilike(f"%{safe_q}%"),
            Customer.phone.ilike(f"%{safe_q}%")
        ))
    branch_id = effective_branch_id(current_user, branch_id)
    if branch_id:
        query = query.filter(Customer.branch_id == branch_id)
    
    paginated_customers = query.order_by(Customer.full_name.asc()).paginate(page=page, per_page=per_page, error_out=False)
    customers = paginated_customers.items
    
    return jsonify({
        'items': [{
            'id': c.id, 'full_name': c.full_name, 'phone': c.phone,
            'email': c.email, 'address': c.address, 'type': c.customer_type,
            'credit_limit': c.credit_limit, 'points': c.loyalty_points
        } for c in customers],
        'total': paginated_customers.total,
        'pages': paginated_customers.pages,
        'current_page': page
    }), 200


@customers_bp.route('', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'cashier')
def add_customer():
    data = request.get_json()
    if Customer.query.filter_by(phone=data.get('phone')).first():
        return jsonify({'message': 'Customer with this phone already exists'}), 409
    c = Customer(
        full_name=(data.get('full_name') or '').strip().title(), phone=data.get('phone'),
        email=data.get('email'), address=data.get('address'),
        customer_type=data.get('type', 'individual'),
        credit_limit=safe_float(data.get('credit_limit'), default=0),
        branch_id=data.get('branch_id')
    )
    db.session.add(c)
    db.session.commit()
    return jsonify({'message': 'Customer created', 'id': c.id}), 201

@customers_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
def get_customer_details(id):
    c      = db.get_or_404(Customer, id)
    sales  = Sale.query.filter_by(customer_id=id).all()
    orders = Order.query.filter_by(customer_id=id).all()

    sales_data = []

    # Batch-load vehicles and spare parts to avoid N+1 queries
    vehicle_ids = {s.item_id for s in sales if s.sale_type == 'vehicle' and s.item_id}
    spare_part_ids = {s.item_id for s in sales if s.sale_type == 'spare_part' and s.item_id}
    vehicles = {v.id: v for v in Vehicle.query.filter(Vehicle.id.in_(vehicle_ids)).all()} if vehicle_ids else {}
    spare_parts = {p.id: p for p in SparePart.query.filter(SparePart.id.in_(spare_part_ids)).all()} if spare_part_ids else {}

    for s in sales:
        item_name = None
        item_detail = None
        if s.sale_type == 'vehicle' and s.item_id:
            v = vehicles.get(s.item_id)
            if v:
                item_name = v.model
                item_detail = v.vin
        elif s.sale_type == 'spare_part' and s.item_id:
            p = spare_parts.get(s.item_id)
            if p:
                item_name = p.name
                item_detail = p.part_number
        sales_data.append({
            'id': s.id, 'number': s.sale_number, 'amount': s.total_amount,
            'date': s.sale_date.isoformat(), 'status': s.status,
            'sale_type': s.sale_type, 'item_name': item_name, 'item_detail': item_detail
        })

    return jsonify({
        'id': c.id, 'full_name': c.full_name, 'phone': c.phone,
        'email': c.email, 'address': c.address, 'type': c.customer_type,
        'credit_limit': c.credit_limit, 'points': c.loyalty_points,
        'history': {
            'sales':  sales_data,
            'orders': [{'id': o.id, 'specs': o.vehicle_specs,
                        'date': o.order_date.isoformat(), 'status': o.status} for o in orders]
        }
    }), 200

@customers_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
@role_required('admin', 'manager', 'cashier')
def update_customer(id):
    c    = db.get_or_404(Customer, id)
    data = request.get_json()
    c.full_name     = (data.get('full_name') or '').strip().title()
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
    c = db.get_or_404(Customer, id)
    try:
        # Detach any historical records that reference this customer so the
        # delete doesn't violate the sales/orders foreign keys on Postgres.
        Sale.query.filter_by(customer_id=id).update({'customer_id': None})
        Order.query.filter_by(customer_id=id).update({'customer_id': None})
        db.session.delete(c)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'message': 'Cannot delete this customer because they have linked sales or orders'}), 400
    return jsonify({'message': 'Customer deleted'}), 200


@customers_bp.route('/<int:id>/deposits', methods=['GET'])
@jwt_required()
def get_customer_deposits(id):
    db.get_or_404(Customer, id)
    orders = Order.query.filter_by(customer_id=id).order_by(Order.order_date.desc()).all()
    deposits = []
    for o in orders:
        if o.deposit_amount and float(o.deposit_amount) > 0:
            deposits.append({
                'amount': float(o.deposit_amount),
                'method': o.deposit_method or 'cash',
                'date': o.order_date.isoformat() if o.order_date else None,
            })
    payments = Payment.query.join(Sale).filter(Sale.customer_id == id).order_by(Payment.created_at.desc()).all()
    for p in payments:
        deposits.append({
            'amount': float(p.amount),
            'method': p.payment_method or 'cash',
            'date': p.created_at.isoformat() if p.created_at else None,
        })
    deposits.sort(key=lambda d: d.get('date') or '', reverse=True)
    return jsonify(deposits), 200
