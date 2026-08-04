import os
import logging
from flask import Flask, send_from_directory, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config

logger = logging.getLogger(__name__)

# Extensions
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

def _migrate_columns(database):
    """Add columns that may be missing from existing tables."""
    from sqlalchemy import text, inspect
    from app.models import Sale, Order
    engine = database.engine
    insp = inspect(engine)

    TABLE_MODELS = {'sales': Sale, 'orders': Order}

    for table_name, model in TABLE_MODELS.items():
        try:
            existing_cols = {c['name'] for c in insp.get_columns(table_name)}
            model_cols = {c.name for c in model.__table__.columns}
            missing = model_cols - existing_cols
            for col_name in sorted(missing):
                col = model.__table__.columns[col_name]
                pg_type = 'TEXT' if col.type.__class__.__name__ in ('Text',) else \
                          'INTEGER' if col.type.__class__.__name__ in ('Integer',) else \
                          'NUMERIC(12,2)' if col.type.__class__.__name__ in ('Numeric',) else \
                          'BOOLEAN' if col.type.__class__.__name__ in ('Boolean',) else \
                          'TIMESTAMP' if col.type.__class__.__name__ in ('DateTime',) else \
                          'VARCHAR(200)' if hasattr(col.type, 'length') else 'TEXT'
                default_sql = ''
                if col.default is not None and hasattr(col.default, 'arg'):
                    default_val = col.default.arg
                    if isinstance(default_val, bool):
                        default_sql = f" DEFAULT {str(default_val).upper()}"
                    elif isinstance(default_val, (int, float)):
                        default_sql = f" DEFAULT {default_val}"
                stmt = f'ALTER TABLE {table_name} ADD COLUMN {col_name} {pg_type}{default_sql}'
                try:
                    with engine.connect() as conn:
                        conn.execute(text(stmt))
                        conn.commit()
                    logger.info(f"Migration applied: {stmt}")
                except Exception as e:
                    logger.warning(f"Migration skip: {col_name} on {table_name} — {e}")
        except Exception as e:
            logger.warning(f"Migration: could not inspect {table_name} — {e}")

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

    allowed_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}})

    # ── Security Headers ──────────────────────────────────────────────
    @app.after_request
    def set_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        if not app.config.get('DEBUG'):
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response.headers['Content-Security-Policy'] = "default-src 'self'"
        return response

    # ── Global Error Handlers ─────────────────────────────────────────
    @app.errorhandler(Exception)
    def handle_exception(e):
        logger.error(f"Unhandled exception: {e}", exc_info=True)
        return jsonify({'message': 'Internal server error'}), 500

    @app.errorhandler(413)
    def handle_request_too_large(e):
        return jsonify({'message': 'Request too large. Maximum size is 10MB.'}), 413

    @app.errorhandler(404)
    def handle_not_found(e):
        return jsonify({'message': 'Not found'}), 404

    # Register blueprints (backend API routes)
    from app.routes.health import health_bp
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
    from app.routes.backup import backup_bp
    from app.routes.notifications import notifications_bp

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
    app.register_blueprint(backup_bp, url_prefix='/api')
    app.register_blueprint(notifications_bp, url_prefix='/api')

    # Ensure tables exist (safe, idempotent)
    with app.app_context():
        db.create_all()

        # ── Auto-migrate: add columns that may be missing ──────────
        _migrate_columns(db)

    # Register CLI commands for seeding
    @app.cli.command('seed')
    def seed_command():
        """Seed the database with initial branches, admin user, and sample data."""
        from app.models import User, Branch, Vehicle, SparePart
        _seed_database()

    def _seed_database():
        with app.app_context():
            from app.models import User, Branch, Vehicle, SparePart

            if not Branch.query.filter_by(name='Shire').first():
                shire = Branch(name='Shire', location='Shire, Tigray')
                mekelle = Branch(name='Mekelle', location='Mekelle, Tigray')
                db.session.add_all([shire, mekelle])
                db.session.flush()
            else:
                shire = Branch.query.filter_by(name='Shire').first()
                mekelle = Branch.query.filter_by(name='Mekelle').first()

            admin = User.query.filter_by(username='admin').first()
            if not admin:
                admin = User(username='admin', role='admin')
                admin.set_password(os.environ.get('ADMIN_DEFAULT_PASSWORD', 'admin123'))
                db.session.add(admin)

            if not Vehicle.query.first():
                vehicles = [
                    Vehicle(vin='HILUX-4WD-001', type='4-wheel', model='Toyota Hilux 4x4 2025', chassis_number='HILUX-4WD-001', engine_number='1KD-FTV-88421', branch_id=shire.id, status='available', selling_price=4500000, cost_price=3200000, color='White', power_type='non-electric'),
                    Vehicle(vin='FOTON-EV-3W-003', type='3-wheel', model='Foton Electric Tricycle', chassis_number='FOTON-EV-3W-003', engine_number='MOT-EV-33210', branch_id=mekelle.id, status='available', selling_price=1200000, cost_price=800000, color='Blue', power_type='electric'),
                ]
                db.session.add_all(vehicles)

            if not SparePart.query.first():
                parts = [
                    SparePart(part_number='OIL-FILT-001', name='Engine Oil Filter', quantity=45, branch_id=shire.id, unit_price=1200, cost_price=450, category='Filters'),
                    SparePart(part_number='BRK-PAD-002', name='Brake Pad Set (Front)', quantity=12, branch_id=mekelle.id, unit_price=4500, cost_price=1800, category='Brakes'),
                ]
                db.session.add_all(parts)

            db.session.commit()
            logger.info('Database seeded successfully.')

    # Serve React frontend (built files) for any route not matched by API
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        if path != '' and os.path.exists(os.path.join(app.static_folder or '', path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder or '', 'index.html')

    return app
