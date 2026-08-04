def test_health_check(client):
    """Test the health endpoint."""
    resp = client.get('/api/health')
    assert resp.status_code == 200
    assert resp.get_json()['status'] == 'ok'


def test_login_success(client, db):
    """Test successful login."""
    from app.models import User
    admin = User(username='admin', role='admin', status='active')
    admin.set_password('admin123')
    db.session.add(admin)
    db.session.commit()

    resp = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'admin123'
    })
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'token' in data
    assert data['user']['username'] == 'admin'


def test_login_invalid_credentials(client, db):
    """Test login with wrong password."""
    from app.models import User
    admin = User(username='admin', role='admin', status='active')
    admin.set_password('admin123')
    db.session.add(admin)
    db.session.commit()

    resp = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'wrongpassword'
    })
    assert resp.status_code == 401


def test_login_inactive_user(client, db):
    """Test that inactive users cannot login."""
    from app.models import User
    user = User(username='inactive_user', role='cashier', status='inactive')
    user.set_password('pass1234')
    db.session.add(user)
    db.session.commit()

    resp = client.post('/api/auth/login', json={
        'username': 'inactive_user',
        'password': 'pass1234'
    })
    assert resp.status_code == 401


def test_get_branches(client, auth_headers):
    """Test getting branches list."""
    resp = client.get('/api/branches', headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.get_json(), list)


def test_create_branch(client, auth_headers, db):
    """Test creating a branch."""
    resp = client.post('/api/branches', headers=auth_headers, json={
        'name': 'Test Branch',
        'location': 'Test City'
    })
    assert resp.status_code == 201
    from app.models import Branch
    assert Branch.query.filter_by(name='Test Branch').first() is not None


def test_create_vehicle(client, auth_headers, db):
    """Test creating a vehicle."""
    from app.models import Branch
    branch = Branch(name='Main', location='City')
    db.session.add(branch)
    db.session.flush()

    resp = client.post('/api/inventory/vehicles', headers=auth_headers, data={
        'vin': 'TEST-VIN-001',
        'type': '4-wheel',
        'power_type': 'non-electric',
        'model': 'Test Vehicle',
        'color': 'Red',
        'cost_price': '1000000',
        'selling_price': '1500000',
        'branch_id': str(branch.id),
    })
    assert resp.status_code == 201


def test_get_vehicles(client, auth_headers, db):
    """Test getting vehicles list."""
    resp = client.get('/api/inventory/vehicles', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'items' in data
    assert 'total' in data


def test_create_customer(client, auth_headers, db):
    """Test creating a customer."""
    resp = client.post('/api/customers', headers=auth_headers, json={
        'full_name': 'John Doe',
        'phone': '+251911000001',
    })
    assert resp.status_code == 201


def test_get_customers(client, auth_headers, db):
    """Test getting customers list."""
    resp = client.get('/api/customers', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'items' in data


def test_get_dashboard(client, auth_headers):
    """Test getting dashboard stats."""
    resp = client.get('/api/reports/dashboard', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'stats' in data
    assert 'chart_data' in data


def test_admin_required(client, db):
    """Test that admin-only endpoints reject non-admin users."""
    from app.models import User
    user = User(username='cashier', role='cashier', status='active')
    user.set_password('pass1234')
    db.session.add(user)
    db.session.commit()

    resp = client.post('/api/auth/login', json={
        'username': 'cashier',
        'password': 'pass1234'
    })
    token = resp.get_json()['token']
    headers = {'Authorization': f'Bearer {token}'}

    resp = client.get('/api/users', headers=headers)
    assert resp.status_code == 403
