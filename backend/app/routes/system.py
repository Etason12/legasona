import os
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Branch, User, Vehicle, SparePart, Sale, Payment, Order, Transfer, Purchase, PurchaseItem, Expense, ActivityLog, Customer
from app.utils.auth import admin_required

system_bp = Blueprint('system', __name__)

@system_bp.route('/import-excel-vehicles', methods=['POST'])
@jwt_required()
@admin_required
def import_excel_vehicles():
    from app import db
    excel_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../attachment.xlsx'))
    if not os.path.exists(excel_path):
        return jsonify({'message': f'File not found: {excel_path}'}), 400
    try:
        import openpyxl
        wb = openpyxl.load_workbook(excel_path)
        ws = wb.active
        headers = [cell.value for cell in ws[1]]
        col_map = {'Serial/VIN': 'vin', 'Model': 'model', 'Motor/Engine No': 'engine_number', 'Price': 'selling_price', 'cost': 'cost_price'}
        col_idx = {}
        for label, key in col_map.items():
            try:
                col_idx[key] = headers.index(label)
            except ValueError:
                return jsonify({'message': f'Column "{label}" not found in Excel'}), 400
        mekelle = Branch.query.filter_by(name='Mekelle').first()
        if not mekelle:
            return jsonify({'message': 'Mekelle branch not found'}), 400
        imported = 0
        skipped = 0
        for row in ws.iter_rows(min_row=2, values_only=True):
            vin = str(row[col_idx['vin']]).strip() if row[col_idx['vin']] else ''
            if not vin:
                continue
            if Vehicle.query.filter_by(vin=vin).first():
                skipped += 1
                continue
            model = str(row[col_idx['model']]).strip() if row[col_idx['model']] else ''
            engine = str(row[col_idx['engine_number']]).strip() if row[col_idx['engine_number']] else ''
            raw_price = row[col_idx['selling_price']]
            raw_cost = row[col_idx['cost_price']]
            v = Vehicle(vin=vin, model=model, engine_number=engine, selling_price=float(raw_price) if raw_price else 0, cost_price=float(raw_cost) if raw_cost else 0, type='3-wheel', power_type='electric', color='blue', branch_id=mekelle.id, status='available')
            db.session.add(v)
            imported += 1
        db.session.commit()
        return jsonify({'message': f'Imported {imported} vehicles, skipped {skipped}'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Import failed: {str(e)}'}), 500

@system_bp.route('/reset-database', methods=['POST'])
@jwt_required()
@admin_required
def reset_database():
    from app import db
    try:
        Payment.query.delete()
        Sale.query.delete()
        Order.query.delete()
        Transfer.query.delete()
        PurchaseItem.query.delete()
        Purchase.query.delete()
        Expense.query.delete()
        ActivityLog.query.delete()
        Customer.query.delete()
        Vehicle.query.delete()
        SparePart.query.delete()
        User.query.delete()
        Branch.query.delete()
        db.session.commit()

        shire = Branch(name='Shire', location='Shire, Tigray')
        mekelle = Branch(name='Mekelle', location='Mekelle, Tigray')
        db.session.add_all([shire, mekelle])
        db.session.flush()

        admin = User(username='admin', role='admin', branch_id=shire.id)
        admin.set_password('admin123')
        db.session.add(admin)

        vehicles = [
            Vehicle(vin='HILUX-4WD-001', type='4-wheel', power_type='non-electric', model='Toyota Hilux 4x4 2025', chassis_number='HILUX-4WD-001', engine_number='1KD-FTV-88421', color='White', branch_id=shire.id, status='available', cost_price=3200000, selling_price=4500000),
            Vehicle(vin='FOTON-EV-3W-003', type='3-wheel', power_type='electric', model='Foton Electric Tricycle', chassis_number='FOTON-EV-3W-003', engine_number='MOT-EV-33210', color='Blue', branch_id=mekelle.id, status='available', cost_price=800000, selling_price=1200000),
        ]
        db.session.add_all(vehicles)

        parts = [
            SparePart(part_number='OIL-FILT-001', name='Engine Oil Filter', category='Filters', quantity=45, branch_id=shire.id, unit_price=1200, cost_price=450),
            SparePart(part_number='BRK-PAD-002', name='Brake Pad Set (Front)', category='Brakes', quantity=12, branch_id=mekelle.id, unit_price=4500, cost_price=1800),
        ]
        db.session.add_all(parts)

        db.session.commit()
        return jsonify({'message': 'Database reset successfully. Default admin user and sample data restored.'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Reset failed: {str(e)}'}), 500
