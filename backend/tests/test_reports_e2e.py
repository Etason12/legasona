"""
End-to-end reports & dashboard test.

Records sales and payments through the HTTP API (the same way the frontend
does), then verifies the reports/dashboard endpoints reflect them:

    branch + inventory setup → record vehicle + spare part sales
    → verify dashboard stats, profit analysis, payment report,
      branch comparison, inventory distribution, and activity log.
"""
import pytest


from tests.conftest import (create_branch_via_api, create_vehicle_via_api,
                            create_spare_part_via_api)


def _sale_window(client, headers, sale_ids):
    """Return a (start, end) date window covering all the given sales' dates,
    used as a deterministic report window so assertions don't depend on the
    wall clock (and are safe even across a UTC day boundary)."""
    from datetime import datetime

    resp = client.get('/api/sales', headers=headers)
    assert resp.status_code == 200, resp.get_json()
    dates = [datetime.fromisoformat(s['sale_date']).date().isoformat()
             for s in resp.get_json()['items'] if s['id'] in sale_ids]
    assert len(dates) == len(sale_ids), 'all sales must be present in the list'
    return min(dates), max(dates)


# ── Dashboard & reports reflect recorded sales ───────────────────────

def test_e2e_reports_reflect_recorded_sales(client, auth_headers, db):
    """Dashboard and reports mirror sales and payments recorded via the API."""
    from app.models import Sale, SparePart, Vehicle

    branch_id = create_branch_via_api(client, auth_headers)
    vehicle_a = create_vehicle_via_api(client, auth_headers, branch_id,
                                       'RPT-VIN-001', 'Toyota Hilux',
                                       selling_price=2500000, cost_price=1800000)
    vehicle_b = create_vehicle_via_api(client, auth_headers, branch_id,
                                       'RPT-VIN-002', 'Foton',
                                       selling_price=1000000, cost_price=700000)
    part_id = create_spare_part_via_api(client, auth_headers, branch_id,
                                        'Oil Filter', unit_price=500, quantity=10,
                                        cost_price=200)

    # 1. Dashboard is empty before any sales
    resp = client.get('/api/reports/dashboard', headers=auth_headers)
    assert resp.status_code == 200
    stats = {s['name']: s['value'] for s in resp.get_json()['stats']}
    assert stats['Total Company Sales'] == 'ETB 0'
    assert stats['Active Waiting List'] == '0'
    assert stats['Inventory Value (Available)'] == 'ETB 3,500,000'

    # 2. Record a fully-paid vehicle sale → vehicle sold
    resp = client.post('/api/sales/vehicle', headers=auth_headers, json={
        'vehicle_id': vehicle_a,
        'customer_name': 'John Doe',
        'customer_phone': '+251911200001',
        'payments': [{'method': 'cash', 'amount': 2500000}],
    })
    assert resp.status_code == 201, resp.get_json()
    vehicle_sale_id = resp.get_json()['sale_id']
    assert db.session.get(Vehicle, vehicle_a).status == 'sold'

    # 3. Spare part sale: partial payment, then paid off
    resp = client.post('/api/sales/spare-part', headers=auth_headers, json={
        'part_id': part_id, 'quantity': 2, 'total_amount': 1000,
        'customer_name': 'Abel Tesfay', 'customer_phone': '+251911200002',
        'payments': [{'method': 'cash', 'amount': 300}],
    })
    assert resp.status_code == 201, resp.get_json()
    part_sale_id = Sale.query.filter_by(
        sale_number=resp.get_json()['sale_number']).first().id
    assert db.session.get(SparePart, part_id).quantity == 8
    resp = client.post(f'/api/sales/{part_sale_id}/add-payment',
                       headers=auth_headers,
                       data={'amount': '700', 'method': 'cash'},
                       content_type='multipart/form-data')
    assert resp.status_code == 200, resp.get_json()

    # 4. Dashboard reflects revenue and remaining inventory
    start, end = _sale_window(client, auth_headers,
                              [vehicle_sale_id, part_sale_id])
    resp = client.get(f'/api/reports/dashboard?start_date={start}&end_date={end}',
                      headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    stats = {s['name']: s['value'] for s in data['stats']}
    assert stats['Total Company Sales'] == 'ETB 2,501,000'
    assert stats['Last 30 Days Revenue'] == 'ETB 2,501,000'
    assert stats['Inventory Value (Available)'] == 'ETB 1,000,000'
    assert stats['Active Waiting List'] == '0'
    assert sum(c['sales'] for c in data['chart_data']) == 2501000.0

    # 5. Profit analysis matches cost_at_sale recorded on each sale
    resp = client.get(f'/api/reports/profit-analysis?start_date={start}&end_date={end}',
                      headers=auth_headers)
    assert resp.status_code == 200
    profit = resp.get_json()
    assert profit['revenue'] == 2501000.0
    assert profit['cogs'] == 1800400.0       # 1.8M vehicle + 2×200 part
    assert profit['expenses'] == 0.0
    assert profit['gross_profit'] == 700600.0
    assert profit['net_profit'] == 700600.0
    assert profit['margin'] == pytest.approx(28.01, abs=0.01)

    # 6. Payment report lists every recorded payment
    resp = client.get('/api/reports/payments', headers=auth_headers)
    assert resp.status_code == 200
    payments = resp.get_json()
    assert len(payments) == 3
    by_amount = {float(p['amount']): p for p in payments}
    vehicle_pmt = by_amount[2500000.0]
    assert vehicle_pmt['sale_type'] == 'vehicle'
    assert vehicle_pmt['item_name'] == 'Toyota Hilux'
    assert vehicle_pmt['customer_name'] == 'John Doe'
    assert vehicle_pmt['payment_method'] == 'cash'
    assert by_amount[300.0]['sale_type'] == 'spare_part'
    assert by_amount[700.0]['sale_type'] == 'spare_part'
    assert by_amount[700.0]['item_name'] == 'Oil Filter'

    # 7. Branch comparison aggregates the branch's sales and inventory
    resp = client.get('/api/reports/branch-comparison', headers=auth_headers)
    assert resp.status_code == 200
    branch = resp.get_json()[0]
    assert branch['name'] == 'Shire'
    assert branch['revenue'] == 2501000.0
    assert branch['sales_count'] == 2
    assert branch['vehicle_count'] == 2
    assert branch['spare_part_count'] == 1

    # 8. Inventory distribution reflects remaining stock composition
    resp = client.get('/api/reports/inventory-distribution', headers=auth_headers)
    assert resp.status_code == 200
    dist = resp.get_json()
    vehicle_types = {t['name']: t['count'] for t in dist['vehicle_types']}
    assert vehicle_types.get('4-wheel') == 2
    part_categories = {c['name']: c['count'] for c in dist['part_categories']}
    assert part_categories.get('Filters') == 1

    # 9. Activity feed logs the sale actions
    resp = client.get('/api/reports/activity?limit=50', headers=auth_headers)
    assert resp.status_code == 200
    actions = [a['action'] for a in resp.get_json()]
    assert 'VEHICLE_SALE' in actions
    assert 'SPARE_PART_SALE' in actions
    assert 'ADD_PAYMENT' in actions
