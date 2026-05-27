import json
from datetime import datetime
from flask import Blueprint, jsonify, Response
from flask_jwt_extended import jwt_required
from app.models import Branch, Customer, User, Vehicle, SparePart, Sale, Payment, Order, Transfer, Purchase, PurchaseItem, Expense, ActivityLog, db
from app.utils.auth import admin_required

backup_bp = Blueprint('backup', __name__)

SERIALIZERS = {
    Branch: lambda r: {'id': r.id, 'name': r.name, 'location': r.location, 'address': r.address, 'phone': r.phone, 'status': r.status, 'monthly_budget': str(r.monthly_budget) if r.monthly_budget else None},
    Customer: lambda r: {'id': r.id, 'full_name': r.full_name, 'phone': r.phone, 'email': r.email, 'address': r.address, 'customer_type': r.customer_type, 'credit_limit': str(r.credit_limit) if r.credit_limit else None, 'loyalty_points': r.loyalty_points, 'created_at': r.created_at.isoformat() if r.created_at else None, 'branch_id': r.branch_id},
    User: lambda r: {'id': r.id, 'username': r.username, 'role': r.role, 'branch_id': r.branch_id, 'status': r.status},
    Vehicle: lambda r: {'id': r.id, 'vin': r.vin, 'type': r.type, 'power_type': r.power_type, 'model': r.model, 'color': r.color, 'chassis_number': r.chassis_number, 'engine_number': r.engine_number, 'cost_price': str(r.cost_price) if r.cost_price else None, 'selling_price': str(r.selling_price) if r.selling_price else None, 'branch_id': r.branch_id, 'status': r.status, 'received_date': r.received_date.isoformat() if r.received_date else None, 'image': r.image},
    SparePart: lambda r: {'id': r.id, 'part_number': r.part_number, 'name': r.name, 'category': r.category, 'unit_price': str(r.unit_price) if r.unit_price else None, 'cost_price': str(r.cost_price) if r.cost_price else None, 'branch_id': r.branch_id, 'quantity': r.quantity, 'image': r.image},
    Sale: lambda r: {'id': r.id, 'sale_number': r.sale_number, 'sale_type': r.sale_type, 'item_id': r.item_id, 'customer_name': r.customer_name, 'category': r.category, 'customer_phone': r.customer_phone, 'customer_id_number': r.customer_id_number, 'customer_id': r.customer_id, 'total_amount': str(r.total_amount) if r.total_amount else None, 'cost_at_sale': str(r.cost_at_sale) if r.cost_at_sale else None, 'chassis_number': r.chassis_number, 'motor_number': r.motor_number, 'receipt_image': r.receipt_image, 'transaction_reference': r.transaction_reference, 'status': r.status, 'branch_id': r.branch_id, 'user_id': r.user_id, 'sale_date': r.sale_date.isoformat() if r.sale_date else None},
    Payment: lambda r: {'id': r.id, 'sale_id': r.sale_id, 'payment_method': r.payment_method, 'bank_name': r.bank_name, 'account_holder': r.account_holder, 'amount': str(r.amount) if r.amount else None, 'transaction_reference': r.transaction_reference, 'receipt_image': r.receipt_image, 'payment_date': r.payment_date.isoformat() if r.payment_date else None, 'created_at': r.created_at.isoformat() if r.created_at else None},
    Order: lambda r: {'id': r.id, 'customer_name': r.customer_name, 'customer_phone': r.customer_phone, 'customer_id': r.customer_id, 'vehicle_specs': r.vehicle_specs, 'sequence_number': r.sequence_number, 'deposit_amount': str(r.deposit_amount) if r.deposit_amount else None, 'deposit_method': r.deposit_method, 'deposit_bank': r.deposit_bank, 'deposit_account_holder': r.deposit_account_holder, 'deposit_transaction_reference': r.deposit_transaction_reference, 'order_date': r.order_date.isoformat() if r.order_date else None, 'status': r.status, 'branch_id': r.branch_id},
    Transfer: lambda r: {'id': r.id, 'from_branch_id': r.from_branch_id, 'to_branch_id': r.to_branch_id, 'item_type': r.item_type, 'item_id': r.item_id, 'quantity': r.quantity, 'request_date': r.request_date.isoformat() if r.request_date else None, 'approval_status': r.approval_status, 'completed_date': r.completed_date.isoformat() if r.completed_date else None, 'requested_by': r.requested_by, 'approved_by': r.approved_by},
    Purchase: lambda r: {'id': r.id, 'supplier_name': r.supplier_name, 'purchase_date': r.purchase_date.isoformat() if r.purchase_date else None, 'item_type': r.item_type, 'total_amount': str(r.total_amount) if r.total_amount else None, 'payment_method': r.payment_method, 'branch_id': r.branch_id, 'user_id': r.user_id, 'receipt_attachment': r.receipt_attachment},
    PurchaseItem: lambda r: {'id': r.id, 'purchase_id': r.purchase_id, 'item_description': r.item_description, 'quantity': r.quantity, 'unit_cost': str(r.unit_cost) if r.unit_cost else None},
    Expense: lambda r: {'id': r.id, 'category': r.category, 'description': r.description, 'amount': str(r.amount) if r.amount else None, 'expense_date': r.expense_date.isoformat() if r.expense_date else None, 'branch_id': r.branch_id, 'receipt_attachment': r.receipt_attachment, 'approved_by': r.approved_by, 'user_id': r.user_id},
    ActivityLog: lambda r: {'id': r.id, 'user_id': r.user_id, 'action': r.action, 'description': r.description, 'timestamp': r.timestamp.isoformat() if r.timestamp else None},
}

@backup_bp.route('/backup/export', methods=['GET'])
@jwt_required()
@admin_required
def export_backup():
    backup = {
        'version': '1.0',
        'exported_at': datetime.utcnow().isoformat(),
        'tables': {}
    }
    for model, serializer in SERIALIZERS.items():
        table_name = model.__tablename__
        records = model.query.all()
        backup['tables'][table_name] = [serializer(r) for r in records]

    json_str = json.dumps(backup, indent=2, ensure_ascii=False)
    filename = f"legasona-backup-{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    return Response(
        json_str,
        mimetype='application/json',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )
