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


def test_branch_comparison_scopes_confined_role(client, app, db):
    """Roles without cross-branch access only see their own branch here.

    (Managers/admins now get every branch — see
    test_manager_sees_all_branches_in_branch_comparison.)
    """
    bid_a = _branch(app, 'Alpha')
    bid_b = _branch(app, 'Beta')
    _make_user(app, 'cash_a', 'pass1234', role='cashier', branch_id=bid_a)
    headers = _token(client, 'cash_a', 'pass1234')

    resp = client.get('/api/reports/branch-comparison', headers=headers)
    assert resp.status_code == 200
    names = [row['name'] for row in resp.get_json()]
    assert 'Alpha' in names
    assert 'Beta' not in names


def test_manager_sees_all_branches_in_branch_comparison(client, app, db):
    """Managers have full cross-branch access, so All Branches works."""
    bid_a = _branch(app, 'Alpha')
    _branch(app, 'Beta')
    _make_user(app, 'mgr_x', 'pass1234', role='manager', branch_id=bid_a)
    headers = _token(client, 'mgr_x', 'pass1234')

    resp = client.get('/api/reports/branch-comparison', headers=headers)
    assert resp.status_code == 200
    names = [row['name'] for row in resp.get_json()]
    assert {'Alpha', 'Beta'} <= set(names)


# ── Branch isolation on by-id writes ────────────────────────────────────

def test_confined_role_cannot_touch_other_branch_order(client, app, db):
    bid_a = _branch(app, 'Alpha')
    bid_b = _branch(app, 'Beta')
    _make_user(app, 'cash_a', 'pass1234', role='cashier', branch_id=bid_a)
    with app.app_context():
        order = Order(customer_name='Other', sequence_number=1, branch_id=bid_b)
        _db.session.add(order)
        _db.session.commit()
        other_id = order.id

    headers = _token(client, 'cash_a', 'pass1234')
    assert client.put(f'/api/orders/{other_id}', headers=headers,
                      json={'customer_name': 'Hacked'}).status_code == 404

    with app.app_context():
        assert _db.session.get(Order, other_id).customer_name == 'Other'


def test_manager_can_touch_other_branch_order(client, app, db):
    """Managers have full cross-branch access (by-id writes included)."""
    bid_a = _branch(app, 'Alpha')
    bid_b = _branch(app, 'Beta')
    _make_user(app, 'mgr_a', 'pass1234', role='manager', branch_id=bid_a)
    with app.app_context():
        order = Order(customer_name='Other', sequence_number=1, branch_id=bid_b)
        _db.session.add(order)
        _db.session.commit()
        other_id = order.id

    headers = _token(client, 'mgr_a', 'pass1234')
    assert client.put(f'/api/orders/{other_id}', headers=headers,
                      json={'customer_name': 'Renamed'}).status_code == 200
    with app.app_context():
        assert _db.session.get(Order, other_id).customer_name == 'Renamed'


def test_manager_can_delete_other_branch_part(client, app, db):
    """Managers may delete a spare part in any branch (full cross-branch)."""
    bid_a = _branch(app, 'Alpha')
    bid_b = _branch(app, 'Beta')
    _make_user(app, 'mgr_a', 'pass1234', role='manager', branch_id=bid_a)
    with app.app_context():
        part = SparePart(part_number='X-1', name='Widget', branch_id=bid_b, quantity=5)
        _db.session.add(part)
        _db.session.commit()
        part_id = part.id

    headers = _token(client, 'mgr_a', 'pass1234')
    assert client.delete(f'/api/inventory/spare-parts/{part_id}', headers=headers).status_code == 200
    with app.app_context():
        assert _db.session.get(SparePart, part_id) is None


def test_roles_without_delete_permission_still_blocked(client, app, db):
    """Cross-branch access does not widen role permissions."""
    bid_b = _branch(app, 'Beta')
    _make_user(app, 'keep_a', 'pass1234', role='storekeeper')
    with app.app_context():
        part = SparePart(part_number='X-2', name='Widget', branch_id=bid_b, quantity=5)
        _db.session.add(part)
        _db.session.commit()
        part_id = part.id

    headers = _token(client, 'keep_a', 'pass1234')
    assert client.delete(f'/api/inventory/spare-parts/{part_id}', headers=headers).status_code == 403


def test_transfers_list_scoped_to_confined_role(client, app, db):
    bid_a = _branch(app, 'Alpha')
    bid_b = _branch(app, 'Beta')
    _make_user(app, 'cash_a', 'pass1234', role='cashier', branch_id=bid_a)
    with app.app_context():
        _db.session.add_all([
            Transfer(from_branch_id=bid_a, to_branch_id=bid_b, item_type='spare_part',
                     item_id=1, quantity=1, approval_status='pending'),
            Transfer(from_branch_id=bid_b, to_branch_id=bid_b, item_type='spare_part',
                     item_id=2, quantity=1, approval_status='pending'),
        ])
        _db.session.commit()

    headers = _token(client, 'cash_a', 'pass1234')
    items = client.get('/api/transfers', headers=headers).get_json()['items']
    assert len(items) == 1
    assert items[0]['from_branch'] == bid_a


def test_manager_sales_list_all_branches_selector(client, app, db):
    """The Sales page 'All Branches' option must work for a manager.

    The frontend used to clamp non-admins to their own branch, and the backend
    did the same, so the selector was a no-op for managers.
    """
    bid_a = _branch(app, 'Alpha')
    bid_b = _branch(app, 'Beta')
    _make_user(app, 'mgr_a', 'pass1234', role='manager', branch_id=bid_a)
    with app.app_context():
        _db.session.add_all([
            Sale(sale_number='SALE-A', customer_name='A', total_amount=10,
                 status='completed', branch_id=bid_a),
            Sale(sale_number='SALE-B', customer_name='B', total_amount=20,
                 status='completed', branch_id=bid_b),
        ])
        _db.session.commit()

    headers = _token(client, 'mgr_a', 'pass1234')

    # Default (own branch): only Alpha's sales.
    own = client.get(f'/api/sales?branch_id={bid_a}', headers=headers).get_json()['items']
    assert [s['sale_number'] for s in own] == ['SALE-A']

    # Explicitly picking another branch works for a manager.
    other = client.get(f'/api/sales?branch_id={bid_b}', headers=headers).get_json()['items']
    assert [s['sale_number'] for s in other] == ['SALE-B']

    # "All Branches" (empty branch_id) shows every branch.
    all_branches = client.get('/api/sales?branch_id=', headers=headers).get_json()['items']
    assert {'SALE-A', 'SALE-B'} <= {s['sale_number'] for s in all_branches}


def test_cashier_sales_list_stays_confined(client, app, db):
    """Confined roles still get their own branch even for All Branches."""
    bid_a = _branch(app, 'Alpha')
    bid_b = _branch(app, 'Beta')
    _make_user(app, 'cash_a', 'pass1234', role='cashier', branch_id=bid_a)
    with app.app_context():
        _db.session.add_all([
            Sale(sale_number='SALE-A', customer_name='A', total_amount=10,
                 status='completed', branch_id=bid_a),
            Sale(sale_number='SALE-B', customer_name='B', total_amount=20,
                 status='completed', branch_id=bid_b),
        ])
        _db.session.commit()

    headers = _token(client, 'cash_a', 'pass1234')
    got = {s['sale_number'] for s in client.get('/api/sales?branch_id=', headers=headers).get_json()['items']}
    assert got == {'SALE-A'}
    # Requesting another branch explicitly does not widen access either.
    got_other = client.get(f'/api/sales?branch_id={bid_b}', headers=headers).get_json()['items']
    assert {s['sale_number'] for s in got_other} == {'SALE-A'}


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

    Also locks in the role policy: admins and managers honour the requested
    branch (manager = full cross-branch access, including no branch = all),
    everyone else is clamped to their assigned branch.
    """
    from app.utils.auth import effective_branch_id

    class _U:
        def __init__(self, role, branch_id):
            self.role, self.branch_id = role, branch_id

    admin, manager = _U('admin', None), _U('manager', 2)
    cashier = _U('cashier', 2)

    assert effective_branch_id(admin, '2') == 2
    assert isinstance(effective_branch_id(admin, '2'), int)
    assert effective_branch_id(admin, '') is None
    assert effective_branch_id(admin, None) is None
    assert effective_branch_id(admin, 'abc') is None

    # Managers may pick any branch, or none for all branches.
    assert effective_branch_id(manager, '2') == 2
    assert effective_branch_id(manager, '3') == 3
    assert effective_branch_id(manager, '') is None
    assert effective_branch_id(manager, None) is None

    # Cashiers stay on their assigned branch whatever they request.
    assert effective_branch_id(cashier, '3') == 2
    assert effective_branch_id(cashier, '') == 2


def test_user_can_access_branch_compares_across_types():
    from app.utils.auth import user_can_access_branch

    class _U:
        def __init__(self, role, branch_id):
            self.role, self.branch_id = role, branch_id

    manager = _U('manager', 2)
    cashier = _U('cashier', 2)

    # Managers have full cross-branch access.
    assert user_can_access_branch(manager, '2') is True
    assert user_can_access_branch(manager, 3) is True
    assert user_can_access_branch(manager, 99) is True

    # Cashiers are confined, and the comparison works across str/int.
    assert user_can_access_branch(cashier, '2') is True
    assert user_can_access_branch(cashier, 2) is True
    assert user_can_access_branch(cashier, '3') is False
    assert user_can_access_branch(cashier, None) is False

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


# ── User deletion ───────────────────────────────────────────────────────

def test_cannot_delete_user_with_referenced_records(client, app, db):
    """A user who owns records cannot be deleted; the API must say why.

    ActivityLog.user_id (among others) references users.id, so deleting an
    account that has ever acted raises an IntegrityError. The endpoint must
    return a 400 with an actionable message rather than a bare failure.
    """
    bid = _branch(app)
    _make_user(app, 'root_admin2', 'pass1234', role='admin')
    victim_id = _make_user(app, 'busy_user', 'pass1234', branch_id=bid)
    with app.app_context():
        _db.session.add(ActivityLog(user_id=victim_id, action='CREATE_SALE',
                                    description='did something'))
        _db.session.commit()

    headers = _token(client, 'root_admin2', 'pass1234')
    resp = client.delete(f'/api/users/{victim_id}', headers=headers)
    assert resp.status_code == 400
    assert 'deactivate' in resp.get_json()['message'].lower()
    # The account must still exist.
    with app.app_context():
        assert _db.session.get(User, victim_id) is not None


def test_admin_can_delete_unreferenced_user(client, app, db):
    """A user with no records is deletable."""
    bid = _branch(app)
    _make_user(app, 'root_admin3', 'pass1234', role='admin')
    victim_id = _make_user(app, 'clean_user', 'pass1234', branch_id=bid)

    headers = _token(client, 'root_admin3', 'pass1234')
    resp = client.delete(f'/api/users/{victim_id}', headers=headers)
    assert resp.status_code == 200
    with app.app_context():
        assert _db.session.get(User, victim_id) is None


def test_cannot_delete_own_account(client, app, db):
    bid = _branch(app)
    admin_id = _make_user(app, 'self_admin', 'pass1234', role='admin', branch_id=bid)
    headers = _token(client, 'self_admin', 'pass1234')
    resp = client.delete(f'/api/users/{admin_id}', headers=headers)
    assert resp.status_code == 400
    assert 'your own account' in resp.get_json()['message'].lower()


# ── Sales search ────────────────────────────────────────────────────────

def test_sales_search_matches_chassis_and_motor(client, app, db):
    """The recorded-sales search box must match chassis (VIN) and motor no."""
    bid = _branch(app)
    _make_user(app, 'sales_mgr', 'pass1234', role='manager', branch_id=bid)
    with app.app_context():
        _db.session.add_all([
            Sale(sale_number='S-100', customer_name='Almaz', total_amount=100,
                 status='completed', branch_id=bid,
                 chassis_number='CHASSIS-ABC123', motor_number='MOTOR-XYZ789'),
            Sale(sale_number='S-101', customer_name='Bekele', total_amount=200,
                 status='completed', branch_id=bid,
                 chassis_number='CHASSIS-OTHER', motor_number='MOTOR-OTHER'),
        ])
        _db.session.commit()

    headers = _token(client, 'sales_mgr', 'pass1234')

    by_chassis = client.get('/api/sales?search=ABC123', headers=headers)
    assert by_chassis.status_code == 200
    assert [s['sale_number'] for s in by_chassis.get_json()['items']] == ['S-100']

    by_motor = client.get('/api/sales?search=XYZ789', headers=headers)
    assert by_motor.status_code == 200
    assert [s['sale_number'] for s in by_motor.get_json()['items']] == ['S-100']

    # Customer and receipt searches still work.
    assert [s['sale_number'] for s in
            client.get('/api/sales?search=Almaz', headers=headers).get_json()['items']] == ['S-100']
    assert [s['sale_number'] for s in
            client.get('/api/sales?search=S-101', headers=headers).get_json()['items']] == ['S-101']
