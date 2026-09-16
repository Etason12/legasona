from app.models import Customer, db


def ensure_customer(data, branch_id=None):
    """Create a Customer record if one doesn't exist for this phone number.

    Looks up by customer_id first, then by phone. If a new customer is
    created, uses the provided branch_id. Returns the customer_id or None.
    """
    customer_id = data.get('customer_id')
    name = (data.get('customer_name') or '').strip()
    if name:
        name = name.title()
    phone = (data.get('customer_phone') or '').strip()
    if not customer_id and name and phone:
        existing = Customer.query.filter_by(phone=phone).first()
        if existing:
            customer_id = existing.id
        else:
            customer = Customer(full_name=name, phone=phone, branch_id=branch_id)
            db.session.add(customer)
            db.session.flush()
            customer_id = customer.id
    return customer_id
