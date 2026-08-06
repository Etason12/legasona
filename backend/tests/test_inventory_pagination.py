def _add_vehicles(db, n):
    from app.models import Vehicle
    for i in range(n):
        db.session.add(Vehicle(
            vin=f'VIN{i:05d}', model=f'MODEL-{i}', type='3-wheel',
            power_type='electric', engine_number=f'ENG{i:05d}',
            cost_price=100, selling_price=200, status='available',
            image='data:image/jpeg;base64,AAAA'
        ))
    db.session.commit()


def test_vehicles_high_per_page(client, auth_headers, db):
    """per_page above the old 100 cap returns all vehicles."""
    _add_vehicles(db, 3)
    resp = client.get('/api/inventory/vehicles?per_page=10000', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['total'] >= 3
    vins = {i['vin'] for i in data['items']}
    assert {'VIN00000', 'VIN00001', 'VIN00002'} <= vins


def test_vehicles_pagination(client, auth_headers, db):
    """Server-side pagination returns correct pages/totals."""
    _add_vehicles(db, 5)
    resp = client.get('/api/inventory/vehicles?search=MODEL-&page=1&per_page=2', headers=auth_headers)
    data = resp.get_json()
    assert len(data['items']) == 2
    assert data['total'] == 5
    assert data['pages'] == 3
    assert data['current_page'] == 1

    resp2 = client.get('/api/inventory/vehicles?search=MODEL-&page=3&per_page=2', headers=auth_headers)
    assert len(resp2.get_json()['items']) == 1


def test_vehicles_search(client, auth_headers, db):
    """Search filters by model/VIN/engine number."""
    _add_vehicles(db, 3)
    resp = client.get('/api/inventory/vehicles?search=MODEL-2', headers=auth_headers)
    data = resp.get_json()
    assert data['total'] == 1
    assert data['items'][0]['model'] == 'MODEL-2'

    resp2 = client.get('/api/inventory/vehicles?search=vin00000', headers=auth_headers)
    assert resp2.get_json()['total'] == 1
    assert resp2.get_json()['items'][0]['vin'] == 'VIN00000'


def test_vehicles_no_image(client, auth_headers, db):
    """no_image=1 omits the (heavy) base64 image payload."""
    _add_vehicles(db, 1)
    light = client.get('/api/inventory/vehicles?search=MODEL-0&no_image=1', headers=auth_headers).get_json()
    assert light['items'][0]['image'] is None

    full = client.get('/api/inventory/vehicles?search=MODEL-0', headers=auth_headers).get_json()
    assert full['items'][0]['image'] is not None


def test_spare_parts_search(client, auth_headers, db):
    """Spare parts search filters by name/part_number."""
    from app.models import SparePart
    db.session.add(SparePart(name='Brake Pads', part_number='SP-000001', quantity=5, unit_price=100, branch_id=None))
    db.session.add(SparePart(name='Oil Filter', part_number='SP-000002', quantity=5, unit_price=100, branch_id=None))
    db.session.commit()

    resp = client.get('/api/inventory/spare-parts?search=brake', headers=auth_headers)
    data = resp.get_json()
    assert data['total'] == 1
    assert data['items'][0]['name'] == 'Brake Pads'

    light = client.get('/api/inventory/spare-parts?per_page=10000&no_image=1', headers=auth_headers).get_json()
    assert light['total'] >= 2
    names = {i['name'] for i in light['items']}
    assert {'Brake Pads', 'Oil Filter'} <= names
    assert all(i['image'] is None for i in light['items'])
