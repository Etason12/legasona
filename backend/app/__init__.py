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

    # Serve React frontend (built files) for any route not matched by API
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        if path != '' and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')

    return app
