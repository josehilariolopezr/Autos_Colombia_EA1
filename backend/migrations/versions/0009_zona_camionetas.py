"""Renombra la zona de celdas P a C para camionetas.

Revision ID: 0009
Revises: 0008
"""

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM celda AS anterior
                JOIN celda AS nueva
                  ON nueva.codigo = 'C' || substring(anterior.codigo FROM 2)
                WHERE anterior.codigo LIKE 'P-%'
            ) THEN
                RAISE EXCEPTION
                    'No se pueden renombrar celdas P a C: ya existe al menos un código C equivalente.';
            END IF;

            UPDATE celda
            SET codigo = 'C' || substring(codigo FROM 2)
            WHERE codigo LIKE 'P-%';

            UPDATE celda
            SET tipo = 'CAMIONETA'
            WHERE upper(tipo) = 'PESADO';
        END
        $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM celda AS actual
                JOIN celda AS anterior
                  ON anterior.codigo = 'P' || substring(actual.codigo FROM 2)
                WHERE actual.codigo LIKE 'C-%'
            ) THEN
                RAISE EXCEPTION
                    'No se pueden revertir celdas C a P: ya existe al menos un código P equivalente.';
            END IF;

            UPDATE celda
            SET tipo = 'PESADO'
            WHERE codigo LIKE 'C-%' AND upper(tipo) = 'CAMIONETA';

            UPDATE celda
            SET codigo = 'P' || substring(codigo FROM 2)
            WHERE codigo LIKE 'C-%';
        END
        $$;
        """
    )
