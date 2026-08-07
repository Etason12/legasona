import io
import json
import pytest


# ── Order Fulfillment → Sale + Payment ───────────────────────────────

def test_fulfill_order_creates_sale_and_payment(client, auth_headers, db):
    """Fulfilling an order should create a Sale, Payment, and update Vehicle status."""
    from app.models import Branch, Vehicle, Order, Sale, Payment

    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()

    vehicle = Vehicle(vin='VIN-001', type='4-wheel', model='Toyota', branch_id=branch.id,
                      status='available', selling_price=2500000, cost_price=1800000)
    order = Order(customer_name='John', customer_phone='+251911000001', vehicle_specs='Toyota Hilux',
                  sequence_number=1, deposit_amount=500000, deposit_method='bank',
                  deposit_bank='CBE', deposit_account_holder='TEWELDE', deposit_transaction_reference='TX-123',
                  branch_id=branch.id, status='waiting')
    db.session.add_all([vehicle, order])
    db.session.commit()

    resp = client.post(f'/api/orders/{order.id}/fulfill', headers=auth_headers,
                       json={'vehicle_id': vehicle.id})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['status'] == 'pending'  # 500k deposit < 2.5M price
    assert 'sale_number' in data

    sale = Sale.query.filter_by(order_id=order.id).first()
    assert sale is not None
    assert sale.sale_type == 'vehicle'
    assert sale.item_id == vehicle.id
    assert sale.customer_name == 'John'
    assert sale.customer_phone == '+251911000001'
    assert float(sale.total_amount) == 2500000
    assert float(sale.cost_at_sale) == 1800000
    assert sale.chassis_number == 'VIN-001'
    assert sale.status == 'pending'
    assert sale.branch_id == branch.id

    payment = Payment.query.filter_by(sale_id=sale.id).first()
    assert payment is not None
    assert float(payment.amount) == 500000
    assert payment.payment_method == 'bank'
    assert payment.bank_name == 'CBE'
    assert payment.account_holder == 'TEWELDE'
    assert payment.transaction_reference == 'TX-123'

    updated_vehicle = db.session.get(Vehicle, vehicle.id)
    assert updated_vehicle.status == 'reserved'

    updated_order = db.session.get(Order, order.id)
    assert updated_order.status == 'fulfilled'
    assert updated_order.sale_id == sale.id


def test_fulfill_order_full_payment(client, auth_headers, db):
    """If deposit >= price, sale status should be 'completed' and vehicle 'sold'."""
    from app.models import Branch, Vehicle, Order, Sale

    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()

    vehicle = Vehicle(vin='VIN-002', type='3-wheel', model='Foton', branch_id=branch.id,
                      status='available', selling_price=1000000, cost_price=700000)
    order = Order(customer_name='Jane', customer_phone='+251911000002', vehicle_specs='Foton',
                  sequence_number=1, deposit_amount=1000000, deposit_method='cash',
                  branch_id=branch.id, status='waiting')
    db.session.add_all([vehicle, order])
    db.session.commit()

    resp = client.post(f'/api/orders/{order.id}/fulfill', headers=auth_headers,
                       json={'vehicle_id': vehicle.id})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['status'] == 'completed'

    sale = Sale.query.filter_by(order_id=order.id).first()
    assert sale.status == 'completed'
    assert db.session.get(Vehicle, vehicle.id).status == 'sold'


def test_fulfill_order_rejects_wrong_branch(client, auth_headers, db):
    """Cannot fulfill with a vehicle from a different branch."""
    from app.models import Branch, Vehicle, Order

    branch1 = Branch(name='Shire', location='Shire')
    branch2 = Branch(name='Mekelle', location='Mekelle')
    db.session.add_all([branch1, branch2])
    db.session.flush()

    vehicle = Vehicle(vin='VIN-003', type='4-wheel', model='Toyota', branch_id=branch2.id,
                      status='available', selling_price=2000000)
    order = Order(customer_name='Test', customer_phone='+251911000003',
                  sequence_number=1, deposit_amount=100000, branch_id=branch1.id, status='waiting')
    db.session.add_all([vehicle, order])
    db.session.commit()

    resp = client.post(f'/api/orders/{order.id}/fulfill', headers=auth_headers,
                       json={'vehicle_id': vehicle.id})
    assert resp.status_code == 400
    assert 'same branch' in resp.get_json()['message']


def test_fulfill_order_rejects_sold_vehicle(client, auth_headers, db):
    """Cannot fulfill with a vehicle that is already sold."""
    from app.models import Branch, Vehicle, Order

    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()

    vehicle = Vehicle(vin='VIN-004', type='4-wheel', model='Toyota', branch_id=branch.id,
                      status='sold', selling_price=2000000)
    order = Order(customer_name='Test', customer_phone='+251911000004',
                  sequence_number=1, deposit_amount=100000, branch_id=branch.id, status='waiting')
    db.session.add_all([vehicle, order])
    db.session.commit()

    resp = client.post(f'/api/orders/{order.id}/fulfill', headers=auth_headers,
                       json={'vehicle_id': vehicle.id})
    assert resp.status_code == 400
    assert 'not available' in resp.get_json()['message']


def test_fulfill_order_requires_vehicle_id(client, auth_headers, db):
    """Fulfilling without vehicle_id should return 400."""
    from app.models import Branch, Order

    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()

    order = Order(customer_name='Test', customer_phone='+251911000005',
                  sequence_number=1, deposit_amount=100000, branch_id=branch.id, status='waiting')
    db.session.add(order)
    db.session.commit()

    resp = client.post(f'/api/orders/{order.id}/fulfill', headers=auth_headers, json={})
    assert resp.status_code == 400
    assert 'Vehicle ID' in resp.get_json()['message']


# ── Available Vehicles Endpoint ──────────────────────────────────────

def test_available_vehicles(client, auth_headers, db):
    """GET /orders/available-vehicles returns available vehicles for a branch."""
    from app.models import Branch, Vehicle

    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()

    v1 = Vehicle(vin='VIN-A1', type='4-wheel', model='Toyota', branch_id=branch.id,
                 status='available', selling_price=2000000)
    v2 = Vehicle(vin='VIN-A2', type='3-wheel', model='Foton', branch_id=branch.id,
                 status='sold', selling_price=1000000)
    db.session.add_all([v1, v2])
    db.session.commit()

    resp = client.get(f'/api/orders/available-vehicles?branch_id={branch.id}', headers=auth_headers)
    assert resp.status_code == 200
    vehicles = resp.get_json()
    assert len(vehicles) == 1
    assert vehicles[0]['vin'] == 'VIN-A1'


# ── Deposit with Receipt ────────────────────────────────────────────

def test_deposit_with_receipt(client, auth_headers, db):
    """Deposit endpoint should accept multipart with receipt file."""
    from app.models import Branch, Order

    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()

    order = Order(customer_name='Test', customer_phone='+251911000006',
                  sequence_number=1, deposit_amount=0, branch_id=branch.id, status='waiting')
    db.session.add(order)
    db.session.commit()

    fake_image = (b'\xff\xd8\xff\xe0' + b'\x00' * 100 + b'\xff\xd9')
    resp = client.post(f'/api/orders/{order.id}/deposit', headers=auth_headers,
                       data={
                           'amount': '100000',
                           'method': 'bank',
                           'bank': 'CBE',
                           'account_holder': 'TEWELDE',
                           'reference': 'TX-REC-001',
                       },
                       content_type='multipart/form-data',
                       follow_redirects=True)
    assert resp.status_code == 200

    updated = db.session.get(Order, order.id)
    assert float(updated.deposit_amount) == 100000
    assert updated.deposit_method == 'bank'
    assert updated.deposit_bank == 'CBE'
    assert updated.deposit_account_holder == 'TEWELDE'
    assert updated.deposit_transaction_reference == 'TX-REC-001'


def test_deposit_json_without_receipt(client, auth_headers, db):
    """Deposit endpoint should still work with JSON (no receipt)."""
    from app.models import Branch, Order

    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()

    order = Order(customer_name='Test', customer_phone='+251911000007',
                  sequence_number=1, deposit_amount=0, branch_id=branch.id, status='waiting')
    db.session.add(order)
    db.session.commit()

    resp = client.post(f'/api/orders/{order.id}/deposit', headers=auth_headers,
                       json={'amount': 50000, 'method': 'cash'})
    assert resp.status_code == 200
    updated = db.session.get(Order, order.id)
    assert float(updated.deposit_amount) == 50000


# ── Backup Export/Import Cycle ──────────────────────────────────────

def test_backup_export_import_roundtrip(client, auth_headers, db):
    """Export → import should preserve all data without loss."""
    from app.models import Branch, User, Vehicle, SparePart, Customer, Sale, Payment, Order

    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()

    admin = User.query.filter_by(username='testadmin').first()

    customer = Customer(full_name='John Doe', phone='+251911000010', branch_id=branch.id)
    db.session.add(customer)
    db.session.flush()

    vehicle = Vehicle(vin='EXP-VIN-001', type='4-wheel', model='Toyota Hilux',
                      branch_id=branch.id, status='available', selling_price=2500000,
                      cost_price=1800000, color='White', power_type='non-electric')
    part = SparePart(part_number='OIL-001', name='Oil Filter', branch_id=branch.id,
                     quantity=10, unit_price=500, cost_price=200, category='Filters')
    db.session.add_all([vehicle, part])
    db.session.flush()

    order = Order(customer_name='Jane', customer_phone='+251911000011',
                  vehicle_specs='Foton Electric', sequence_number=1,
                  deposit_amount=200000, deposit_method='cash',
                  branch_id=branch.id, status='waiting')
    db.session.add(order)
    db.session.flush()

    sale = Sale(sale_number='VS-TEST-001', sale_type='vehicle', item_id=vehicle.id,
                customer_name='John Doe', customer_phone='+251911000010',
                total_amount=2500000, cost_at_sale=1800000, status='completed',
                branch_id=branch.id, user_id=admin.id, order_id=order.id)
    db.session.add(sale)
    db.session.flush()

    order.sale_id = sale.id

    payment = Payment(sale_id=sale.id, payment_method='bank', bank_name='CBE',
                      account_holder='TEWELDE', amount=2500000,
                      transaction_reference='TX-EXP-001')
    db.session.add(payment)
    db.session.commit()

    # Export
    resp = client.get('/api/backup/export', headers=auth_headers)
    assert resp.status_code == 200
    backup = json.loads(resp.data)
    tables = backup['tables']

    assert len(tables['branches']) == 1
    assert len(tables['vehicles']) == 1
    assert len(tables['spare_parts']) == 1
    assert len(tables['customers']) == 1
    assert len(tables['sales']) == 1
    assert len(tables['payments']) == 1
    assert len(tables['orders']) == 1

    exported_order = tables['orders'][0]
    assert exported_order['sale_id'] == sale.id
    assert exported_order['deposit_method'] == 'cash'
    assert exported_order['deposit_transaction_reference'] is None

    exported_sale = tables['sales'][0]
    assert exported_sale['order_id'] == order.id

    exported_payment = tables['payments'][0]
    assert exported_payment['bank_name'] == 'CBE'
    assert exported_payment['account_holder'] == 'TEWELDE'
    assert exported_payment['transaction_reference'] == 'TX-EXP-001'

    # Import (restore)
    resp = client.post('/api/backup/import', headers=auth_headers,
                       data={'file': (io.BytesIO(resp.data), 'backup.json')},
                       content_type='multipart/form-data')
    assert resp.status_code == 200

    # Verify data survived
    assert Branch.query.count() == 1
    assert Vehicle.query.count() == 1
    assert SparePart.query.count() == 1
    assert Customer.query.count() == 1
    assert Sale.query.count() == 1
    assert Payment.query.count() == 1
    assert Order.query.count() == 1

    restored_order = Order.query.first()
    assert restored_order.sale_id == sale.id
    assert restored_order.deposit_method == 'cash'

    restored_sale = Sale.query.first()
    assert restored_sale.order_id == order.id

    restored_payment = Payment.query.first()
    assert restored_payment.bank_name == 'CBE'
    assert restored_payment.transaction_reference == 'TX-EXP-001'


# ── GET Sales Returns order_id ──────────────────────────────────────

def test_get_sales_includes_order_id(client, auth_headers, db):
    """GET /sales should include order_id in the response."""
    from app.models import Branch, Vehicle, Sale, Payment, Order, User

    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()

    admin = User.query.filter_by(username='testadmin').first()

    vehicle = Vehicle(vin='VIN-S1', type='4-wheel', model='Toyota', branch_id=branch.id,
                      status='sold', selling_price=2000000)
    order = Order(customer_name='Test', customer_phone='+251911000012',
                  sequence_number=1, deposit_amount=200000, branch_id=branch.id,
                  status='fulfilled')
    db.session.add_all([vehicle, order])
    db.session.flush()

    sale = Sale(sale_number='VS-SALES-001', sale_type='vehicle', item_id=vehicle.id,
                customer_name='Test', customer_phone='+251911000012',
                total_amount=2000000, status='completed', branch_id=branch.id,
                user_id=admin.id, order_id=order.id)
    db.session.add(sale)
    db.session.commit()

    resp = client.get('/api/sales', headers=auth_headers)
    assert resp.status_code == 200
    items = resp.get_json()['items']
    assert len(items) >= 1
    sale_data = next(s for s in items if s['id'] == sale.id)
    assert sale_data['order_id'] == order.id


# ── GET Orders Returns New Fields ───────────────────────────────────

def test_get_orders_includes_new_fields(client, auth_headers, db):
    """GET /orders should include deposit_receipt_image and sale_id."""
    from app.models import Branch, Order

    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()

    order = Order(customer_name='Test', customer_phone='+251911000013',
                  sequence_number=1, deposit_amount=100000, branch_id=branch.id,
                  status='waiting', deposit_method='cash', sale_id=None)
    db.session.add(order)
    db.session.commit()

    resp = client.get('/api/orders', headers=auth_headers)
    assert resp.status_code == 200
    items = resp.get_json()['items']
    assert len(items) >= 1
    order_data = next(o for o in items if o['id'] == order.id)
    assert 'deposit_receipt_image' in order_data
    assert 'sale_id' in order_data
    assert order_data['sale_id'] is None
    assert order_data['deposit_method'] == 'cash'


# ── Cannot Double-Fulfill ───────────────────────────────────────────

def test_cannot_fulfill_non_waiting_order(client, auth_headers, db):
    """Cannot fulfill an order that is not in 'waiting' status."""
    from app.models import Branch, Order

    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()

    order = Order(customer_name='Test', customer_phone='+251911000014',
                  sequence_number=1, deposit_amount=100000, branch_id=branch.id,
                  status='fulfilled')
    db.session.add(order)
    db.session.commit()

    resp = client.post(f'/api/orders/{order.id}/fulfill', headers=auth_headers,
                       json={'vehicle_id': 1})
    assert resp.status_code == 400
    assert 'not in waiting' in resp.get_json()['message']# ── Order Not Found ────────────────────────────────────────────────
def test_fulfill_order_nonexistent_order_returns_404(client, auth_headers, db):
    """Fulfilling a nonexistent order should return 404, not 500."""
    resp = client.post('/api/orders/999999/fulfill', headers=auth_headers, json={'vehicle_id': 1})
    assert resp.status_code == 404


# ── Vehicle Not Found ───────────────────────────────────────────────
def test_fulfill_order_invalid_vehicle(client, auth_headers, db):
    """Fulfilling with a nonexistent vehicle should return 404."""
    from app.models import Branch, Order

    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()

    order = Order(customer_name='Test', customer_phone='+251911000015',
                  sequence_number=1, deposit_amount=100000, branch_id=branch.id,
                  status='waiting')
    db.session.add(order)
    db.session.commit()

    resp = client.post(f'/api/orders/{order.id}/fulfill', headers=auth_headers,
                       json={'vehicle_id': 99999})
    assert resp.status_code == 404
    assert 'not found' in resp.get_json()['message'].lower()
