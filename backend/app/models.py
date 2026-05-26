from datetime import datetime
from app import db
from werkzeug.security import generate_password_hash, check_password_hash

class Branch(db.Model):
    __tablename__ = 'branches'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200))
    address = db.Column(db.String(200))
    phone = db.Column(db.String(20))
    status = db.Column(db.String(20), default='active')
    monthly_budget = db.Column(db.Float, default=150000.0)

class Customer(db.Model):
    __tablename__ = 'customers'
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(100))
    address = db.Column(db.String(200))
    customer_type = db.Column(db.String(20), default='individual') # individual, corporate
    credit_limit = db.Column(db.Float, default=0.0)
    loyalty_points = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id')) # Where they first registered

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    password_hash = db.Column(db.Text)
    role = db.Column(db.String(20), nullable=False)  # admin, manager, sales, storeman, accountant
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    status = db.Column(db.String(20), default='active')
    branch = db.relationship('Branch', backref='users')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Vehicle(db.Model):
    __tablename__ = 'vehicles'
    id = db.Column(db.Integer, primary_key=True)
    vin = db.Column(db.String(17), unique=True, nullable=False)
    type = db.Column(db.String(20))  # 2-wheel, 3-wheel, 4-wheel
    power_type = db.Column(db.String(20))  # electric, non-electric
    model = db.Column(db.String(100))
    color = db.Column(db.String(50))
    chassis_number = db.Column(db.String(50))
    engine_number = db.Column(db.String(50))
    cost_price = db.Column(db.Float)
    selling_price = db.Column(db.Float)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    status = db.Column(db.String(20), default='available')  # available, sold, reserved, in-transit
    received_date = db.Column(db.DateTime, default=datetime.utcnow)
    image = db.Column(db.String(255))  # Path to item photo

class SparePart(db.Model):
    __tablename__ = 'spare_parts'
    id = db.Column(db.Integer, primary_key=True)
    part_number = db.Column(db.String(50), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50))
    unit_price = db.Column(db.Float)
    cost_price = db.Column(db.Float)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    quantity = db.Column(db.Integer, default=0)
    image = db.Column(db.String(255))  # Path to item photo

class Sale(db.Model):
    __tablename__ = 'sales'
    id = db.Column(db.Integer, primary_key=True)
    sale_number = db.Column(db.String(20), unique=True, nullable=False)
    sale_type = db.Column(db.String(20))  # vehicle, spare_part
    item_id = db.Column(db.Integer)  # ID of vehicle or spare part
    customer_name = db.Column(db.String(100))
    category = db.Column(db.String(50))
    customer_phone = db.Column(db.String(20))
    customer_id_number = db.Column(db.String(50))  # National ID/License number
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True) # Linked CRM ID
    total_amount = db.Column(db.Float, nullable=False)
    cost_at_sale = db.Column(db.Float, default=0.0)
    chassis_number = db.Column(db.String(50))
    motor_number = db.Column(db.String(50))
    receipt_image = db.Column(db.String(255))  # Path to receipt image for bank transfer
    transaction_reference = db.Column(db.String(100))  # Bank transaction reference for the sale
    status = db.Column(db.String(20), default='completed')  # pending, completed, cancelled
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    sale_date = db.Column(db.DateTime, default=datetime.utcnow)
    payments = db.relationship('Payment', backref='sale', lazy=True)

class Payment(db.Model):
    __tablename__ = 'payments'
    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey('sales.id'), nullable=False)
    payment_method = db.Column(db.String(20))  # cash, bank
    bank_name = db.Column(db.String(50))
    account_holder = db.Column(db.String(50))  # Tewelde, Berihu, Mulugeta, or custom
    amount = db.Column(db.Float, nullable=False)
    transaction_reference = db.Column(db.String(100))
    receipt_image = db.Column(db.String(255)) # Path to uploaded image
    payment_date = db.Column(db.DateTime, default=datetime.utcnow)

class Order(db.Model):
    __tablename__ = 'orders'
    id = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(100))
    customer_phone = db.Column(db.String(20))
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    vehicle_specs = db.Column(db.Text)
    sequence_number = db.Column(db.Integer)
    deposit_amount = db.Column(db.Float, default=0.0)
    order_date = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='waiting')  # waiting, fulfilled, cancelled
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))

class Transfer(db.Model):
    __tablename__ = 'transfers'
    id = db.Column(db.Integer, primary_key=True)
    from_branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    to_branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    item_type = db.Column(db.String(20))  # vehicle, spare_part
    item_id = db.Column(db.Integer)
    quantity = db.Column(db.Integer, default=1)
    request_date = db.Column(db.DateTime, default=datetime.utcnow)
    approval_status = db.Column(db.String(20), default='pending')  # pending, approved, rejected, completed
    completed_date = db.Column(db.DateTime)
    requested_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))

class Purchase(db.Model):
    __tablename__ = 'purchases'
    id = db.Column(db.Integer, primary_key=True)
    supplier_name = db.Column(db.String(100))
    purchase_date = db.Column(db.DateTime, default=datetime.utcnow)
    item_type = db.Column(db.String(20))
    total_amount = db.Column(db.Float)
    payment_method = db.Column(db.String(20))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    receipt_attachment = db.Column(db.String(255))

class PurchaseItem(db.Model):
    __tablename__ = 'purchase_items'
    id = db.Column(db.Integer, primary_key=True)
    purchase_id = db.Column(db.Integer, db.ForeignKey('purchases.id'), nullable=False)
    item_description = db.Column(db.String(200))
    quantity = db.Column(db.Integer)
    unit_cost = db.Column(db.Float)

class Expense(db.Model):
    __tablename__ = 'expenses'
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(50))
    description = db.Column(db.Text)
    amount = db.Column(db.Float, nullable=False)
    expense_date = db.Column(db.DateTime, default=datetime.utcnow)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    receipt_attachment = db.Column(db.String(255))
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))

class ActivityLog(db.Model):
    __tablename__ = 'activity_logs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    action = db.Column(db.String(100))
    description = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
