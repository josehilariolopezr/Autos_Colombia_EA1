"""Agrega clientes y vínculo opcional de propietario a vehículo.

Revision ID: 0003
Revises: 0002
"""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cliente",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("codigo", sa.Text(), nullable=False),
        sa.Column("nombre", sa.Text(), nullable=False),
        sa.Column("telefono", sa.Text(), nullable=False),
        sa.Column("vencimiento", sa.Date(), nullable=True),
        sa.UniqueConstraint("codigo", name="uq_cliente_codigo"),
        sa.CheckConstraint("codigo ~ '[^[:space:]]'", name="ck_cliente_codigo_no_vacio"),
        sa.CheckConstraint("nombre ~ '[^[:space:]]'", name="ck_cliente_nombre_no_vacio"),
        sa.CheckConstraint("telefono ~ '[^[:space:]]'", name="ck_cliente_telefono_no_vacio"),
    )
    op.add_column("vehiculo", sa.Column("cliente_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        "fk_vehiculo_cliente",
        "vehiculo",
        "cliente",
        ["cliente_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_vehiculo_cliente_id", "vehiculo", ["cliente_id"])


def downgrade() -> None:
    op.drop_index("ix_vehiculo_cliente_id", table_name="vehiculo")
    op.drop_constraint("fk_vehiculo_cliente", "vehiculo", type_="foreignkey")
    op.drop_column("vehiculo", "cliente_id")
    op.drop_table("cliente")
