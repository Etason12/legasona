import os
from flask import Blueprint, jsonify, request, send_from_directory, make_response
from flask_jwt_extended import jwt_required
from app.models import Vehicle, SparePart, db
from app.utils.auth import role_required
from app.utils.image_utils import save_compressed_image
from werkzeug.utils import secure_filename

inventory_bp = Blueprint('inventory', __name__)

# Use absolute path for upload directory
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', '..'))
UPLOAD_DIR = os.path.join(ROOT_DIR, 'uploads', 'inventory')

def save_image(file, prefix):
    if not file or file.filename == '':
        return None
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = secure_filename(f"{prefix}_{int(__import__('time').time())}.jpg")
    save_path = os.path.join(UPLOAD_DIR, filename)
    save_compressed_image(file, save_path)
    return filename

# ── Image serving (public — no JWT, images referenced directly by <img> tags) ──
@inventory_bp.route('/images/<path:filename>')
def serve_image(filename):
    resp = make_response(send_from_directory(UPLOAD_DIR, filename))
    resp.headers['Cache-Control'] = 'public, max-age=86400'
    return resp

# ── Vehicles ──────────────────────────────────────────────
@inventory_bp.route('/vehicles', methods=['GET'])
@jwt_required()
def get_vehicles():
    branch_id = request.args.get('branch_id')
    status = request.args.get('status')
    query = Vehicle.query
    if branch_id:
        query = query.filter_by(branch_id=branch_id)
    if status:
        query = query.filter_by(status=status)
    vehicles = query.all()
    return jsonify([{
        'id': v.id, 'vin': v.vin, 'type': v.type, 'power_type': v.power_type,
        'model': v.model, 'color': v.color, 'chassis_number': v.vin,
        'engine_number': v.engine_number, 'cost_price': v.cost_price,
        'selling_price': v.selling_price, 'branch_id': v.branch_id,
        'status': v.status, 'image': v.image
    } for v in vehicles]), 200

@inventory_bp.route('/vehicles', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'storekeeper')
def add_vehicle():
    vin = (request.form.get('vin') or '').strip().upper()
    if not vin:
        return jsonify({'message': 'VIN is required'}), 400
    if Vehicle.query.filter_by(vin=vin).first():
        return jsonify({'message': 'VIN already exists'}), 409
    image_filename = save_image(request.files.get('image'), 'veh')
    v = Vehicle(
        vin=vin, type=request.form.get('type'), power_type=request.form.get('power_type'),
        model=request.form.get('model'), color=request.form.get('color'),
        chassis_number=vin, engine_number=request.form.get('engine_number'),
        cost_price=float(request.form.get('cost_price', 0) or 0),
        selling_price=float(request.form.get('selling_price', 0) or 0),
        branch_id=request.form.get('branch_id'), status='available', image=image_filename
    )
    db.session.add(v)
    db.session.commit()
    return jsonify({'message': 'Vehicle added', 'id': v.id}), 201

@inventory_bp.route('/vehicles/<int:id>', methods=['PUT'])
@jwt_required()
@role_required('admin', 'manager', 'storekeeper')
def update_vehicle(id):
    v = Vehicle.query.get_or_404(id)
    if request.content_type and 'multipart' in request.content_type:
        data = request.form
        image_file = request.files.get('image')
        if image_file and image_file.filename:
            v.image = save_image(image_file, 'veh')
    else:
        data = request.get_json() or {}
    v.model = data.get('model', v.model)
    v.type = data.get('type', v.type)
    v.power_type = data.get('power_type', v.power_type)
    v.color = data.get('color', v.color)
    v.cost_price = float(data.get('cost_price', v.cost_price) or v.cost_price)
    v.selling_price = float(data.get('selling_price', v.selling_price) or v.selling_price)
    v.status = data.get('status', v.status)
    v.branch_id = data.get('branch_id', v.branch_id)
    if data.get('vin'):
        new_vin = data.get('vin').strip().upper()
        # check uniqueness only if VIN is actually changing
        if new_vin != v.vin:
            if Vehicle.query.filter(Vehicle.vin == new_vin, Vehicle.id != v.id).first():
                return jsonify({'message': 'VIN already exists'}), 409
        v.vin = new_vin
    v.chassis_number = v.vin
    v.engine_number = data.get('engine_number', v.engine_number)
    db.session.commit()
    return jsonify({'message': 'Vehicle updated'}), 200

@inventory_bp.route('/vehicles/<int:id>', methods=['DELETE'])
@jwt_required()
@role_required('admin', 'manager')
def delete_vehicle(id):
    v = Vehicle.query.get_or_404(id)
    db.session.delete(v)
    db.session.commit()
    return jsonify({'message': 'Vehicle deleted'}), 200

# ── Spare Parts ───────────────────────────────────────────
@inventory_bp.route('/spare-parts', methods=['GET'])
@jwt_required()
def get_spare_parts():
    branch_id = request.args.get('branch_id')
    query = SparePart.query
    if branch_id:
        query = query.filter_by(branch_id=branch_id)
    parts = query.all()
    return jsonify([{
        'id': p.id, 'part_number': p.part_number, 'name': p.name,
        'category': p.category, 'quantity': p.quantity,
        'unit_price': p.unit_price, 'cost_price': p.cost_price,
        'branch_id': p.branch_id, 'image': p.image
    } for p in parts]), 200

@inventory_bp.route('/spare-parts', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'storekeeper')
def add_spare_part():
    image_filename = save_image(request.files.get('image'), 'part')
    p = SparePart(
        part_number=request.form.get('part_number'), name=request.form.get('name'),
        category=request.form.get('category'),
        unit_price=float(request.form.get('unit_price', 0) or 0),
        cost_price=float(request.form.get('cost_price', 0) or 0),
        quantity=int(request.form.get('quantity', 0) or 0),
        branch_id=request.form.get('branch_id'), image=image_filename
    )
    db.session.add(p)
    db.session.commit()
    return jsonify({'message': 'Spare part added', 'id': p.id}), 201

@inventory_bp.route('/spare-parts/<int:id>', methods=['PUT'])
@jwt_required()
@role_required('admin', 'manager', 'storekeeper')
def update_spare_part(id):
    p = SparePart.query.get_or_404(id)
    if request.content_type and 'multipart' in request.content_type:
        data = request.form
        image_file = request.files.get('image')
        if image_file and image_file.filename:
            p.image = save_image(image_file, 'part')
    else:
        data = request.get_json() or {}
    p.name = data.get('name', p.name)
    p.category = data.get('category', p.category)
    p.unit_price = float(data.get('unit_price', p.unit_price) or p.unit_price)
    p.cost_price = float(data.get('cost_price', p.cost_price) or p.cost_price)
    p.quantity = int(data.get('quantity', p.quantity) or p.quantity)
    db.session.commit()
    return jsonify({'message': 'Spare part updated'}), 200

@inventory_bp.route('/spare-parts/<int:id>', methods=['DELETE'])
@jwt_required()
@role_required('admin', 'manager')
def delete_spare_part(id):
    p = SparePart.query.get_or_404(id)
    db.session.delete(p)
    db.session.commit()
    return jsonify({'message': 'Spare part deleted'}), 200
