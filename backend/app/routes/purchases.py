from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Purchase, PurchaseItem, SparePart, Vehicle, User, db
from app.utils.auth import role_required, effective_branch_id, user_can_access_branch
from app.utils.image_utils import compress_to_base64
from app.utils.validation import safe_int, safe_float, truncate
from datetime import datetime, timezone
import json

purchases_bp = Blueprint('purchases', __name__)

@purchases_bp.route('', methods=['GET'])
@jwt_required()
def get_purchases():
    current_user_id = get_jwt_identity()
    current_user = db.session.get(User, current_user_id)
    branch_id = request.args.get('branch_id')
    query = Purchase.query
    branch_id = effective_branch_id(current_user, branch_id)
    if branch_id:
        query = query.filter(Purchase.branch_id == branch_id)
    purchases = query.order_by(Purchase.purchase_date.desc()).all()
    result = []

    # Batch-load purchase items to avoid N+1 queries
    purchase_ids = [pu.id for pu in purchases]
    all_items = PurchaseItem.query.filter(PurchaseItem.purchase_id.in_(purchase_ids)).all() if purchase_ids else []
    items_by_purchase = {}
    for it in all_items:
        items_by_purchase.setdefault(it.purchase_id, []).append(it)

    for pu in purchases:
        items = items_by_purchase.get(pu.id, [])
        result.append({
            'id': pu.id, 'supplier_name': pu.supplier_name,
            'item_type': pu.item_type, 'total_amount': pu.total_amount,
            'payment_method': pu.payment_method, 'branch_id': pu.branch_id,
            'purchase_date': pu.purchase_date.isoformat(),
            'receipt_attachment': pu.receipt_attachment,
            'items': [{'id': it.id, 'description': it.item_description,
                       'quantity': it.quantity, 'unit_cost': it.unit_cost} for it in items]
        })
    return jsonify(result), 200

@purchases_bp.route('', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'storekeeper')
def record_purchase():
    if request.content_type and 'multipart/form-data' in request.content_type:
        try:
            data = json.loads(request.form.get('data') or '{}')
        except (ValueError, TypeError):
            return jsonify({'message': 'Invalid purchase payload'}), 400
        file = request.files.get('receipt')
    else:
        data = request.get_json() or {}
        file = None

    if not isinstance(data, dict):
        return jsonify({'message': 'Invalid purchase payload'}), 400
    items_data = data.get('items') or []
    if not isinstance(items_data, list):
        return jsonify({'message': 'items must be a list'}), 400
    total = sum(safe_float(i.get('quantity'), default=0) * safe_float(i.get('unit_cost'), default=0) for i in items_data if isinstance(i, dict))

    receipt_data = compress_to_base64(file)
    current_user_id = int(get_jwt_identity())
    current_user = db.session.get(User, current_user_id)
    branch_id = effective_branch_id(current_user, data.get('branch_id'))
    if not branch_id:
        return jsonify({'message': 'Branch ID is required'}), 400
    branch_id = safe_int(branch_id)

    new_purchase = Purchase(
        supplier_name=(truncate(data.get('supplier_name'), 100) or '').title(),
        item_type=truncate(data.get('item_type'), 20),
        total_amount=total, payment_method=truncate(data.get('payment_method'), 20),
        branch_id=branch_id, user_id=current_user_id,
        receipt_attachment=receipt_data
    )
    db.session.add(new_purchase)
    db.session.flush()

    for item in items_data:
        if not isinstance(item, dict):
            continue
        quantity    = safe_int(item.get('quantity'), default=1, min_val=1)
        unit_cost   = safe_float(item.get('unit_cost'), default=0, min_val=0)
        existing_id = safe_int(item.get('existing_id'))

        db.session.add(PurchaseItem(
            purchase_id=new_purchase.id, item_description=truncate(item.get('description'), 200),
            quantity=quantity, unit_cost=unit_cost
        ))

        if data.get('item_type') == 'spare_part' and existing_id:
            part = db.session.get(SparePart, existing_id)
            if part and user_can_access_branch(current_user, part.branch_id):
                part.quantity  += quantity
                part.cost_price = unit_cost
        elif data.get('item_type') == 'vehicle' and existing_id:
            veh = db.session.get(Vehicle, existing_id)
            if veh and user_can_access_branch(current_user, veh.branch_id):
                veh.cost_price = unit_cost

    db.session.commit()
    return jsonify({'message': 'Purchase recorded', 'id': new_purchase.id, 'total': total}), 201


@purchases_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@role_required('admin', 'manager')
def delete_purchase(id):
    purchase = db.get_or_404(Purchase, id)
    current_user = db.session.get(User, get_jwt_identity())
    if not user_can_access_branch(current_user, purchase.branch_id):
        return jsonify({'message': 'Purchase not found'}), 404
    PurchaseItem.query.filter_by(purchase_id=id).delete()
    db.session.delete(purchase)
    db.session.commit()
    return jsonify({'message': 'Purchase deleted'}), 200
