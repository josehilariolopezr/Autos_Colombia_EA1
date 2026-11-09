"""Agrega el estado operativo de mantenimiento a las celdas.

Revision ID: 0005
Revises: 0004
"""

from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("celda", sa.Column("estado", sa.Text(), server_default="ACTIVA", nullable=False))
    op.create_check_constraint("ck_celda_estado", "celda", "estado IN ('ACTIVA', 'MANTENIMIENTO')")


def downgrade() -> None:
    op.drop_constraint("ck_celda_estado", "celda", type_="check")
    op.drop_column("celda", "estado")
