import pytest
from app import create_app, db as _db
from config import Config


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SECRET_KEY = 'test-secret-key'
    JWT_SECRET_KEY = 'test-jwt-secret-key'
    ADMIN_RESET_KEY = 'test-reset-key'


@pytest.fixture(scope='session')
def app():
    """Create application for testing."""
    app = create_app(TestConfig)
    return app


@pytest.fixture(scope='function')
def db(app):
    """Create a fresh database for each test."""
    with app.app_context():
        _db.create_all()
        yield _db
        _db.session.rollback()
        _db.drop_all()


@pytest.fixture(scope='function')
def client(app, db):
    """Create a test client with a fresh database."""
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    """Get auth headers for an admin user."""
    # Create admin user
    from app.models import User
    from app import db as _db
    with client.application.app_context():
        admin = User(username='testadmin', role='admin', status='active')
        admin.set_password('testpass123')
        _db.session.add(admin)
        _db.session.commit()
        user_id = admin.id

    # Login
    resp = client.post('/api/auth/login', json={
        'username': 'testadmin',
        'password': 'testpass123'
    })
    token = resp.get_json()['token']
    return {'Authorization': f'Bearer {token}'}
