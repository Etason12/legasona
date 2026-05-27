"""Backfill Customer records from sales/orders

Revision ID: e2e314116bc0
Revises: 1d0eeeb0adbf
Create Date: 2026-05-27 21:00:04.523125

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e2e314116bc0'
down_revision = '1d0eeeb0adbf'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Create Customer records from sales that have name/phone but no customer_id
    conn.execute(sa.text("""
        INSERT INTO customers (full_name, phone, branch_id)
        SELECT DISTINCT s.customer_name, s.customer_phone, s.branch_id
        FROM sales s
        WHERE s.customer_id IS NULL
          AND s.customer_name IS NOT NULL AND s.customer_name != ''
          AND s.customer_phone IS NOT NULL AND s.customer_phone != ''
    """))

    # Link those sales to the newly created customers
    conn.execute(sa.text("""
        UPDATE sales SET customer_id = (
            SELECT c.id FROM customers c WHERE c.phone = sales.customer_phone
        )
        WHERE customer_id IS NULL
          AND customer_name IS NOT NULL AND customer_name != ''
          AND customer_phone IS NOT NULL AND customer_phone != ''
    """))

    # Same for orders (skip phones already registered as customers)
    conn.execute(sa.text("""
        INSERT INTO customers (full_name, phone, branch_id)
        SELECT DISTINCT o.customer_name, o.customer_phone, o.branch_id
        FROM orders o
        WHERE o.customer_id IS NULL
          AND o.customer_name IS NOT NULL AND o.customer_name != ''
          AND o.customer_phone IS NOT NULL AND o.customer_phone != ''
          AND o.customer_phone NOT IN (SELECT phone FROM customers WHERE phone IS NOT NULL)
    """))

    conn.execute(sa.text("""
        UPDATE orders SET customer_id = (
            SELECT c.id FROM customers c WHERE c.phone = orders.customer_phone
        )
        WHERE customer_id IS NULL
          AND customer_name IS NOT NULL AND customer_name != ''
          AND customer_phone IS NOT NULL AND customer_phone != ''
    """))


def downgrade():
    pass
