import pytest
from app import create_app, db as _db
from config import Config


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_ENGINE_OPTIONS = {}
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
    """Create a fresh database for each test.

    drop_all() before create_all() clears any data seeded by create_app()
    (branches, admin user, sample inventory), so even the first test in a
    process starts with a truly empty database."""
    with app.app_context():
        _db.drop_all()
        _db.create_all()
        yield _db
        _db.session.rollback()
        _db.drop_all()


@pytest.fixture(scope='function')
def client(app, db):
    """Create a test client with a fresh database."""
    return app.test_client()


# ── Shared API setup helpers (used by e2e test files) ───────────────────

def create_branch_via_api(client, headers, name='Shire', location='Shire'):
    """Create a branch through the API and return its id."""
    resp = client.post('/api/branches', headers=headers,
                       json={'name': name, 'location': location})
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()['id']


def create_vehicle_via_api(client, headers, branch_id, vin, model,
                           selling_price, cost_price=0):
    """Create an available vehicle through the API and return its id."""
    resp = client.post('/api/inventory/vehicles', headers=headers, data={
        'vin': vin, 'type': '4-wheel', 'power_type': 'non-electric',
        'model': model, 'branch_id': str(branch_id),
        'cost_price': str(cost_price), 'selling_price': str(selling_price),
    }, content_type='multipart/form-data')
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()['id']


def create_spare_part_via_api(client, headers, branch_id, name, unit_price,
                              quantity, cost_price=0):
    """Create a spare part through the API and return its id."""
    resp = client.post('/api/inventory/spare-parts', headers=headers, data={
        'name': name, 'category': 'Filters', 'branch_id': str(branch_id),
        'unit_price': str(unit_price), 'cost_price': str(cost_price),
        'quantity': str(quantity),
    }, content_type='multipart/form-data')
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()['id']


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
