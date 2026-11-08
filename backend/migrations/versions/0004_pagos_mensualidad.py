"""Registra pagos de mensualidad y vigencia asociada.

Revision ID: 0004
Revises: 0003
"""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pago_mensualidad",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("cliente_id", sa.BigInteger(), nullable=False),
        sa.Column("operador_id", sa.BigInteger(), nullable=False),
        sa.Column("vehiculo_id", sa.BigInteger(), nullable=False),
        sa.Column("valor", sa.Integer(), nullable=False),
        sa.Column("metodo_pago", sa.Text(), nullable=False),
        sa.Column("fecha_pago", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("fecha_inicio", sa.Date(), nullable=False),
        sa.Column("fecha_fin", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(["cliente_id"], ["cliente.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["operador_id"], ["operador.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["vehiculo_id"], ["vehiculo.id"], ondelete="RESTRICT"),
        sa.CheckConstraint("valor > 0", name="ck_pago_mensualidad_valor_positivo"),
        sa.CheckConstraint("metodo_pago IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA')", name="ck_pago_mensualidad_metodo"),
        sa.CheckConstraint("fecha_fin >= fecha_inicio", name="ck_pago_mensualidad_fechas"),
    )


def downgrade() -> None:
    op.drop_table("pago_mensualidad")
