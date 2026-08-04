"""Add quantity to Sale

Revision ID: a1b2c3d4e5f6
Revises: c3f9a7b2e5d8
Create Date: 2026-07-31 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'c3f9a7b2e5d8'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('sales', schema=None) as batch_op:
        batch_op.add_column(sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'))


def downgrade():
    with op.batch_alter_table('sales', schema=None) as batch_op:
        batch_op.drop_column('quantity')
