import io
import openpyxl


def _make_xlsx(rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(['S.N.', 'Model', 'Vehicle Identification Number', 'Specification',
               'color', 'operation status', 'body classification', 'Propulsion Type', 'Selling Price'])
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _import(client, headers, buf):
    return client.post('/api/import-excel-vehicles', headers=headers,
                       data={'file': (buf, 'safi_to_be_168_imported_cleaned.xlsx')},
                       content_type='multipart/form-data')


def test_import_excel_vehicles(client, auth_headers, db):
    """Import vehicles from an uploaded Excel using the new column format."""
    from app.models import Branch, Vehicle

    db.session.add(Branch(name='Mekelle', location='Mekelle'))
    db.session.commit()

    buf = _make_xlsx([
        (1, 'S2 SF4000DZK-A', 'LZSMJLZ08TF300050', 'EI26500096', 'Blue', 'Available', '3-WHEEL', 'ELECTRIC', 1620000),
        (2, 'S2 SF4000DZK-A', 'LZSMJLZ0XTF300051', 'EI26500108', 'Blue', 'Available', '3-WHEEL', 'ELECTRIC', 1620000),
        (3, 'S2 SF4000DZK-A', 'LZSMJLZ01TF300052', 'EI26500106', 'Blue', 'Available', '3-WHEEL', 'ELECTRIC', 1620000),
    ])

    resp = _import(client, auth_headers, buf)
    assert resp.status_code == 200, resp.get_json()
    assert 'Imported 3 vehicles' in resp.get_json()['message']

    assert Vehicle.query.count() >= 3
    v = Vehicle.query.filter_by(vin='LZSMJLZ08TF300050').first()
    assert v is not None
    assert v.model == 'S2 SF4000DZK-A'
    assert v.engine_number == 'EI26500096'
    assert v.color == 'Blue'
    assert v.status == 'available'
    assert v.type == '3-wheel'
    assert v.power_type == 'electric'
    assert v.chassis_number == v.vin
    assert float(v.selling_price) == 1620000
    assert float(v.cost_price) == 1134000.0  # 70% of selling price


def test_import_excel_vehicles_skips_duplicates(client, auth_headers, db):
    """Re-running the import skips VINs that already exist."""
    from app.models import Branch, Vehicle

    db.session.add(Branch(name='Mekelle', location='Mekelle'))
    db.session.commit()

    rows = [
        (1, 'S2 SF4000DZK-A', 'LZSMJLZ08TF300050', 'EI26500096', 'Blue', 'Available', '3-WHEEL', 'ELECTRIC', 1620000),
        (2, 'S2 SF4000DZK-A', 'LZSMJLZ0XTF300051', 'EI26500108', 'Blue', 'Available', '3-WHEEL', 'ELECTRIC', 1620000),
    ]
    # Fresh buffer per request (werkzeug closes the uploaded stream)
    assert _import(client, auth_headers, _make_xlsx(rows)).status_code == 200
    resp = _import(client, auth_headers, _make_xlsx(rows))
    assert resp.status_code == 200
    assert resp.get_json()['message'] == 'Imported 0 vehicles, skipped 2'
    assert Vehicle.query.filter_by(vin='LZSMJLZ08TF300050').count() == 1
    assert Vehicle.query.filter_by(vin='LZSMJLZ0XTF300051').count() == 1


def test_import_excel_vehicles_duplicate_vin_in_file(client, auth_headers, db):
    """Duplicate VINs within the same file are imported only once."""
    from app.models import Branch, Vehicle

    db.session.add(Branch(name='Mekelle', location='Mekelle'))
    db.session.commit()

    buf = _make_xlsx([
        (1, 'S2 SF4000DZK-A', 'LZSMJLZ08TF300050', 'EI26500096', 'Blue', 'Available', '3-WHEEL', 'ELECTRIC', 1620000),
        (2, 'S2 SF4000DZK-A', 'LZSMJLZ08TF300050', 'EI26500096', 'Blue', 'Available', '3-WHEEL', 'ELECTRIC', 1620000),
        (3, 'S2 SF4000DZK-A', 'LZSMJLZ01TF300052', 'EI26500106', 'Blue', 'Available', '3-WHEEL', 'ELECTRIC', 1620000),
    ])

    resp = _import(client, auth_headers, buf)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()['message'] == 'Imported 2 vehicles, skipped 1'
    assert Vehicle.query.filter_by(vin='LZSMJLZ08TF300050').count() == 1
    assert Vehicle.query.filter_by(vin='LZSMJLZ01TF300052').count() == 1


def test_import_excel_vehicles_missing_columns(client, auth_headers, db):
    """Uploading a file without required columns returns a 400."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(['Foo', 'Bar'])
    ws.append([1, 2])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    resp = _import(client, auth_headers, buf)
    assert resp.status_code == 400
    assert 'not found' in resp.get_json()['message']


def test_import_excel_vehicles_requires_admin(client, db):
    """Non-admin users are rejected."""
    from app.models import User
    user = User(username='cashier', role='cashier', status='active')
    user.set_password('pass1234')
    db.session.add(user)
    db.session.commit()

    resp = client.post('/api/auth/login', json={'username': 'cashier', 'password': 'pass1234'})
    token = resp.get_json()['token']
    headers = {'Authorization': f'Bearer {token}'}

    buf = _make_xlsx([(1, 'M', 'VIN-1', 'E-1', 'Blue', 'Available', '3-WHEEL', 'ELECTRIC', 1000)])
    resp = _import(client, headers, buf)
    assert resp.status_code == 403
