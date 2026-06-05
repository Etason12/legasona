"""Add cancellation and refund fields to Order

Revision ID: c3f9a7b2e5d8
Revises: d1958e77c274
Create Date: 2026-06-05 21:22:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3f9a7b2e5d8'
down_revision = 'd1958e77c274'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('cancelled_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('cancelled_by', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('cancellation_reason', sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column('refund_amount', sa.Float(), nullable=True, server_default='0.0'))
        batch_op.add_column(sa.Column('refund_method', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('refund_bank', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('refund_transaction_reference', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('refund_date', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.drop_column('refund_date')
        batch_op.drop_column('refund_transaction_reference')
        batch_op.drop_column('refund_bank')
        batch_op.drop_column('refund_method')
        batch_op.drop_column('refund_amount')
        batch_op.drop_column('cancellation_reason')
        batch_op.drop_column('cancelled_by')
        batch_op.drop_column('cancelled_at')
