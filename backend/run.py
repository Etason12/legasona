from app import create_app, db
from app.models import User, Branch, Vehicle, SparePart

app = create_app()

@app.shell_context_processor
def make_shell_context():
    return {'db': db, 'User': User, 'Branch': Branch}

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        # Keep chassis_number aligned with VIN for all vehicles
        for v in Vehicle.query.all():
            if v.chassis_number != v.vin:
                v.chassis_number = v.vin
        db.session.commit()
        # Seed initial data if needed
        if not Branch.query.filter_by(name='Shire').first():
            shire = Branch(name='Shire', location='Shire, Tigray')  # type: ignore
            mekelle = Branch(name='Mekelle', location='Mekelle, Tigray')  # type: ignore
            db.session.add_all([shire, mekelle])
            db.session.commit()
            
        if not User.query.filter_by(username='admin').first():
            admin = User(username='admin', role='admin')  # type: ignore
            admin.set_password('admin123')
            db.session.add(admin)
            db.session.commit()
            
        if not Vehicle.query.first():
            vehicles = [
                Vehicle(vin='HILUX-4WD-001', type='4-wheel', model='Toyota Hilux 4x4 2025', chassis_number='HILUX-4WD-001', engine_number='1KD-FTV-88421', branch_id=1, status='available', selling_price=4500000, cost_price=3200000, color='White', power_type='non-electric'),
                Vehicle(vin='FOTON-EV-3W-003', type='3-wheel', model='Foton Electric Tricycle', chassis_number='FOTON-EV-3W-003', engine_number='MOT-EV-33210', branch_id=2, status='available', selling_price=1200000, cost_price=800000, color='Blue', power_type='electric'),
            ]
            db.session.add_all(vehicles)

        if not SparePart.query.first():
            parts = [
                SparePart(part_number='OIL-FILT-001', name='Engine Oil Filter', quantity=45, branch_id=1, unit_price=1200, cost_price=450, category='Filters'),
                SparePart(part_number='BRK-PAD-002', name='Brake Pad Set (Front)', quantity=12, branch_id=2, unit_price=4500, cost_price=1800, category='Brakes'),
            ]
            db.session.add_all(parts)
            db.session.commit()
            
    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)
