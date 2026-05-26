import os
from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from app.routes.health import health_bp

# Extensions
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

def create_app(config_class=Config):
    # Determine the absolute path to the React build directory
    frontend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend'))
    static_dir = os.path.join(frontend_root, 'dist')
    # Serve static files at root (no prefix) to allow SPA routes like /login
    app = Flask(__name__, static_folder=static_dir, static_url_path='/static')
    app.config.from_object(config_class)

    # Initialise extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Register blueprints (backend API routes)
    from app.routes.auth import auth_bp
    from app.routes.branches import branches_bp
    from app.routes.inventory import inventory_bp
    from app.routes.sales import sales_bp
    from app.routes.orders import orders_bp
    from app.routes.transfers import transfers_bp
    from app.routes.purchases import purchases_bp
    from app.routes.expenses import expenses_bp
    from app.routes.reports import reports_bp
    from app.routes.users import users_bp
    from app.routes.customers import customers_bp
    from app.routes.parts import parts_bp
    from app.routes.system import system_bp

    app.register_blueprint(parts_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(branches_bp, url_prefix='/api/branches')
    app.register_blueprint(inventory_bp, url_prefix='/api/inventory')
    app.register_blueprint(sales_bp, url_prefix='/api/sales')
    app.register_blueprint(orders_bp, url_prefix='/api/orders')
    app.register_blueprint(transfers_bp, url_prefix='/api/transfers')
    app.register_blueprint(purchases_bp, url_prefix='/api/purchases')
    app.register_blueprint(expenses_bp, url_prefix='/api/expenses')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(customers_bp, url_prefix='/api/customers')
    app.register_blueprint(health_bp, url_prefix='/api')
    app.register_blueprint(system_bp, url_prefix='/api')

    # Seed database on first startup
    with app.app_context():
        from app.models import User, Branch, Vehicle, SparePart
        db.create_all()
        for v in Vehicle.query.all():
            if v.chassis_number != v.vin:
                v.chassis_number = v.vin
        db.session.commit()
        if not Branch.query.filter_by(name='Shire').first():
            shire = Branch(name='Shire', location='Shire, Tigray')
            mekelle = Branch(name='Mekelle', location='Mekelle, Tigray')
            db.session.add_all([shire, mekelle])
            db.session.commit()
        if not User.query.filter_by(username='admin').first():
            admin = User(username='admin', role='admin')
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

    # Serve React frontend (built files) for any route not matched by API
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        if path != '' and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')

    return app
