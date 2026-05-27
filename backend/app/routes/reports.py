from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from app.models import Sale, Payment, Expense, Vehicle, SparePart, Branch, Order, ActivityLog, User, db
from sqlalchemy import func
from datetime import datetime, timedelta

reports_bp = Blueprint('reports', __name__)

def _date_filter(q, model_field, start_date, end_date):
    if start_date:
        q = q.filter(model_field >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(model_field <= datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59))
    return q

@reports_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    branch_id = request.args.get('branch_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    sales_q   = db.session.query(func.sum(Sale.total_amount))
    orders_q  = Order.query.filter(Order.status == 'waiting')
    vehicle_q = db.session.query(func.sum(Vehicle.selling_price)).filter(Vehicle.status == 'available')

    if branch_id:
        sales_q   = sales_q.filter(Sale.branch_id == branch_id)
        orders_q  = orders_q.filter(Order.branch_id == branch_id)
        vehicle_q = vehicle_q.filter(Vehicle.branch_id == branch_id)

    sales_q = _date_filter(sales_q, Sale.sale_date, start_date, end_date)

    total_sales_amount  = sales_q.scalar() or 0
    active_orders_count = orders_q.count()
    vehicle_value       = vehicle_q.scalar() or 0

    # Revenue for selected period
    monthly_rev_q   = db.session.query(func.sum(Sale.total_amount))
    if branch_id:
        monthly_rev_q = monthly_rev_q.filter(Sale.branch_id == branch_id)
    monthly_rev_q = _date_filter(monthly_rev_q, Sale.sale_date, start_date, end_date)
    monthly_revenue = monthly_rev_q.scalar() or 0

    # Previous period for trend comparison
    if start_date:
        sd = datetime.fromisoformat(start_date)
        prev_end = sd - timedelta(days=1)
        prev_start = prev_end - timedelta(days=30)
        prev_rev_q = db.session.query(func.sum(Sale.total_amount))
        if branch_id:
            prev_rev_q = prev_rev_q.filter(Sale.branch_id == branch_id)
        prev_rev_q = _date_filter(prev_rev_q, Sale.sale_date, prev_start.date().isoformat(), prev_end.date().isoformat())
        prev_revenue = prev_rev_q.scalar() or 0
    else:
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        sixty_days_ago  = datetime.utcnow() - timedelta(days=60)
        prev_rev_q     = db.session.query(func.sum(Sale.total_amount)).filter(
            Sale.sale_date >= sixty_days_ago, Sale.sale_date < thirty_days_ago)
        if branch_id:
            prev_rev_q = prev_rev_q.filter(Sale.branch_id == branch_id)
        prev_revenue = prev_rev_q.scalar() or 0

    def pct_change(current, previous):
        if previous == 0:
            return ('+100%' if current > 0 else '0%'), 'up'
        diff = ((current - previous) / previous) * 100
        sign = '+' if diff >= 0 else ''
        return f'{sign}{diff:.1f}%', ('up' if diff >= 0 else 'down')

    rev_change, rev_trend = pct_change(monthly_revenue, prev_revenue)

    # Chart Data — last 6 months (or selected range)
    chart_data = []
    if start_date and end_date:
        sd = datetime.fromisoformat(start_date)
        ed = datetime.fromisoformat(end_date)
        delta = (ed - sd).days
        if delta > 365:
            intervals = [(sd + timedelta(days=i * (delta // 11)), (ed if i == 11 else sd + timedelta(days=(i + 1) * (delta // 11) - 1))) for i in range(12)]
        else:
            intervals = [(sd.replace(day=1) + timedelta(days=i * 30), (sd.replace(day=1) + timedelta(days=(i + 1) * 30 - 1)).replace(hour=23, minute=59, second=59)) for i in range(max(1, delta // 30 + 1))]
        for start_of_month, end_of_month in intervals:
            sales_month_q = db.session.query(func.sum(Sale.total_amount)).filter(
                Sale.sale_date >= start_of_month, Sale.sale_date <= end_of_month)
            if branch_id:
                sales_month_q = sales_month_q.filter(Sale.branch_id == branch_id)
            chart_data.append({
                'month': start_of_month.strftime('%b %d'),
                'sales': float(sales_month_q.scalar() or 0)
            })
    else:
        current_date = datetime.utcnow()
        for i in range(5, -1, -1):
            month_date     = current_date - timedelta(days=i * 30)
            start_of_month = month_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if start_of_month.month == 12:
                next_month = start_of_month.replace(year=start_of_month.year + 1, month=1)
            else:
                next_month = start_of_month.replace(month=start_of_month.month + 1)

            sales_month_q = db.session.query(func.sum(Sale.total_amount)).filter(
                Sale.sale_date >= start_of_month, Sale.sale_date < next_month)
            if branch_id:
                sales_month_q = sales_month_q.filter(Sale.branch_id == branch_id)

            chart_data.append({
                'month': start_of_month.strftime('%b'),
                'sales': float(sales_month_q.scalar() or 0)
            })

    title_prefix = f"Branch {branch_id}" if branch_id else "Total Company"
    return jsonify({
        'stats': [
            {'name': f'{title_prefix} Sales', 'value': f'ETB {total_sales_amount:,.0f}',
             'change': rev_change, 'trend': rev_trend},
            {'name': 'Active Waiting List', 'value': str(active_orders_count),
             'change': '+0', 'trend': 'up'},
            {'name': 'Inventory Value (Available)', 'value': f'ETB {vehicle_value:,.0f}',
             'change': '—', 'trend': 'up'},
            {'name': 'Last 30 Days Revenue', 'value': f'ETB {monthly_revenue:,.0f}',
             'change': rev_change, 'trend': rev_trend},
        ],
        'chart_data': chart_data
    }), 200


@reports_bp.route('/profit-analysis', methods=['GET'])
@jwt_required()
def get_profit_analysis():
    branch_id = request.args.get('branch_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    sales_q    = db.session.query(
        func.sum(Sale.total_amount).label('revenue'),
        func.sum(Sale.cost_at_sale).label('cogs')
    )
    expenses_q = db.session.query(func.sum(Expense.amount))

    if branch_id:
        sales_q    = sales_q.filter(Sale.branch_id == branch_id)
        expenses_q = expenses_q.filter(Expense.branch_id == branch_id)

    sales_q    = _date_filter(sales_q, Sale.sale_date, start_date, end_date)
    expenses_q = _date_filter(expenses_q, Expense.expense_date, start_date, end_date)

    sales_stats    = sales_q.first()
    revenue        = sales_stats.revenue or 0
    cogs           = sales_stats.cogs or 0
    total_expenses = expenses_q.scalar() or 0

    gross_profit = revenue - cogs
    net_profit   = gross_profit - total_expenses

    return jsonify({
        'revenue':      float(revenue),
        'cogs':         float(cogs),
        'expenses':     float(total_expenses),
        'gross_profit': float(gross_profit),
        'net_profit':   float(net_profit),
        'margin':       round((net_profit / revenue * 100), 2) if revenue > 0 else 0
    }), 200


@reports_bp.route('/payments', methods=['GET'])
@jwt_required()
def get_payment_report():
    branch_id = request.args.get('branch_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    query = db.session.query(Payment, Sale).join(Sale, Payment.sale_id == Sale.id)

    if branch_id:
        query = query.filter(Sale.branch_id == branch_id)

    query = _date_filter(query, Payment.payment_date, start_date, end_date)

    query = query.order_by(Payment.payment_date.desc()).all()

    return jsonify([{
        'customer_name':        sale.customer_name,
        'payment_date':         payment.payment_date.isoformat(),
        'amount':               float(payment.amount),
        'bank_name':            payment.bank_name.upper() if payment.bank_name else None,
        'account_holder':       payment.account_holder.upper() if payment.account_holder else None,
        'transaction_reference': payment.transaction_reference.upper() if payment.transaction_reference else None,
        'payment_method':       payment.payment_method,
        'sale_number':          sale.sale_number,
    } for payment, sale in query]), 200


@reports_bp.route('/branch-comparison', methods=['GET'])
@jwt_required()
def get_branch_comparison():
    branches = Branch.query.all()
    result = []
    for b in branches:
        rev = db.session.query(func.sum(Sale.total_amount)).filter(Sale.branch_id == b.id).scalar() or 0
        count = Sale.query.filter(Sale.branch_id == b.id).count()
        vehicle_count = Vehicle.query.filter(Vehicle.branch_id == b.id).count()
        part_count = SparePart.query.filter(SparePart.branch_id == b.id).count()
        result.append({
            'id': b.id,
            'name': b.name,
            'revenue': float(rev),
            'sales_count': count,
            'vehicle_count': vehicle_count,
            'spare_part_count': part_count,
        })
    return jsonify(result), 200


@reports_bp.route('/inventory-distribution', methods=['GET'])
@jwt_required()
def get_inventory_distribution():
    vehicle_types = db.session.query(Vehicle.type, func.count(Vehicle.id)).group_by(Vehicle.type).all()
    vehicle_power = db.session.query(Vehicle.power_type, func.count(Vehicle.id)).group_by(Vehicle.power_type).all()
    part_categories = db.session.query(SparePart.category, func.count(SparePart.id)).group_by(SparePart.category).all()

    return jsonify({
        'vehicle_types': [{'name': t or 'Unknown', 'count': c} for t, c in vehicle_types],
        'vehicle_power': [{'name': p or 'Unknown', 'count': c} for p, c in vehicle_power],
        'part_categories': [{'name': cat or 'Uncategorized', 'count': c} for cat, c in part_categories],
    }), 200


@reports_bp.route('/activity', methods=['GET'])
@jwt_required()
def get_activity_log():
    """Recent activity log for the dashboard feed."""
    branch_id = request.args.get('branch_id')
    limit     = int(request.args.get('limit', 10))

    logs = (ActivityLog.query
            .order_by(ActivityLog.timestamp.desc())
            .limit(limit)
            .all())

    result = []
    for log in logs:
        user = User.query.get(log.user_id)
        result.append({
            'id':          log.id,
            'action':      log.action,
            'description': log.description,
            'timestamp':   log.timestamp.isoformat(),
            'username':    user.username if user else 'System',
        })
    return jsonify(result), 200
