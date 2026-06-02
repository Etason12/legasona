from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Customer, Sale, Order, Vehicle, SparePart, User, db
from app.utils.auth import admin_required, role_required
from sqlalchemy import or_

customers_bp = Blueprint('customers', __name__)

@customers_bp.route('', methods=['GET'])
@jwt_required()
def get_customers():
    search = request.args.get('search', '')
    branch_id = request.args.get('branch_id')
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    query  = Customer.query
    if search:
        query = query.filter(or_(
            Customer.full_name.ilike(f"%{search}%"),
            Customer.phone.ilike(f"%{search}%")
        ))
    if branch_id:
        query = query.filter(Customer.branch_id == branch_id)
    elif current_user.branch_id:
        query = query.filter(Customer.branch_id == current_user.branch_id)
    
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

    sales_data = []
    for s in sales:
        item_name = None
        item_detail = None
        if s.sale_type == 'vehicle' and s.item_id:
            v = Vehicle.query.get(s.item_id)
            if v:
                item_name = v.model
                item_detail = v.vin
        elif s.sale_type == 'spare_part' and s.item_id:
            p = SparePart.query.get(s.item_id)
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
    c    = Customer.query.get_or_404(id)
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
    c = Customer.query.get_or_404(id)
    db.session.delete(c)
    db.session.commit()
    return jsonify({'message': 'Customer deleted'}), 200
