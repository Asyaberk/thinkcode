"""add_week_name_to_course_resources

Revision ID: a73ab93f2950
Revises: a1b2c3d4e5f6
Create Date: 2026-04-06 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'a73ab93f2950'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('course_resources', sa.Column('week_name', sa.String(length=100), nullable=True))

def downgrade() -> None:
    op.drop_column('course_resources', 'week_name')
