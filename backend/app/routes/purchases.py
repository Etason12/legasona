from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.models import Purchase, PurchaseItem, SparePart, Vehicle, db
from app.utils.auth import role_required
from app.utils.image_utils import compress_to_base64
from datetime import datetime
import json

purchases_bp = Blueprint('purchases', __name__)

@purchases_bp.route('', methods=['GET'])
@jwt_required()
def get_purchases():
    branch_id = request.args.get('branch_id')
    query = Purchase.query
    if branch_id:
        query = query.filter(Purchase.branch_id == branch_id)
    purchases = query.order_by(Purchase.purchase_date.desc()).all()
    result = []
    for pu in purchases:
        items = PurchaseItem.query.filter_by(purchase_id=pu.id).all()
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
        data = json.loads(request.form.get('data', '{}'))
        file = request.files.get('receipt')
    else:
        data = request.get_json()
        file = None

    items_data = data.get('items', [])
    total = sum(float(i.get('quantity', 0)) * float(i.get('unit_cost', 0)) for i in items_data)

    receipt_data = compress_to_base64(file)

    new_purchase = Purchase(
        supplier_name=data.get('supplier_name'), item_type=data.get('item_type'),
        total_amount=total, payment_method=data.get('payment_method'),
        branch_id=data.get('branch_id'), user_id=data.get('user_id'),
        receipt_attachment=receipt_data
    )
    db.session.add(new_purchase)
    db.session.flush()

    for item in items_data:
        quantity    = int(item.get('quantity', 1))
        unit_cost   = float(item.get('unit_cost', 0))
        existing_id = item.get('existing_id')

        db.session.add(PurchaseItem(
            purchase_id=new_purchase.id, item_description=item.get('description'),
            quantity=quantity, unit_cost=unit_cost
        ))

        if data.get('item_type') == 'spare_part' and existing_id:
            part = SparePart.query.get(existing_id)
            if part:
                part.quantity  += quantity
                part.cost_price = unit_cost
        elif data.get('item_type') == 'vehicle' and existing_id:
            veh = Vehicle.query.get(existing_id)
            if veh:
                veh.cost_price = unit_cost

    db.session.commit()
    return jsonify({'message': 'Purchase recorded', 'id': new_purchase.id, 'total': total}), 201

@purchases_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@role_required('admin', 'manager')
def delete_purchase(id):
    purchase = Purchase.query.get_or_404(id)
    PurchaseItem.query.filter_by(purchase_id=id).delete()
    db.session.delete(purchase)
    db.session.commit()
    return jsonify({'message': 'Purchase deleted'}), 200
