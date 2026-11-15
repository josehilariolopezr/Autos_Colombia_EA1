import importlib.util
from io import StringIO
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from app.models import Base, Celda, Novedad, Operador, Vehiculo


def test_normalizes_unique_identifiers_on_creation_and_assignment():
    vehicle = Vehiculo(placa=" \tabc123\n", color="Azul", modelo=2025, marca="Marca", tipo="MOTO")
    cell = Celda(codigo=" a-01 ", tipo="Libre")
    assert vehicle.placa == "ABC123"
    assert cell.codigo == "A-01"
    vehicle.placa = " xyz789 "
    cell.codigo = " b-02 "
    assert vehicle.placa == "XYZ789"
    assert cell.codigo == "B-02"


@pytest.mark.parametrize("model,attribute", [
    (Vehiculo, "placa"), (Vehiculo, "color"), (Vehiculo, "marca"),
    (Vehiculo, "tipo"), (Celda, "codigo"), (Celda, "tipo"),
    (Operador, "nombre"), (Operador, "telefono"),
])
@pytest.mark.parametrize("value", ["", " \t\n", None])
def test_rejects_empty_text(model, attribute, value):
    with pytest.raises(ValueError):
        model(**{attribute: value})


@pytest.mark.parametrize("value", [0, 10000, True, "2025", 2025.5, None])
def test_rejects_invalid_year(value):
    with pytest.raises(ValueError):
        Vehiculo(modelo=value)


@pytest.mark.parametrize("value", ["MOTO", "AUTOMOVIL", "CAMIONETA"])
def test_vehicle_types(value):
    assert Vehiculo(tipo=value).tipo == value


def test_rejects_unknown_type_and_preserves_phone_text():
    with pytest.raises(ValueError):
        Vehiculo(tipo="CAMION")
    assert Operador(telefono="+57 00123").telefono == "+57 00123"
    assert Celda(tipo="Categoría futura").tipo == "Categoría futura"


def test_required_columns_and_identity():
    for name in ("vehiculo", "celda", "operador"):
        table = Base.metadata.tables[name]
        assert all(not column.nullable for column in table.columns)
        assert isinstance(table.c.id.type, sa.BigInteger)
        assert table.c.id.identity.always is True


def test_novedad_model_constraints_and_foreign_keys():
    table = Novedad.__table__
    assert table.name == "novedad"
    assert isinstance(table.c.id.type, sa.BigInteger) and table.c.id.identity.always
    assert table.c.fecha_registro.type.timezone
    assert str(table.c.fecha_registro.server_default.arg) == "now()"
    assert {column.name for column in table.columns if column.nullable} == {"estancia_id"}
    assert {foreign_key.parent.name: foreign_key.ondelete for foreign_key in table.foreign_keys} == {
        "vehiculo_id": "RESTRICT", "estancia_id": "SET NULL", "operador_id": "RESTRICT",
    }
    assert {index.name for index in table.indexes} == {"ix_novedad_vehiculo_id"}
    with pytest.raises(ValueError):
        Novedad(descripcion=" \t")


def test_novedad_migration_only_creates_new_table():
    config_path = Path(__file__).resolve().parents[1] / "alembic.ini"
    output = StringIO()
    command.upgrade(Config(str(config_path), output_buffer=output), "0005:0006", sql=True)
    sql = output.getvalue()
    assert "CREATE TABLE novedad" in sql
    assert "CREATE INDEX ix_novedad_vehiculo_id ON novedad (vehiculo_id)" in sql
    assert "REFERENCES vehiculo (id) ON DELETE RESTRICT" in sql
    assert "REFERENCES estancia (id) ON DELETE SET NULL" in sql
    assert "REFERENCES operador (id) ON DELETE RESTRICT" in sql
    assert "ALTER TABLE cliente" not in sql and "DROP TABLE" not in sql


def test_migration_matches_models_without_connecting(monkeypatch):
    path = Path(__file__).resolve().parents[1] / "migrations/versions/0001_modelos_iniciales.py"
    spec = importlib.util.spec_from_file_location("initial_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    metadata = sa.MetaData()
    monkeypatch.setattr(migration.op, "create_table", lambda name, *args: sa.Table(name, metadata, *args))
    migration.upgrade()
    assert set(metadata.tables) == {"vehiculo", "celda", "operador"}
    for name, table in metadata.tables.items():
        model_table = Base.metadata.tables[name]
        assert [(c.name, str(c.type), c.nullable) for c in table.columns] == [
            (c.name, str(c.type), c.nullable) for c in model_table.columns
        ]
        def constraints(t):
            return {(c.name, str(c.sqltext)) for c in t.constraints if isinstance(c, sa.CheckConstraint)}
        assert constraints(table) == constraints(model_table)
        def unique_columns(t):
            return {tuple(c.columns.keys()) for c in t.constraints if isinstance(c, sa.UniqueConstraint)}
        assert unique_columns(table) == unique_columns(model_table)
        ddl = str(CreateTable(table).compile(dialect=postgresql.dialect()))
        assert "BIGINT GENERATED ALWAYS AS IDENTITY" in ddl
