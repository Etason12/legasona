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
    data = resp.get_json()
    assert 'items' in data
    assert 'total' in data


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


# ── Security Headers ──────────────────────────────────────────────────

def test_security_headers(client):
    """Test that security headers are present on responses."""
    resp = client.get('/api/health')
    assert resp.headers.get('X-Content-Type-Options') == 'nosniff'
    assert resp.headers.get('X-Frame-Options') == 'DENY'
    assert resp.headers.get('X-XSS-Protection') == '1; mode=block'
    assert resp.headers.get('Referrer-Policy') == 'strict-origin-when-cross-origin'
    assert 'Content-Security-Policy' in resp.headers


# ── Request Size Limits ───────────────────────────────────────────────

def test_request_too_large(client):
    """Test that oversized requests are rejected."""
    resp = client.post('/api/auth/login',
                       data='x' * (11 * 1024 * 1024),  # 11MB
                       content_type='application/json')
    assert resp.status_code == 413


# ── Branches Pagination ──────────────────────────────────────────────

def test_branches_pagination(client, auth_headers, db):
    """Test branches endpoint supports pagination."""
    from app.models import Branch
    for i in range(5):
        db.session.add(Branch(name=f'Branch {i}', location=f'City {i}'))
    db.session.commit()

    resp = client.get('/api/branches?page=1&per_page=3', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'items' in data
    assert 'total' in data
    assert 'pages' in data
    assert data['total'] == 5
    assert len(data['items']) == 3


# ── Input Sanitization ────────────────────────────────────────────────

def test_sanitize_string():
    """Test that sanitize_string strips HTML and enforces length."""
    from app.utils.sanitization import sanitize_string
    # bleach strips tags but keeps inner text content
    assert '<script>' not in sanitize_string('<script>alert(1)</script>hello')
    assert sanitize_string('  <b>bold</b>  ') == 'bold'
    assert sanitize_string('a' * 600, max_length=500) == 'a' * 500
    assert sanitize_string(123) == 123


def test_sanitize_search():
    """Test that sanitize_search escapes LIKE wildcards."""
    from app.utils.sanitization import sanitize_search
    assert sanitize_search('test%') == 'test\\%'
    assert sanitize_search('test_') == 'test\\_'
    assert sanitize_search('test\\') == 'test\\\\'


# ── Rate Limiting ─────────────────────────────────────────────────────

def test_rate_limit_utility():
    """Test the rate limiter tracks attempts correctly."""
    from app.utils.rate_limit import is_rate_limited, record_attempt
    key = 'test_rate_limit_key'
    # Should not be limited initially
    assert not is_rate_limited(key, 3, 60)
    record_attempt(key)
    record_attempt(key)
    assert not is_rate_limited(key, 3, 60)
    record_attempt(key)
    assert is_rate_limited(key, 3, 60)


# ── Cache Utility ─────────────────────────────────────────────────────

def test_cache_utility():
    """Test the cache decorator works correctly."""
    from app.utils.cache import cached, invalidate_cache
    call_count = 0

    @cached(ttl_seconds=60)
    def expensive_func(x):
        nonlocal call_count
        call_count += 1
        return x * 2

    result1 = expensive_func(5)
    assert result1 == 10
    assert call_count == 1

    # Should return cached result
    result2 = expensive_func(5)
    assert result2 == 10
    assert call_count == 1

    # Different arg should call function
    result3 = expensive_func(10)
    assert result3 == 20
    assert call_count == 2

    # Invalidate and call again
    invalidate_cache()
    result4 = expensive_func(5)
    assert result4 == 10
    assert call_count == 3


# ── Global Error Handling ─────────────────────────────────────────────

def test_health_check_returns_json(client):
    """Test that API endpoints return JSON (not HTML error pages)."""
    resp = client.get('/api/health')
    assert resp.status_code == 200
    assert resp.content_type.startswith('application/json')


# ── Backup Privacy ────────────────────────────────────────────────────

def test_backup_excludes_password_hashes(client, auth_headers, db):
    """Test that backup export does not include password hashes."""
    from app.models import User
    user = User(username='testuser', role='cashier', status='active')
    user.set_password('password123')
    db.session.add(user)
    db.session.commit()

    resp = client.get('/api/backup/export', headers=auth_headers)
    assert resp.status_code == 200
    import json
    backup = json.loads(resp.data)
    for u in backup['tables']['users']:
        assert 'password_hash' not in u
