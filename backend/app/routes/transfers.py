from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Transfer, Vehicle, SparePart, Branch, User, db
from app.utils.auth import role_required, effective_branch_id, user_can_access_branch
from app.utils.validation import safe_int
from datetime import datetime, timezone
from sqlalchemy import or_

transfers_bp = Blueprint('transfers', __name__)

@transfers_bp.route('/request', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'storekeeper')
def request_transfer():
    data        = request.get_json() or {}
    item_type   = data.get('item_type')
    item_id     = safe_int(data.get('item_id'))
    quantity    = safe_int(data.get('quantity'), default=1, min_val=1)
    current_user = db.session.get(User, get_jwt_identity())

    # Non-admins may only move stock out of their own branch.
    from_branch_id = effective_branch_id(current_user, data.get('from_branch_id'))
    from_branch_id = safe_int(from_branch_id)
    to_branch_id   = safe_int(data.get('to_branch_id'))

    if item_type not in ('vehicle', 'spare_part'):
        return jsonify({'message': 'item_type must be vehicle or spare_part'}), 400
    if not from_branch_id or not db.session.get(Branch, from_branch_id):
        return jsonify({'message': 'A valid source branch is required'}), 400
    if not to_branch_id or not db.session.get(Branch, to_branch_id):
        return jsonify({'message': 'A valid destination branch is required'}), 400
    if to_branch_id == from_branch_id:
        return jsonify({'message': 'Source and destination branches must differ'}), 400

    if item_type == 'spare_part':
        part = db.session.get(SparePart, item_id)
        if not part or part.branch_id != from_branch_id or part.quantity < quantity:
            return jsonify({'message': 'Insufficient stock in source branch'}), 400
    elif item_type == 'vehicle':
        veh = db.session.get(Vehicle, item_id)
        if not veh or veh.branch_id != from_branch_id or veh.status != 'available':
            return jsonify({'message': 'Vehicle not available in source branch'}), 400

    new_transfer = Transfer(
        from_branch_id=from_branch_id, to_branch_id=to_branch_id,
        item_type=item_type, item_id=item_id, quantity=quantity,
        requested_by=int(get_jwt_identity()), approval_status='pending'
    )
    db.session.add(new_transfer)
    db.session.commit()
    return jsonify({'message': 'Transfer requested successfully', 'transfer_id': new_transfer.id}), 201

@transfers_bp.route('', methods=['GET'])
@jwt_required()
def get_transfers():
    page = safe_int(request.args.get('page', 1), default=1, min_val=1)
    per_page = safe_int(request.args.get('per_page', 50), default=50, min_val=1, max_val=200)
    current_user = db.session.get(User, get_jwt_identity())
    branch_id = effective_branch_id(current_user, request.args.get('branch_id'))
    query = Transfer.query
    if branch_id:
        branch_id = safe_int(branch_id)
        query = query.filter(or_(
            Transfer.from_branch_id == branch_id,
            Transfer.to_branch_id == branch_id,
        ))
    paginated = query.order_by(Transfer.request_date.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'items': [{
            'id': t.id, 'from_branch': t.from_branch_id, 'to_branch': t.to_branch_id,
            'item_type': t.item_type, 'item_id': t.item_id,
            'quantity': t.quantity, 'status': t.approval_status,
            'date': t.request_date.isoformat()
        } for t in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages,
        'current_page': page
    }), 200

@transfers_bp.route('/<int:id>/approve', methods=['PUT'])
@jwt_required()
@role_required('admin', 'manager')
def approve_transfer(id):
    transfer = db.get_or_404(Transfer, id)
    current_user = db.session.get(User, get_jwt_identity())
    if not (user_can_access_branch(current_user, transfer.from_branch_id)
            or user_can_access_branch(current_user, transfer.to_branch_id)):
        return jsonify({'message': 'Transfer not found'}), 404
    if transfer.approval_status != 'pending':
        return jsonify({'message': 'Transfer already processed'}), 400

    if transfer.item_type == 'vehicle':
        vehicle = db.session.get(Vehicle, transfer.item_id)
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
    transfer.completed_date  = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'message': 'Transfer approved and completed'}), 200
