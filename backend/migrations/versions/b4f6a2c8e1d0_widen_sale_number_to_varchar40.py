"""Widen sale_number to VARCHAR(40)

The sale number generator produces numbers like VS-YYYYMMDDHHMMSS-XXXX
which are 22 characters long, exceeding the previous VARCHAR(20) limit
and causing a DataError (and 500 error) when recording sales on
PostgreSQL. Widen the column to 40 characters.

Revision ID: b4f6a2c8e1d0
Revises: a1b2c3d4e5f6
Create Date: 2026-08-07 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b4f6a2c8e1d0'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('sales', schema=None) as batch_op:
        batch_op.alter_column('sale_number',
               existing_type=sa.VARCHAR(length=20),
               type_=sa.String(length=40),
               existing_nullable=False)


def downgrade():
    with op.batch_alter_table('sales', schema=None) as batch_op:
        batch_op.alter_column('sale_number',
               existing_type=sa.String(length=40),
               type_=sa.VARCHAR(length=20),
               existing_nullable=False)
