from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.models import Transfer, Vehicle, SparePart, db
from app.utils.auth import role_required
from datetime import datetime

transfers_bp = Blueprint('transfers', __name__)

@transfers_bp.route('/request', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'storekeeper')
def request_transfer():
    data        = request.get_json()
    item_type   = data.get('item_type')
    item_id     = data.get('item_id')
    quantity    = int(data.get('quantity', 1))
    from_branch_id = data.get('from_branch_id')

    if item_type == 'spare_part':
        part = SparePart.query.get(item_id)
        if not part or part.branch_id != int(from_branch_id) or part.quantity < quantity:
            return jsonify({'message': 'Insufficient stock in source branch'}), 400
    elif item_type == 'vehicle':
        veh = Vehicle.query.get(item_id)
        if not veh or veh.branch_id != int(from_branch_id) or veh.status != 'available':
            return jsonify({'message': 'Vehicle not available in source branch'}), 400

    new_transfer = Transfer(
        from_branch_id=from_branch_id, to_branch_id=data.get('to_branch_id'),
        item_type=item_type, item_id=item_id, quantity=quantity,
        requested_by=data.get('user_id'), approval_status='pending'
    )
    db.session.add(new_transfer)
    db.session.commit()
    return jsonify({'message': 'Transfer requested successfully', 'transfer_id': new_transfer.id}), 201

@transfers_bp.route('', methods=['GET'])
@jwt_required()
def get_transfers():
    transfers = Transfer.query.order_by(Transfer.request_date.desc()).all()
    return jsonify([{
        'id': t.id, 'from_branch': t.from_branch_id, 'to_branch': t.to_branch_id,
        'item_type': t.item_type, 'item_id': t.item_id,
        'quantity': t.quantity, 'status': t.approval_status,
        'date': t.request_date.isoformat()
    } for t in transfers]), 200

@transfers_bp.route('/<int:id>/approve', methods=['PUT'])
@jwt_required()
@role_required('admin', 'manager')
def approve_transfer(id):
    transfer = Transfer.query.get_or_404(id)
    if transfer.approval_status != 'pending':
        return jsonify({'message': 'Transfer already processed'}), 400

    if transfer.item_type == 'vehicle':
        vehicle = Vehicle.query.get(transfer.item_id)
        if vehicle and vehicle.branch_id == transfer.from_branch_id:
            vehicle.branch_id = transfer.to_branch_id
        else:
            return jsonify({'message': 'Vehicle no longer available at source'}), 400
    elif transfer.item_type == 'spare_part':
        source_part = SparePart.query.filter_by(id=transfer.item_id, branch_id=transfer.from_branch_id).first()
        if source_part and source_part.quantity >= transfer.quantity:
            source_part.quantity -= transfer.quantity
            dest_part = SparePart.query.filter_by(part_number=source_part.part_number, branch_id=transfer.to_branch_id).first()
            if dest_part:
                dest_part.quantity += transfer.quantity
            else:
                db.session.add(SparePart(
                    part_number=source_part.part_number, name=source_part.name,
                    category=source_part.category, unit_price=source_part.unit_price,
                    cost_price=source_part.cost_price, branch_id=transfer.to_branch_id,
                    quantity=transfer.quantity, image=source_part.image
                ))
        else:
            return jsonify({'message': 'Insufficient stock to fulfill transfer'}), 400

    transfer.approval_status = 'approved'
    transfer.completed_date  = datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'Transfer approved and completed'}), 200
