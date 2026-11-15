"""Registra novedades asociadas a vehículos y estancias.

Revision ID: 0006
Revises: 0005
"""

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "novedad",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("vehiculo_id", sa.BigInteger(), nullable=False),
        sa.Column("estancia_id", sa.BigInteger(), nullable=True),
        sa.Column("operador_id", sa.BigInteger(), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.Column("fecha_registro", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["vehiculo_id"], ["vehiculo.id"], name="fk_novedad_vehiculo", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["estancia_id"], ["estancia.id"], name="fk_novedad_estancia", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["operador_id"], ["operador.id"], name="fk_novedad_operador", ondelete="RESTRICT"),
        sa.CheckConstraint("descripcion ~ '[^[:space:]]'", name="ck_novedad_descripcion_no_vacia"),
    )
    op.create_index("ix_novedad_vehiculo_id", "novedad", ["vehiculo_id"])


def downgrade() -> None:
    op.drop_index("ix_novedad_vehiculo_id", table_name="novedad")
    op.drop_table("novedad")
