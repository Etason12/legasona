"""Edge-case tests for phone-user payloads in vehicle and spare part sales.

These cover real-world inputs that caused 500 errors on the deployed app:
- Empty amount strings from React state defaulting to ''
- Comma-formatted amounts from phone keyboards (e.g., '2,500,000')
- Multipart (receipt) payloads with empty amounts
"""
import json


def _create_vehicle(client, auth_headers, db):
    from app.models import Branch, Vehicle
    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()
    vehicle = Vehicle(vin='VIN-EDGE-001', type='4-wheel', model='Toyota',
                      branch_id=branch.id, status='available',
                      selling_price=2500000, cost_price=1800000)
    db.session.add(vehicle)
    db.session.commit()
    return vehicle


# ── Vehicle Sale Edge Cases ─────────────────────────────────────────

def test_vehicle_sale_empty_payment_amount_creates_pending(client, auth_headers, db):
    """Empty amount string from frontend state → creates a pending sale, no 500."""
    vehicle = _create_vehicle(client, auth_headers, db)
    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle.id,
        'customer_name': 'Test User',
        'customer_phone': '+251911000999',
        'payments': [{'method': 'cash', 'amount': ''}],
    })
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.get_json()}"
    assert resp.get_json()['status'] == 'pending'  # 0 paid < 2500000 → pending


def test_vehicle_sale_comma_amount(client, auth_headers, db):
    """Comma-formatted amount from phone keyboard ('2,500,000') → should succeed."""
    vehicle = _create_vehicle(client, auth_headers, db)
    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle.id,
        'customer_name': 'Test User',
        'customer_phone': '+251911000998',
        'payments': [{'method': 'cash', 'amount': '2,500,000'}],
    })
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.get_json()}"
    assert resp.get_json()['status'] == 'completed'


def test_vehicle_sale_no_payments(client, auth_headers, db):
    """Empty payments array → should create pending sale."""
    vehicle = _create_vehicle(client, auth_headers, db)
    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle.id,
        'customer_name': 'Test User',
        'customer_phone': '+251911000997',
        'payments': [],
    })
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.get_json()}"
    assert resp.get_json()['status'] == 'pending'


def test_vehicle_sale_whitespace_amount(client, auth_headers, db):
    """Amount with whitespace (' 2500000 ') → should succeed."""
    vehicle = _create_vehicle(client, auth_headers, db)
    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle.id,
        'customer_name': 'Test User',
        'customer_phone': '+251911000996',
        'payments': [{'method': 'cash', 'amount': ' 2500000 '}],
    })
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.get_json()}"
    assert resp.get_json()['status'] == 'completed'


def test_vehicle_sale_multipart_no_amount_creates_pending(client, auth_headers, db):
    """Multipart (receipt) path with empty amount → creates pending sale, no 500."""
    from io import BytesIO
    vehicle = _create_vehicle(client, auth_headers, db)
    data = {
        'vehicle_id': str(vehicle.id),
        'customer_name': 'Test User',
        'customer_phone': '+251911000993',
        'motor_number': '',
        'total_amount': str(vehicle.selling_price),
        'remark': '',
        'payments': json.dumps([{'method': 'cash', 'amount': ''}]),
    }
    receipt = (BytesIO(b'fake image data'), 'receipt.jpg', 'image/jpeg')
    resp = client.post('/api/sales/vehicle', headers=auth_headers,
                       data={**data, 'receipt_0': receipt},
                       content_type='multipart/form-data')
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.get_json()}"
    assert resp.get_json()['status'] == 'pending'


def test_vehicle_sale_multipart_comma_amount(client, auth_headers, db):
    """Multipart path with comma-formatted amount → should succeed."""
    from io import BytesIO
    vehicle = _create_vehicle(client, auth_headers, db)
    data = {
        'vehicle_id': str(vehicle.id),
        'customer_name': 'Test User',
        'customer_phone': '+251911000992',
        'motor_number': '',
        'total_amount': str(vehicle.selling_price),
        'remark': '',
        'payments': json.dumps([{'method': 'cash', 'amount': '2,500,000'}]),
    }
    receipt = (BytesIO(b'fake image data'), 'receipt.jpg', 'image/jpeg')
    resp = client.post('/api/sales/vehicle', headers=auth_headers,
                       data={**data, 'receipt_0': receipt},
                       content_type='multipart/form-data')
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.get_json()}"
    assert resp.get_json()['status'] == 'completed'


def test_vehicle_sale_mixed_payment_methods(client, auth_headers, db):
    """Cash + bank payment with comma amounts → should succeed."""
    vehicle = _create_vehicle(client, auth_headers, db)
    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle.id,
        'customer_name': 'Test User',
        'customer_phone': '+251911000991',
        'payments': [
            {'method': 'cash', 'amount': '1,000,000'},
            {'method': 'bank', 'amount': '1,500,000',
             'bank': 'CBE', 'accountHolder': 'Test', 'reference': 'TXN-001'},
        ],
    })
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.get_json()}"
    assert resp.get_json()['status'] == 'completed'


# ── Spare Part Sale Edge Cases ──────────────────────────────────────

def _create_spare_part(client, auth_headers, db):
    from app.models import Branch, SparePart
    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()
    part = SparePart(part_number='EDGE-001', name='Test Filter', branch_id=branch.id,
                     quantity=10, unit_price=500, cost_price=200, category='Filters')
    db.session.add(part)
    db.session.commit()
    return part


def test_spare_part_sale_comma_amount(client, auth_headers, db):
    """Spare part sale with comma-formatted amount → should succeed."""
    part = _create_spare_part(client, auth_headers, db)
    resp = client.post('/api/sales/spare-part', headers=auth_headers, json={
        'part_id': part.id,
        'quantity': 2,
        'total_amount': '1,000',
        'customer_name': 'Test User',
        'customer_phone': '+251911000990',
        'payments': [{'method': 'cash', 'amount': '1,000'}],
    })
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.get_json()}"


def test_spare_part_sale_empty_amount_returns_400(client, auth_headers, db):
    """Spare part sale with empty total_amount → should 400, not 500 or 201."""
    part = _create_spare_part(client, auth_headers, db)
    resp = client.post('/api/sales/spare-part', headers=auth_headers, json={
        'part_id': part.id,
        'quantity': 2,
        'total_amount': '',
        'customer_name': 'Test User',
        'customer_phone': '+251911000989',
        'payments': [{'method': 'cash', 'amount': ''}],
    })
    assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.get_json()}"


# ── Postgres column-capacity hardening ─────────────────────────────
# These would raise a DataError (500) on Postgres (which enforces VARCHAR
# lengths and Numeric(12,2) ranges) but not SQLite, so they are covered here.

def test_vehicle_sale_long_phone_and_name(client, auth_headers, db):
    """Over-long customer_phone/name/motor_number must truncate, not 500."""
    vehicle = _create_vehicle(client, auth_headers, db)
    long_phone = '+2519' + '1' * 40  # > String(20)
    long_name = 'X' * 300            # > String(100)
    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle.id,
        'customer_name': long_name,
        'customer_phone': long_phone,
        'motor_number': 'M' * 200,  # > String(50)
        'payments': [{'method': 'cash', 'amount': ''}],
    })
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.get_json()}"

    from app.models import Sale
    sale = Sale.query.filter_by(sale_type='vehicle').order_by(Sale.id.desc()).first()
    assert sale is not None
    assert len(sale.customer_name) == 100, "customer_name should be truncated to 100"
    assert len(sale.customer_phone) == 20
    assert len(sale.motor_number) == 50


def test_vehicle_sale_sale_number_fits_varchar20(client, auth_headers, db):
    """The generated sale_number must fit VARCHAR(20) on the production Postgres."""
    vehicle = _create_vehicle(client, auth_headers, db)
    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle.id, 'customer_name': 'Test User', 'customer_phone': '+251911000995',
        'payments': [{'method': 'cash', 'amount': '1620000'}],
    })
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.get_json()}"
    from app.models import Sale
    sale = Sale.query.filter_by(sale_type='vehicle').order_by(Sale.id.desc()).first()
    assert sale is not None and len(sale.sale_number) <= 20, \
        f"sale_number {sale.sale_number!r} is {len(sale.sale_number)} chars (must be <= 20)"


def test_vehicle_sale_edit_completed_only(client, auth_headers, db):
    """Admins may only edit completed sales; pending/cancelled are rejected."""
    from app.models import Sale
    vehicle = _create_vehicle(client, auth_headers, db)

    pending = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle.id, 'customer_name': 'Test', 'customer_phone': '+251911000994',
        'payments': [],
    })
    assert pending.status_code == 201
    pid = pending.get_json()['sale_id']
    resp = client.patch(f'/api/sales/{pid}', headers=auth_headers, json={'remark': 'nope'})
    assert resp.status_code == 400, resp.get_json()

    completed = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle.id, 'customer_name': 'Test', 'customer_phone': '+251911000993',
        'payments': [{'method': 'cash', 'amount': '2500000'}],
    })
    assert completed.status_code == 201 and completed.get_json()['status'] == 'completed'
    cid = completed.get_json()['sale_id']
    resp = client.patch(f'/api/sales/{cid}', headers=auth_headers, json={'remark': 'ok'})
    assert resp.status_code == 200, resp.get_json()
    assert db.session.get(Sale, cid).remark == 'ok'


def test_vehicle_sale_payments_null(client, auth_headers, db):
    """payments=null must be treated as empty list, not crash with a 500."""
    vehicle = _create_vehicle(client, auth_headers, db)
    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle.id, 'customer_name': 'Test', 'customer_phone': '+251911000998',
        'payments': None,
    })
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.get_json()}"
    assert resp.get_json()['status'] == 'pending'


def test_vehicle_sale_amount_overflow_returns_400(client, auth_headers, db):
    """An amount exceeding Numeric(12,2) must return 400, not 500."""
    vehicle = _create_vehicle(client, auth_headers, db)
    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle.id, 'customer_name': 'Test', 'customer_phone': '+251911000997',
        'payments': [{'method': 'cash', 'amount': '999999999999999'}],
    })
    assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.get_json()}"
    assert 'too large' in resp.get_json()['message']
