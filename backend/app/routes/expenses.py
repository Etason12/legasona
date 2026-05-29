from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Expense, Branch, db
from app.utils.auth import role_required
from app.utils.image_utils import compress_to_base64
from datetime import datetime

expenses_bp = Blueprint('expenses', __name__)

@expenses_bp.route('', methods=['POST'])
@jwt_required()
@role_required('admin', 'manager', 'accountant', 'storekeeper')
def create_expense():
    if request.content_type and 'multipart/form-data' in request.content_type:
        category    = request.form.get('category')
        description = request.form.get('description')
        amount      = request.form.get('amount')
        branch_id   = request.form.get('branch_id')
        user_id     = request.form.get('user_id')
        file        = request.files.get('receipt')
    else:
        data        = request.get_json()
        category    = data.get('category')
        description = data.get('description')
        amount      = data.get('amount')
        branch_id   = data.get('branch_id')
        user_id     = data.get('user_id')
        file        = None

    receipt_data = compress_to_base64(file)

    new_expense = Expense(
        category=category, description=description, amount=amount,
        branch_id=branch_id, user_id=user_id, receipt_attachment=receipt_data
    )
    db.session.add(new_expense)
    db.session.commit()
    return jsonify({'message': 'Expense recorded'}), 201

@expenses_bp.route('', methods=['GET'])
@jwt_required()
def get_expenses():
    branch_id  = request.args.get('branch_id')
    start_date = request.args.get('start_date')
    end_date   = request.args.get('end_date')
    category   = request.args.get('category')

    query = Expense.query
    if branch_id:
        query = query.filter(Expense.branch_id == branch_id)
    if start_date:
        query = query.filter(Expense.expense_date >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Expense.expense_date <= datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59))
    if category:
        query = query.filter(Expense.category == category)

    expenses = query.order_by(Expense.expense_date.desc()).all()
    return jsonify([{
        'id': e.id, 'category': e.category, 'description': e.description,
        'amount': e.amount, 'expense_date': e.expense_date.isoformat(),
        'branch_id': e.branch_id, 'receipt_attachment': e.receipt_attachment
    } for e in expenses]), 200

@expenses_bp.route('/budget', methods=['PATCH'])
@jwt_required()
@role_required('admin', 'manager')
def update_budget():
    data = request.get_json()
    branch_id = data.get('branch_id')
    monthly_budget = data.get('monthly_budget')
    if monthly_budget is None:
        return jsonify({'message': 'monthly_budget is required'}), 400

    if branch_id:
        branch = Branch.query.get(branch_id)
        if not branch:
            return jsonify({'message': 'Branch not found'}), 404
        branch.monthly_budget = float(monthly_budget)
    else:
        branches = Branch.query.all()
        for b in branches:
            b.monthly_budget = float(monthly_budget)

    db.session.commit()
    return jsonify({'message': 'Budget updated'}), 200


@expenses_bp.route('/budget', methods=['GET'])
@jwt_required()
def get_budget():
    user_id = get_jwt_identity()
    from app.models import User
    user = User.query.get(user_id)
    branch_id = request.args.get('branch_id') or (user.branch_id if user.role != 'admin' else None)

    from datetime import date
    today = date.today()
    first_of_month = today.replace(day=1)

    total_spent = db.session.query(db.func.sum(Expense.amount)).filter(
        Expense.expense_date >= first_of_month,
        Expense.expense_date <= today
    )
    if branch_id:
        total_spent = total_spent.filter(Expense.branch_id == branch_id)
    total_spent = total_spent.scalar() or 0

    budget = 150000.0
    if branch_id:
        branch = Branch.query.get(branch_id)
        if branch:
            budget = branch.monthly_budget or 150000.0

    return jsonify({
        'budget': budget,
        'spent': float(total_spent),
        'remaining': budget - float(total_spent)
    }), 200

@expenses_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@role_required('admin', 'manager')
def delete_expense(id):
    expense = Expense.query.get_or_404(id)
    db.session.delete(expense)
    db.session.commit()
    return jsonify({'message': 'Expense deleted'}), 200
