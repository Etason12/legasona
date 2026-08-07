import json


# ── Record Vehicle Sale ─────────────────────────────────────────────
def test_record_vehicle_sale(client, auth_headers, db):
    """Recording a vehicle sale should succeed with the generated sale number."""
    from app.models import Branch, Vehicle, Sale, Payment

    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()

    vehicle = Vehicle(vin='VIN-SALE-001', type='4-wheel', model='Toyota Hilux',
                      branch_id=branch.id, status='available',
                      selling_price=2500000, cost_price=1800000)
    db.session.add(vehicle)
    db.session.commit()

    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle.id,
        'customer_name': 'John Doe',
        'customer_phone': '+251911000050',
        'payments': [{'method': 'cash', 'amount': 2500000}],
    })
    assert resp.status_code == 201, resp.get_json()
    data = resp.get_json()
    assert data['status'] == 'completed'
    assert data['sale_number'].startswith('VS-')

    sale = Sale.query.filter_by(sale_number=data['sale_number']).first()
    assert sale is not None
    assert len(sale.sale_number) > 20  # regression: 22-char numbers must be storable
    assert sale.sale_type == 'vehicle'
    assert sale.item_id == vehicle.id
    assert sale.status == 'completed'
    assert float(sale.total_amount) == 2500000
    assert db.session.get(Vehicle, vehicle.id).status == 'sold'

    payment = Payment.query.filter_by(sale_id=sale.id).first()
    assert payment is not None
    assert float(payment.amount) == 2500000


def test_record_vehicle_sale_partial_payment(client, auth_headers, db):
    """Partial payment should create a pending sale and reserve the vehicle."""
    from app.models import Branch, Vehicle, Sale

    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()

    vehicle = Vehicle(vin='VIN-SALE-002', type='3-wheel', model='Foton',
                      branch_id=branch.id, status='available',
                      selling_price=1200000, cost_price=800000)
    db.session.add(vehicle)
    db.session.commit()

    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle.id,
        'customer_name': 'Jane Smith',
        'customer_phone': '+251911000051',
        'payments': [{'method': 'cash', 'amount': 400000}],
    })
    assert resp.status_code == 201, resp.get_json()
    data = resp.get_json()
    assert data['status'] == 'pending'

    sale = Sale.query.filter_by(sale_number=data['sale_number']).first()
    assert sale.status == 'pending'
    assert db.session.get(Vehicle, vehicle.id).status == 'reserved'


# ── Record Spare Part Sale ──────────────────────────────────────────
def test_record_spare_part_sale(client, auth_headers, db):
    """Recording a spare part sale should succeed and decrement stock."""
    from app.models import Branch, SparePart, Sale

    branch = Branch(name='Shire', location='Shire')
    db.session.add(branch)
    db.session.flush()

    part = SparePart(part_number='OIL-001', name='Oil Filter', branch_id=branch.id,
                     quantity=10, unit_price=500, cost_price=200, category='Filters')
    db.session.add(part)
    db.session.commit()

    resp = client.post('/api/sales/spare-part', headers=auth_headers, json={
        'part_id': part.id,
        'quantity': 2,
        'total_amount': 1000,
        'customer_name': 'John Doe',
        'customer_phone': '+251911000052',
        'payments': [{'method': 'cash', 'amount': 1000}],
    })
    assert resp.status_code == 201, resp.get_json()
    data = resp.get_json()
    assert data['sale_number'].startswith('SP-')

    sale = Sale.query.filter_by(sale_number=data['sale_number']).first()
    assert sale is not None
    assert len(sale.sale_number) > 20  # regression: 22-char numbers must be storable
    assert sale.sale_type == 'spare_part'
    assert sale.quantity == 2
    assert float(sale.total_amount) == 1000
    assert db.session.get(SparePart, part.id).quantity == 8


# ── Sale Number Length ──────────────────────────────────────────────
def test_generated_sale_number_fits_column(db):
    """Generated sale numbers must fit within the 40-char column."""
    from app.routes.sales import _generate_sale_number
    from app.models import Sale

    col_len = Sale.__table__.columns['sale_number'].type.length
    assert col_len is not None
    for _ in range(50):
        assert len(_generate_sale_number('VS')) <= col_len
        assert len(_generate_sale_number('SP')) <= col_len
