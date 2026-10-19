from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Expense, Branch, User, db
from app.utils.auth import role_required, effective_branch_id, user_can_access_branch
from app.utils.image_utils import compress_to_base64
from app.utils.validation import safe_float, safe_int, truncate
from datetime import datetime, timezone

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
        file        = request.files.get('receipt')
    else:
        data        = request.get_json() or {}
        category    = data.get('category')
        description = data.get('description')
        amount      = data.get('amount')
        branch_id   = data.get('branch_id')
        file        = None

    receipt_data = compress_to_base64(file)
    current_user_id = int(get_jwt_identity())
    current_user = db.session.get(User, current_user_id)

    # Non-admins may only record expenses against their own branch.
    branch_id = effective_branch_id(current_user, branch_id)
    if not branch_id:
        return jsonify({'message': 'Branch ID is required'}), 400

    parsed_amount = safe_float(amount, default=None, min_val=0)
    if parsed_amount is None or parsed_amount <= 0:
        return jsonify({'message': 'A valid amount is required'}), 400

    new_expense = Expense(
        category=truncate(category, 50), description=description, amount=parsed_amount,
        branch_id=safe_int(branch_id), user_id=current_user_id, receipt_attachment=receipt_data
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
    user_id    = request.args.get('user_id')
    current_user_id = get_jwt_identity()
    current_user = db.session.get(User, current_user_id)

    query = Expense.query.outerjoin(User, Expense.user_id == User.id).add_columns(User.username.label('user_name'))

    branch_id = effective_branch_id(current_user, branch_id)
    if branch_id:
        query = query.filter(Expense.branch_id == branch_id)
    if start_date:
        query = query.filter(Expense.expense_date >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Expense.expense_date <= datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59))
    if category:
        query = query.filter(Expense.category == category)
    # Only admins may look at another user's expenses; everyone else is
    # limited to records they created (prevents ?user_id= bypass).
    if current_user.role == 'admin':
        if user_id:
            query = query.filter(Expense.user_id == safe_int(user_id))
    else:
        query = query.filter(Expense.user_id == current_user_id)

    rows = query.order_by(Expense.expense_date.desc()).all()
    return jsonify([{
        'id': e.Expense.id, 'category': e.Expense.category, 'description': e.Expense.description,
        'amount': e.Expense.amount, 'expense_date': e.Expense.expense_date.isoformat(),
        'branch_id': e.Expense.branch_id, 'receipt_attachment': e.Expense.receipt_attachment,
        'user_name': e.user_name, 'user_id': e.Expense.user_id
    } for e in rows]), 200

@expenses_bp.route('/users', methods=['GET'])
@jwt_required()
def get_expense_users():
    current_user_id = get_jwt_identity()
    current_user = db.session.get(User, current_user_id)
    query = User.query
    if current_user.role != 'admin':
        query = query.filter(User.id == current_user_id)
    users = query.order_by(User.username).all()
    return jsonify([{'id': u.id, 'username': u.username, 'role': u.role} for u in users]), 200

@expenses_bp.route('/budget', methods=['PATCH'])
@jwt_required()
@role_required('admin', 'manager')
def update_budget():
    data = request.get_json() or {}
    branch_id = data.get('branch_id')
    monthly_budget = data.get('monthly_budget')
    if monthly_budget is None:
        return jsonify({'message': 'monthly_budget is required'}), 400
    budget_value = safe_float(monthly_budget, default=None, min_val=0)
    if budget_value is None:
        return jsonify({'message': 'monthly_budget must be a number'}), 400

    current_user = db.session.get(User, get_jwt_identity())
    branch_id = effective_branch_id(current_user, branch_id)
    if current_user.role != 'admin' and not branch_id:
        return jsonify({'message': 'No branch assigned to your account'}), 403

    if branch_id:
        branch = db.session.get(Branch, safe_int(branch_id))
        if not branch:
            return jsonify({'message': 'Branch not found'}), 404
        branch.monthly_budget = budget_value
    else:
        branches = Branch.query.all()
        for b in branches:
            b.monthly_budget = budget_value

    db.session.commit()
    return jsonify({'message': 'Budget updated'}), 200


@expenses_bp.route('/budget', methods=['GET'])
@jwt_required()
def get_budget():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    # Non-admins are always limited to their own branch; admins may pass
    # branch_id explicitly or omit it to aggregate every branch.
    branch_id = effective_branch_id(user, request.args.get('branch_id'))

    from datetime import date
    today = date.today()
    first_of_month = today.replace(day=1)

    total_spent = db.session.query(db.func.sum(Expense.amount)).filter(
        Expense.expense_date >= first_of_month,
        Expense.expense_date <= today
    )
    
    # If user has a branch, restrict to that branch. Admin without branch restriction sees all.
    if branch_id:
        total_spent = total_spent.filter(Expense.branch_id == branch_id)
    elif user.role != 'admin':
        # Fallback if a user somehow has no branch assigned but isn't admin
        total_spent = total_spent.filter(Expense.branch_id == -1)

    total_spent = total_spent.scalar() or 0

    if branch_id:
        branch = db.session.get(Branch, branch_id)
        budget = float(branch.monthly_budget) if branch and branch.monthly_budget is not None else 150000.0
    elif user.role == 'admin':
        budget = db.session.query(db.func.sum(Branch.monthly_budget)).scalar() or 150000.0
    else:
        budget = 0.0

    return jsonify({
        'budget': float(budget),
        'spent': float(total_spent),
        'remaining': float(budget) - float(total_spent)
    }), 200

@expenses_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@role_required('admin', 'manager')
def delete_expense(id):
    expense = db.get_or_404(Expense, id)
    current_user = db.session.get(User, get_jwt_identity())
    if not user_can_access_branch(current_user, expense.branch_id):
        return jsonify({'message': 'Expense not found'}), 404
    db.session.delete(expense)
    db.session.commit()
    return jsonify({'message': 'Expense deleted'}), 200
