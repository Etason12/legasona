from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from app.models import Sale, Payment, Expense, Vehicle, Order, ActivityLog, User, db
from sqlalchemy import func
from datetime import datetime, timedelta

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    branch_id = request.args.get('branch_id')

    sales_q   = db.session.query(func.sum(Sale.total_amount))
    orders_q  = Order.query.filter(Order.status == 'waiting')
    vehicle_q = db.session.query(func.sum(Vehicle.selling_price)).filter(Vehicle.status == 'available')

    if branch_id:
        sales_q   = sales_q.filter(Sale.branch_id == branch_id)
        orders_q  = orders_q.filter(Order.branch_id == branch_id)
        vehicle_q = vehicle_q.filter(Vehicle.branch_id == branch_id)

    total_sales_amount  = sales_q.scalar() or 0
    active_orders_count = orders_q.count()
    vehicle_value       = vehicle_q.scalar() or 0

    # Monthly Revenue — last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    monthly_rev_q   = db.session.query(func.sum(Sale.total_amount)).filter(Sale.sale_date >= thirty_days_ago)
    if branch_id:
        monthly_rev_q = monthly_rev_q.filter(Sale.branch_id == branch_id)
    monthly_revenue = monthly_rev_q.scalar() or 0

    # Previous 30-day window for real trend calculation
    sixty_days_ago   = datetime.utcnow() - timedelta(days=60)
    prev_rev_q       = db.session.query(func.sum(Sale.total_amount)).filter(
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

    # Chart Data — last 6 months
    chart_data   = []
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

    sales_q    = db.session.query(
        func.sum(Sale.total_amount).label('revenue'),
        func.sum(Sale.cost_at_sale).label('cogs')
    )
    expenses_q = db.session.query(func.sum(Expense.amount))

    if branch_id:
        sales_q    = sales_q.filter(Sale.branch_id == branch_id)
        expenses_q = expenses_q.filter(Expense.branch_id == branch_id)

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

    query = db.session.query(Payment, Sale).join(Sale, Payment.sale_id == Sale.id)

    if branch_id:
        query = query.filter(Sale.branch_id == branch_id)

    query = query.order_by(Payment.payment_date.desc()).all()

    return jsonify([{
        'customer_name':        sale.customer_name,
        'payment_date':         payment.payment_date.isoformat(),
        'amount':               float(payment.amount),
        'bank_name':            payment.bank_name,
        'account_holder':       payment.account_holder,
        'transaction_reference': payment.transaction_reference,
        'payment_method':       payment.payment_method,
        'sale_number':          sale.sale_number,
    } for payment, sale in query]), 200


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
