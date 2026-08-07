"""
End-to-end sales lifecycle tests.

These drive the complete sales journey through the HTTP API exactly the way
the frontend does — no direct model manipulation for the flow under test:

    branch → inventory (vehicle / spare part) → record sale
    → payment history → add / update / delete payment
    → list / filter sales → cancel sale → hard delete

Each test uses a fresh in-memory database and an admin auth token.
"""
from tests.conftest import (create_branch_via_api, create_vehicle_via_api,
                            create_spare_part_via_api)


def _find_sale(client, headers, sale_id):
    resp = client.get('/api/sales', headers=headers)
    assert resp.status_code == 200, resp.get_json()
    items = resp.get_json()['items']
    return next((s for s in items if s['id'] == sale_id), None)


# ── Vehicle sale: record → partial → pay off → edit → cancel ─────────

def test_e2e_vehicle_sale_lifecycle(client, auth_headers, db):
    """Full vehicle sale journey through the API."""
    from app.models import Customer, Payment, Sale, Vehicle

    branch_id = create_branch_via_api(client, auth_headers)
    vehicle_id = create_vehicle_via_api(client, auth_headers, branch_id,
                                        'E2E-VIN-001', 'Toyota Hilux',
                                        selling_price=2500000, cost_price=1800000)

    # 1. Record sale with a partial cash payment → pending, vehicle reserved
    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle_id,
        'customer_name': 'John Doe',
        'customer_phone': '+251911100001',
        'payments': [{'method': 'cash', 'amount': 500000}],
    })
    assert resp.status_code == 201, resp.get_json()
    data = resp.get_json()
    sale_id = data['sale_id']
    sale_number = data['sale_number']
    assert data['status'] == 'pending'
    assert sale_number.startswith('VS-')

    # Customer is auto-created from the sale
    customer = Customer.query.filter_by(phone='+251911100001').first()
    assert customer is not None
    assert customer.full_name == 'John Doe'
    assert db.session.get(Vehicle, vehicle_id).status == 'reserved'

    # 2. Sale shows up in the list with correct amounts
    sale = _find_sale(client, auth_headers, sale_id)
    assert sale is not None
    assert sale['sale_number'] == sale_number
    assert sale['status'] == 'pending'
    assert sale['sale_type'] == 'vehicle'
    assert float(sale['total_amount']) == 2500000
    assert float(sale['amount_paid']) == 500000
    assert float(sale['balance']) == 2000000
    assert sale['vin'] == 'E2E-VIN-001'
    assert sale['customer_name'] == 'John Doe'
    assert sale['cashier_name'] == 'testadmin'

    # 3. Payment history shows the cash payment
    resp = client.get(f'/api/sales/{sale_id}/payments', headers=auth_headers)
    assert resp.status_code == 200
    payments = resp.get_json()
    assert len(payments) == 1
    assert payments[0]['method'] == 'cash'
    assert float(payments[0]['amount']) == 500000
    payment_id = payments[0]['id']

    # 4. Pay off the balance → completed, vehicle sold
    resp = client.post(f'/api/sales/{sale_id}/add-payment', headers=auth_headers,
                       data={'amount': '2000000', 'method': 'cash'},
                       content_type='multipart/form-data')
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()['status'] == 'completed'
    assert db.session.get(Vehicle, vehicle_id).status == 'sold'

    # 5. An admin may still add a payment to an already fully paid sale
    resp = client.post(f'/api/sales/{sale_id}/add-payment', headers=auth_headers,
                       data={'amount': '100', 'method': 'cash'},
                       content_type='multipart/form-data')
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()['status'] == 'completed'

    # 6. Lowering a payment drops the sale back to pending
    resp = client.put(f'/api/sales/{sale_id}/payments/{payment_id}',
                      headers=auth_headers,
                      json={'method': 'cash', 'amount': 300000})
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()['status'] == 'pending'
    assert db.session.get(Vehicle, vehicle_id).status == 'reserved'

    # 7. Restoring the payment completes the sale again
    resp = client.put(f'/api/sales/{sale_id}/payments/{payment_id}',
                      headers=auth_headers,
                      json={'method': 'cash', 'amount': 500000})
    assert resp.status_code == 200
    assert resp.get_json()['status'] == 'completed'
    assert db.session.get(Vehicle, vehicle_id).status == 'sold'

    # 8. Deleting a payment leaves the sale partially paid
    second_payment = next(p for p in db.session.get(Sale, sale_id).payments
                          if float(p.amount) == 2000000)
    resp = client.delete(f'/api/sales/{sale_id}/payments/{second_payment.id}',
                         headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()['status'] == 'pending'
    assert db.session.get(Vehicle, vehicle_id).status == 'reserved'

    # 9. Cancel the sale → vehicle back to available, payments removed
    resp = client.delete(f'/api/sales/{sale_id}', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    assert db.session.get(Sale, sale_id).status == 'cancelled'
    assert Payment.query.filter_by(sale_id=sale_id).count() == 0
    assert db.session.get(Vehicle, vehicle_id).status == 'available'

    # 10. Cancelled sale is searchable and filterable
    resp = client.get('/api/sales?status=cancelled', headers=auth_headers)
    assert resp.status_code == 200
    assert any(s['id'] == sale_id for s in resp.get_json()['items'])
    resp = client.get('/api/sales?search=John', headers=auth_headers)
    assert resp.status_code == 200
    assert any(s['id'] == sale_id for s in resp.get_json()['items'])

    # 11. Hard-delete removes the cancelled sale for good
    resp = client.delete(f'/api/sales/{sale_id}/hard-delete', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    assert db.session.get(Sale, sale_id) is None

    # 12. Missing resources return 404 instead of 500
    resp = client.get('/api/sales/999999/payments', headers=auth_headers)
    assert resp.status_code == 404
    resp = client.post('/api/sales/999999/add-payment', headers=auth_headers,
                       data={'amount': '1', 'method': 'cash'},
                       content_type='multipart/form-data')
    assert resp.status_code == 404


# ── Bank payments: validation + customer reuse ───────────────────────

def test_e2e_bank_payment_and_customer_reuse(client, auth_headers, db):
    """Bank payments enforce required fields, normalize data, reject
    duplicate references, and reuse the same customer for one phone."""
    from app.models import Customer

    branch_id = create_branch_via_api(client, auth_headers)
    vehicle_id = create_vehicle_via_api(client, auth_headers, branch_id,
                                        'E2E-VIN-002', 'Foton',
                                        selling_price=1200000, cost_price=800000)

    # 1. Bank payment missing required fields → 400
    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle_id,
        'customer_name': 'Jane Smith',
        'customer_phone': '+251911100002',
        'payments': [{'method': 'bank', 'amount': 1200000}],
    })
    assert resp.status_code == 400
    assert 'Bank name' in resp.get_json()['message']

    # 2. Valid bank payment → completed
    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle_id,
        'customer_name': 'Jane Smith',
        'customer_phone': '+251911100002',
        'payments': [{'method': 'bank', 'amount': 1200000,
                      'bank': 'cbe', 'accountHolder': 'tewelde',
                      'reference': 'tx-e2e-001'}],
    })
    assert resp.status_code == 201, resp.get_json()
    sale_id = resp.get_json()['sale_id']
    assert resp.get_json()['status'] == 'completed'

    # 3. Bank details are normalized to uppercase in history
    resp = client.get(f'/api/sales/{sale_id}/payments', headers=auth_headers)
    assert resp.status_code == 200
    payment = resp.get_json()[0]
    assert payment['bank'] == 'CBE'
    assert payment['account_holder'] == 'TEWELDE'
    assert payment['reference'] == 'TX-E2E-001'

    # 4. Duplicate transaction reference is rejected on a second sale
    other_vehicle = create_vehicle_via_api(client, auth_headers, branch_id,
                                           'E2E-VIN-003', 'Bajaj',
                                           selling_price=500000)
    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': other_vehicle,
        'customer_name': 'Jane Smith',
        'customer_phone': '+251911100002',
        'payments': [{'method': 'bank', 'amount': 500000,
                      'bank': 'CBE', 'accountHolder': 'TEWELDE',
                      'reference': 'tx-e2e-001'}],
    })
    assert resp.status_code == 400
    assert 'already exists' in resp.get_json()['message']

    # 5. Second sale with the same phone reuses the same customer record
    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': other_vehicle,
        'customer_name': 'Jane Smith',
        'customer_phone': '+251911100002',
        'payments': [{'method': 'cash', 'amount': 500000}],
    })
    assert resp.status_code == 201, resp.get_json()
    assert Customer.query.count() == 1


# ── Spare part sale: stock → partial → pay off → cancel ──────────────

def test_e2e_spare_part_sale_lifecycle(client, auth_headers, db):
    """Spare part sales decrement stock, enforce stock limits, and restore
    stock on cancel."""
    from app.models import Sale, SparePart

    branch_id = create_branch_via_api(client, auth_headers)
    part_id = create_spare_part_via_api(client, auth_headers, branch_id,
                                        'Oil Filter', unit_price=500, quantity=10,
                                        cost_price=200)

    # 1. Quantity beyond stock → 400
    resp = client.post('/api/sales/spare-part', headers=auth_headers, json={
        'part_id': part_id, 'quantity': 20, 'total_amount': 10000,
        'customer_name': 'Abel Tesfay', 'customer_phone': '+251911100003',
        'payments': [{'method': 'cash', 'amount': 10000}],
    })
    assert resp.status_code == 400
    assert 'stock' in resp.get_json()['message'].lower()

    # 2. Partial payment → pending, stock decremented
    resp = client.post('/api/sales/spare-part', headers=auth_headers, json={
        'part_id': part_id, 'quantity': 2, 'total_amount': 1000,
        'customer_name': 'Abel Tesfay', 'customer_phone': '+251911100003',
        'payments': [{'method': 'cash', 'amount': 300}],
    })
    assert resp.status_code == 201, resp.get_json()
    sale_number = resp.get_json()['sale_number']
    assert 'pending' in resp.get_json()['message']
    assert sale_number.startswith('SP-')
    assert db.session.get(SparePart, part_id).quantity == 8

    # 3. Pay off the balance → completed
    sale_id = Sale.query.filter_by(sale_number=sale_number).first().id
    resp = client.post(f'/api/sales/{sale_id}/add-payment', headers=auth_headers,
                       data={'amount': '700', 'method': 'cash'},
                       content_type='multipart/form-data')
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()['status'] == 'completed'

    # 4. Cancel → stock restored, sale cancelled
    resp = client.delete(f'/api/sales/{sale_id}', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    assert db.session.get(Sale, sale_id).status == 'cancelled'
    assert db.session.get(SparePart, part_id).quantity == 10
