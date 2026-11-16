from io import StringIO
from pathlib import Path

from alembic import command
from alembic.config import Config


def test_migracion_de_zona_camionetas_genera_sql_seguro():
    root = Path(__file__).resolve().parents[1]
    output = StringIO()
    config = Config(str(root / "alembic.ini"), output_buffer=output)

    command.upgrade(config, "0008:head", sql=True)

    sql = output.getvalue()
    assert "Running upgrade 0008 -> 0009" in sql
    assert "'C' || substring(codigo FROM 2)" in sql
    assert "upper(tipo) = 'PESADO'" in sql
    assert "RAISE EXCEPTION" in sql
