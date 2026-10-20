"""Static guard against string-vs-integer column comparisons.

Request arguments and JWT identities are *strings*, while ids and foreign keys
are *Integer* columns. SQLAlchemy renders ``Model.branch_id == '2'`` as
``branch_id = '2'``, which Postgres rejects with::

    operator does not exist: integer = character varying

SQLite silently coerces the string, so functional tests pass while production
returns 500s. This module parses the backend routes and flags any comparison
between a known Integer column and a value that still traces back to a raw
request/identity string.

The scan is intentionally conservative: it only reports a variable when it is
assigned directly from a known string source and never passed through a
coercer (``int()``, ``safe_int()``, ``effective_branch_id()``). If a route is
refactored in a way this cannot follow, it is better to add an explicit
``safe_int()`` than to weaken the check.
"""
import ast
import pathlib

ROUTES_DIR = pathlib.Path(__file__).resolve().parent.parent / 'app'

# Functions that turn a request string into a safe value.
COERCERS = {'int', 'safe_int', 'effective_branch_id'}

# Expressions that yield a raw string from the outside world.
STRING_SOURCES = {
    'get_jwt_identity',
    'request.args.get',
    'request.form.get',
    'request.values.get',
    'request.json.get',
}

# Integer-typed columns that are routinely compared against request values.
INT_COLUMNS = {
    'id', 'branch_id', 'from_branch_id', 'to_branch_id', 'user_id',
    'item_id', 'sale_id', 'payment_id', 'order_id', 'customer_id',
    'vehicle_id', 'part_id', 'purchase_id', 'quantity', 'requested_by',
}


def _call_name(node):
    """Dotted name of a call/attribute node, e.g. ``request.args.get``."""
    parts = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if isinstance(node, ast.Name):
        parts.append(node.id)
    return '.'.join(reversed(parts))


def _is_string_source(node):
    """A raw request/identity string, e.g. ``request.args.get('branch_id')``."""
    if not isinstance(node, ast.Call):
        return False
    return _call_name(node.func) in STRING_SOURCES


def _is_coerced(node):
    """Value passed through int()/safe_int()/effective_branch_id()."""
    if isinstance(node, ast.Call):
        return _call_name(node.func) in COERCERS
    return False


def _assigned_taint(value, tainted):
    """Whether ``value`` yields a raw string, given the current taint set."""
    if _is_coerced(value):
        return False
    if _is_string_source(value):
        return True
    if isinstance(value, ast.Name):
        return value.id in tainted
    # An f-string/concatenation of a tainted name is still the same string.
    if isinstance(value, ast.JoinedStr):
        return any(
            isinstance(v, ast.FormattedValue)
            and isinstance(v.value, ast.Name)
            and v.value.id in tainted
            for v in value.values
        )
    return False


def _iter_nodes_in_order(tree):
    """Depth-first, source-order traversal of *statements* only.

    ``ast.walk`` is breadth-first, which interleaves assignments from different
    branches and loses the ordering the taint analysis depends on.
    """
    stack = [tree]
    while stack:
        node = stack.pop()
        yield node
        children = [
            child for child in ast.iter_child_nodes(node)
            if isinstance(child, ast.stmt)
        ]
        stack.extend(reversed(children))


def _column_name(node):
    """The Integer column name of ``Model.branch_id``, else None."""
    if isinstance(node, ast.Attribute) and node.attr in INT_COLUMNS:
        return node.attr
    return None


def _comparison_operands(node):
    """Names compared to an Integer column in ``node``, if any."""
    if not isinstance(node, ast.Compare):
        return []
    if not any(isinstance(op, (ast.Eq, ast.NotEq)) for op in node.ops):
        return []
    operands = [node.left, *node.comparators]
    if not any(_column_name(o) for o in operands):
        return []
    return [o.id for o in operands if isinstance(o, ast.Name)]


def _comparisons_within(node):
    """All Integer-column comparisons anywhere inside ``node``."""
    return [n for n in ast.walk(node) if isinstance(n, ast.Compare)]


def scan_function(func):
    """Yield ``(lineno, name)`` for tainted values compared to int columns.

    Statement order matters: the taint state is evaluated at the position of
    each comparison, so a value is only reported when it is still a raw string
    at the point of use.
    """
    tainted = set()
    for node in _iter_nodes_in_order(func):
        if isinstance(node, ast.Assign):
            is_tainted = _assigned_taint(node.value, tainted)
            for target in node.targets:
                if isinstance(target, ast.Name):
                    if is_tainted:
                        tainted.add(target.id)
                    else:
                        tainted.discard(target.id)
            # `query = query.filter(Vehicle.branch_id == branch_id)`
            for cmp_node in _comparisons_within(node.value):
                for name in _comparison_operands(cmp_node):
                    if name in tainted:
                        yield cmp_node.lineno, name
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            if node.value is not None:
                if _assigned_taint(node.value, tainted):
                    tainted.add(node.target.id)
                else:
                    tainted.discard(node.target.id)
                for cmp_node in _comparisons_within(node.value):
                    for name in _comparison_operands(cmp_node):
                        if name in tainted:
                            yield cmp_node.lineno, name
        elif isinstance(node, ast.For) and isinstance(node.target, ast.Name):
            if _assigned_taint(node.iter, tainted):
                tainted.add(node.target.id)
            else:
                tainted.discard(node.target.id)
        else:
            for cmp_node in _comparisons_within(node):
                for name in _comparison_operands(cmp_node):
                    if name in tainted:
                        yield cmp_node.lineno, name


def _route_files():
    return sorted(ROUTES_DIR.rglob('*.py'))


def _iter_functions(tree):
    return [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]


def test_no_raw_string_compared_to_integer_column():
    """Every Integer-column comparison must use an int-coerced value."""
    offenders = []
    for path in _route_files():
        tree = ast.parse(path.read_text(encoding='utf-8'), filename=str(path))
        for func in _iter_functions(tree):
            for lineno, name in scan_function(func):
                rel = path.relative_to(ROUTES_DIR.parent)
                offenders.append(
                    f'{rel}:{lineno}: `{name}` may hold a raw string '
                    f'(use safe_int())'
                )

    assert not offenders, (
        'Integer columns compared against raw request/identity strings '
        '(fails on Postgres):\n  ' + '\n  '.join(offenders)
    )


# ── Sanity checks: the scanner must actually detect the bug it guards ───

def _scan_source(source):
    """Run the comparison check over a snippet and return offender names."""
    tree = ast.parse(source)
    return [
        name for func in _iter_functions(tree)
        for _, name in scan_function(func)
    ]


def test_scanner_detects_uncoerced_string():
    bad = (
        'def view():\n'
        "    branch_id = request.args.get('branch_id')\n"
        '    query = query.filter(Vehicle.branch_id == branch_id)\n'
    )
    assert _scan_source(bad) == ['branch_id']


def test_scanner_accepts_coerced_value():
    good = (
        'def view():\n'
        "    branch_id = safe_int(request.args.get('branch_id'))\n"
        '    query = query.filter(Vehicle.branch_id == branch_id)\n'
    )
    assert _scan_source(good) == []


def test_scanner_follows_transitive_taint():
    bad = (
        'def view():\n'
        "    raw = request.args.get('branch_id')\n"
        '    branch_id = raw\n'
        '    query = query.filter(Vehicle.branch_id == branch_id)\n'
    )
    assert _scan_source(bad) == ['branch_id']


def test_scanner_clears_taint_through_int_cast():
    good = (
        'def view():\n'
        "    branch_id = int(request.args.get('branch_id') or 0)\n"
        '    query = query.filter(Vehicle.branch_id == branch_id)\n'
    )
    assert _scan_source(good) == []


def test_scanner_clears_taint_through_effective_branch_id():
    good = (
        'def view():\n'
        "    branch_id = effective_branch_id(user, request.args.get('branch_id'))\n"
        '    query = query.filter(Vehicle.branch_id == branch_id)\n'
    )
    assert _scan_source(good) == []


def test_scanner_ignores_string_column_comparisons():
    """`status` is a String column; comparing it to a request value is fine."""
    ok = (
        'def view():\n'
        "    status = request.args.get('status')\n"
        '    query = query.filter(Vehicle.status == status)\n'
    )
    assert _scan_source(ok) == []


def test_scanner_detects_jwt_identity_comparison():
    bad = (
        'def view():\n'
        '    uid = get_jwt_identity()\n'
        '    query = query.filter(Expense.user_id == uid)\n'
    )
    assert _scan_source(bad) == ['uid']
