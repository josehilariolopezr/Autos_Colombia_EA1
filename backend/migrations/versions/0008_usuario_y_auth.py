"""Crea la tabla usuario y siembra credenciales iniciales de administrador y operador.

Revision ID: 0008
Revises: 0007
"""

from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "usuario",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("nombre", sa.Text(), nullable=False),
        sa.Column("documento", sa.Text(), nullable=False),
        sa.Column("correo", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("rol", sa.Text(), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("operador_id", sa.BigInteger(), nullable=True),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["operador_id"], ["operador.id"], name="fk_usuario_operador", ondelete="SET NULL"),
        sa.UniqueConstraint("documento", name="uq_usuario_documento"),
        sa.UniqueConstraint("correo", name="uq_usuario_correo"),
        sa.CheckConstraint("nombre ~ '[^[:space:]]'", name="ck_usuario_nombre_no_vacio"),
        sa.CheckConstraint("documento ~ '[^[:space:]]'", name="ck_usuario_documento_no_vacio"),
        sa.CheckConstraint("correo ~ '[^[:space:]]'", name="ck_usuario_correo_no_vacio"),
        sa.CheckConstraint("password_hash ~ '[^[:space:]]'", name="ck_usuario_password_hash_no_vacio"),
        sa.CheckConstraint("rol IN ('ADMINISTRADOR', 'OPERADOR')", name="ck_usuario_rol"),
    )
    op.create_index("ix_usuario_correo", "usuario", ["correo"])
    op.create_index("ix_usuario_documento", "usuario", ["documento"])

    usuario_table = sa.table(
        "usuario",
        sa.column("nombre", sa.Text),
        sa.column("documento", sa.Text),
        sa.column("correo", sa.Text),
        sa.column("password_hash", sa.Text),
        sa.column("rol", sa.Text),
        sa.column("activo", sa.Boolean),
        sa.column("operador_id", sa.BigInteger),
    )
    op.bulk_insert(
        usuario_table,
        [
            {
                "nombre": "Administrador General",
                "documento": "1000000001",
                "correo": "admin@autoscolombia.com",
                "password_hash": "$2b$12$npE4fI8vLrcTkkEhZR2NxeE1uzx/3wAyOL.QAKV59.384uzM4hU2W",
                "rol": "ADMINISTRADOR",
                "activo": True,
                "operador_id": None,
            },
            {
                "nombre": "Operador de Turno",
                "documento": "1000000002",
                "correo": "operador@autoscolombia.com",
                "password_hash": "$2b$12$Hfr/qDTWvUFifFLHuqku8uzClhwAce9tG028MYg35ZhULcS7TwjqO",
                "rol": "OPERADOR",
                "activo": True,
                "operador_id": None,
            },
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_usuario_documento", table_name="usuario")
    op.drop_index("ix_usuario_correo", table_name="usuario")
    op.drop_table("usuario")
