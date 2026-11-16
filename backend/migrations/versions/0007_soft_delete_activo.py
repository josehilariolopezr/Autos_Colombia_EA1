"""Agrega banderas de desactivación lógica a registros maestros.

Revision ID: 0007
Revises: 0006
"""

from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("cliente", "vehiculo", "operador"):
        op.add_column(
            table,
            sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        )


def downgrade() -> None:
    for table in ("operador", "vehiculo", "cliente"):
        op.drop_column(table, "activo")
