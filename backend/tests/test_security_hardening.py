"""Regression tests for the security-hardening batch.

Covers:
  * deactivated users immediately losing API access (token revocation)
  * login refusing accounts with no password hash
  * cancelled sales excluded from reports
  * branch isolation on by-id endpoints and list endpoints
  * the expense ?user_id= read bypass
  * branch-comparison filtering for non-admins
"""
import pytest

from app import db as _db
from app.models import (
    User, Branch, Expense, Order, Sale, Payment, SparePart, Transfer,
    ActivityLog, Vehicle,
)


def _make_user(app, username, password, role='cashier', branch_id=None, status='active'):
    with app.app_context():
        user = User(username=username, role=role, branch_id=branch_id, status=status)
        user.set_password(password)
        _db.session.add(user)
        _db.session.commit()
        return user.id


def _token(client, username, password):
    resp = client.post('/api/auth/login', json={'username': username, 'password': password})
    assert resp.status_code == 200, resp.get_json()
    return {'Authorization': f"Bearer {resp.get_json()['token']}"}


def _branch(app, name='Shire'):
    with app.app_context():
        b = Branch(name=name, location=name)
        _db.session.add(b)
        _db.session.commit()
        return b.id


# ── Token revocation / deactivation ─────────────────────────────────────

def test_deactivated_user_token_is_rejected(client, app, db):
    bid = _branch(app)
    _make_user(app, 'active_user', 'pass1234', branch_id=bid)
    _make_user(app, 'temp_user', 'pass1234', branch_id=bid)

    headers = _token(client, 'temp_user', 'pass1234')
    assert client.get('/api/orders', headers=headers).status_code == 200

    with app.app_context():
        user = User.query.filter_by(username='temp_user').first()
        user.status = 'inactive'
        _db.session.commit()

    # The already-issued token must stop working immediately.
    assert client.get('/api/orders', headers=headers).status_code == 401


def test_token_for_deleted_user_is_rejected(client, app, db):
    bid = _branch(app)
    _make_user(app, 'doomed', 'pass1234', branch_id=bid)
    headers = _token(client, 'doomed', 'pass1234')

    with app.app_context():
        User.query.filter_by(username='doomed').delete()
        _db.session.commit()

    assert client.get('/api/branches', headers=headers).status_code == 401


def test_login_refused_when_password_hash_missing(client, app, db):
    _branch(app)
    with app.app_context():
        user = User(username='restored_user', role='admin', status='active')
        user.password_hash = None
        _db.session.add(user)
        _db.session.commit()

    # Must not self-heal to a default password.
    resp = client.post('/api/auth/login',
                       json={'username': 'restored_user', 'password': 'admin123'})
    assert resp.status_code == 401

    with app.app_context():
        assert User.query.filter_by(username='restored_user').first().password_hash is None


# ── Reports exclude cancelled sales ─────────────────────────────────────

def test_cancelled_sales_excluded_from_dashboard(client, auth_headers, app, db):
    from datetime import datetime, timezone
    bid = _branch(app)
    with app.app_context():
        now = datetime.now(timezone.utc)
        _db.session.add_all([
            Sale(sale_number='S-OK', sale_type='vehicle', total_amount=1000,
                 cost_at_sale=400, status='completed', branch_id=bid, sale_date=now),
            Sale(sale_number='S-CAN', sale_type='vehicle', total_amount=9000,
                 cost_at_sale=9000, status='cancelled', branch_id=bid, sale_date=now),
        ])
        _db.session.commit()

    resp = client.get('/api/reports/profit-analysis', headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()['revenue'] == 1000


def test_branch_comparison_scopes_non_admin(client, app, db):
    bid_a = _branch(app, 'Alpha')
    bid_b = _branch(app, 'Beta')
    _make_user(app, 'mgr_a', 'pass1234', role='manager', branch_id=bid_a)
    headers = _token(client, 'mgr_a', 'pass1234')

    resp = client.get('/api/reports/branch-comparison', headers=headers)
    assert resp.status_code == 200
    names = [row['name'] for row in resp.get_json()]
    assert 'Alpha' in names
    assert 'Beta' not in names


# ── Branch isolation on by-id writes ────────────────────────────────────

def test_non_admin_cannot_touch_other_branch_order(client, app, db):
    bid_a = _branch(app, 'Alpha')
    bid_b = _branch(app, 'Beta')
    _make_user(app, 'mgr_a', 'pass1234', role='manager', branch_id=bid_a)
    with app.app_context():
        order = Order(customer_name='Other', sequence_number=1, branch_id=bid_b)
        _db.session.add(order)
        _db.session.commit()
        other_id = order.id

    headers = _token(client, 'mgr_a', 'pass1234')
    assert client.post(f'/api/orders/{other_id}/cancel', headers=headers,
                       json={'reason': 'x'}).status_code == 404
    assert client.put(f'/api/orders/{other_id}', headers=headers,
                      json={'customer_name': 'Hacked'}).status_code == 404
    assert client.delete(f'/api/orders/{other_id}', headers=headers).status_code == 404

    with app.app_context():
        assert Order.query.get(other_id).customer_name == 'Other'


def test_non_admin_cannot_delete_other_branch_part(client, app, db):
    bid_a = _branch(app, 'Alpha')
    bid_b = _branch(app, 'Beta')
    _make_user(app, 'mgr_a', 'pass1234', role='manager', branch_id=bid_a)
    with app.app_context():
        part = SparePart(part_number='X-1', name='Widget', branch_id=bid_b, quantity=5)
        _db.session.add(part)
        _db.session.commit()
        part_id = part.id

    headers = _token(client, 'mgr_a', 'pass1234')
    assert client.delete(f'/api/inventory/spare-parts/{part_id}', headers=headers).status_code == 404
    with app.app_context():
        assert SparePart.query.get(part_id) is not None


def test_transfers_list_scoped_to_branch(client, app, db):
    bid_a = _branch(app, 'Alpha')
    bid_b = _branch(app, 'Beta')
    _make_user(app, 'mgr_a', 'pass1234', role='manager', branch_id=bid_a)
    with app.app_context():
        _db.session.add_all([
            Transfer(from_branch_id=bid_a, to_branch_id=bid_b, item_type='spare_part',
                     item_id=1, quantity=1, approval_status='pending'),
            Transfer(from_branch_id=bid_b, to_branch_id=bid_b, item_type='spare_part',
                     item_id=2, quantity=1, approval_status='pending'),
        ])
        _db.session.commit()

    headers = _token(client, 'mgr_a', 'pass1234')
    items = client.get('/api/transfers', headers=headers).get_json()['items']
    assert len(items) == 1
    assert items[0]['from_branch'] == bid_a


# ── Expense read bypass ─────────────────────────────────────────────────

def test_expense_user_id_filter_ignored_for_non_admin(client, app, db):
    bid = _branch(app)
    other_id = _make_user(app, 'other_user', 'pass1234', branch_id=bid)
    _make_user(app, 'acc_user', 'pass1234', role='accountant', branch_id=bid)
    with app.app_context():
        _db.session.add_all([
            Expense(category='Fuel', amount=100, branch_id=bid, user_id=other_id),
        ])
        _db.session.commit()

    headers = _token(client, 'acc_user', 'pass1234')
    # ?user_id= must not surface someone else's expenses.
    resp = client.get(f'/api/expenses?user_id={other_id}', headers=headers)
    assert resp.status_code == 200
    assert resp.get_json() == []


def test_activity_log_non_admin_identity_is_int(client, app, db):
    """The JWT identity is a string but ActivityLog.user_id is an Integer.

    On Postgres a raw `user_id = '<str>'` raises `integer = varchar`, so this
    guards the cast. Each user must only see their own entries.
    """
    bid = _branch(app)
    uid_a = _make_user(app, 'log_a', 'pass1234', role='manager', branch_id=bid)
    uid_b = _make_user(app, 'log_b', 'pass1234', role='manager', branch_id=bid)
    with app.app_context():
        _db.session.add_all([
            ActivityLog(user_id=uid_a, action='CREATE_SALE', description='mine'),
            ActivityLog(user_id=uid_b, action='CREATE_SALE', description='theirs'),
        ])
        _db.session.commit()

    headers = _token(client, 'log_a', 'pass1234')
    resp = client.get('/api/reports/activity?limit=6', headers=headers)
    assert resp.status_code == 200
    items = resp.get_json()
    assert [i['description'] for i in items] == ['mine']


def test_expense_users_self_only(client, app, db):
    """Non-admins listing expense users must not hit integer = varchar either."""
    bid = _branch(app)
    _make_user(app, 'other_acc', 'pass1234', role='accountant', branch_id=bid)
    _make_user(app, 'self_acc', 'pass1234', role='accountant', branch_id=bid)

    headers = _token(client, 'self_acc', 'pass1234')
    resp = client.get('/api/expenses/users', headers=headers)
    assert resp.status_code == 200
    assert [u['username'] for u in resp.get_json()] == ['self_acc']


def test_cashier_can_read_payment_history(client, app, db):
    """Cashiers record sales and view their payment history on the Sales page.

    The endpoint used to be admin/manager/accountant only, so a cashier got a
    403 that the UI surfaced as "Failed to fetch payment history".
    """
    bid = _branch(app)
    _make_user(app, 'cash_user', 'pass1234', role='cashier', branch_id=bid)
    with app.app_context():
        sale = Sale(sale_number='S-1', total_amount=100,
                    status='completed', branch_id=bid)
        _db.session.add(sale)
        _db.session.commit()
        sale_id = sale.id
        _db.session.add(Payment(sale_id=sale_id, amount=100, payment_method='cash'))
        _db.session.commit()

    headers = _token(client, 'cash_user', 'pass1234')
    resp = client.get(f'/api/sales/{sale_id}/payments', headers=headers)
    assert resp.status_code == 200
    assert len(resp.get_json()) == 1


def test_payment_history_scoped_to_branch(client, app, db):
    """Non-admins must not read payments for another branch's sale."""
    bid_a = _branch(app, 'Shire')
    bid_b = _branch(app, 'Mekelle')
    _make_user(app, 'cash_a', 'pass1234', role='cashier', branch_id=bid_a)
    with app.app_context():
        sale = Sale(sale_number='S-2', total_amount=100,
                    status='completed', branch_id=bid_b)
        _db.session.add(sale)
        _db.session.commit()
        sale_id = sale.id

    headers = _token(client, 'cash_a', 'pass1234')
    assert client.get(f'/api/sales/{sale_id}/payments', headers=headers).status_code == 404


# ── Branch id / JWT identity type coercion (Postgres strictness) ────────

def test_effective_branch_id_coerces_string_branch():
    """`request.args` yields strings; the branch columns are Integer.

    Comparing an Integer column to a string renders `branch_id = '2'`, which
    Postgres rejects with `operator does not exist: integer = character
    varying`. SQLite silently coerces, so the coercion is asserted directly.
    """
    from app.utils.auth import effective_branch_id

    class _U:
        def __init__(self, role, branch_id):
            self.role, self.branch_id = role, branch_id

    admin, manager = _U('admin', None), _U('manager', 2)
    assert effective_branch_id(admin, '2') == 2
    assert isinstance(effective_branch_id(admin, '2'), int)
    assert effective_branch_id(admin, '') is None
    assert effective_branch_id(admin, None) is None
    assert effective_branch_id(admin, 'abc') is None
    assert effective_branch_id(manager, '2') == 2


def test_user_can_access_branch_compares_across_types():
    from app.utils.auth import user_can_access_branch

    class _U:
        def __init__(self, role, branch_id):
            self.role, self.branch_id = role, branch_id

    manager = _U('manager', 2)
    assert user_can_access_branch(manager, '2') is True
    assert user_can_access_branch(manager, 2) is True
    assert user_can_access_branch(manager, '3') is False
    assert user_can_access_branch(manager, None) is False
    assert user_can_access_branch(None, 2) is False


def test_admin_branch_filter_accepts_string_id(client, app, db):
    """An admin filtering inventory by ?branch_id= must not error on the type.

    This exercises the same code path as the Inventory page's branch dropdown.
    """
    bid = _branch(app)
    _make_user(app, 'root_admin', 'pass1234', role='admin')
    with app.app_context():
        _db.session.add(Vehicle(vin='COERCE01', model='M', type='4-wheel',
                                selling_price=100, status='available', branch_id=bid))
        _db.session.commit()

    headers = _token(client, 'root_admin', 'pass1234')
    resp = client.get(f'/api/inventory/vehicles?branch_id={bid}&status=available',
                      headers=headers)
    assert resp.status_code == 200
    assert [v['vin'] for v in resp.get_json()['items']] == ['COERCE01']
    # vehicle-stats and spare-part-categories follow the same branch filter.
    assert client.get(f'/api/inventory/vehicle-stats?branch_id={bid}',
                      headers=headers).status_code == 200
    assert client.get(f'/api/inventory/spare-part-categories?branch_id={bid}',
                      headers=headers).status_code == 200


# ── Profile password change ─────────────────────────────────────────────
def test_users_me_requires_current_password(client, app, db):
    _branch(app)
    _make_user(app, 'prof_user', 'pass1234', role='manager')
    headers = _token(client, 'prof_user', 'pass1234')

    bad = client.put('/api/users/me', headers=headers,
                     json={'username': 'prof_user', 'password': 'newpass123',
                           'current_password': 'wrong'})
    assert bad.status_code == 403

    ok = client.put('/api/users/me', headers=headers,
                    json={'username': 'prof_user', 'password': 'newpass123',
                          'current_password': 'pass1234'})
    assert ok.status_code == 200
    assert _token(client, 'prof_user', 'newpass123')
