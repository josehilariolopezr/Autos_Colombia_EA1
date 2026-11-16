from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.database import get_session
from app.main import app
from app.models import Vehiculo
from app.schemas.vehiculo import VehiculoActualizar, VehiculoCrear
from app.services.vehiculo import delete_vehicle


@pytest.mark.parametrize("field", ["placa", "color", "modelo", "marca", "tipo", "activo"])
def test_patch_rejects_explicit_null(field):
    with pytest.raises(ValidationError):
        VehiculoActualizar(**{field: None})


@pytest.mark.parametrize("field", ["placa", "color", "marca", "tipo"])
def test_patch_rejects_blank_text(field):
    with pytest.raises(ValidationError):
        VehiculoActualizar(**{field: " \t\n"})


def test_patch_only_supplied_fields_and_no_id():
    assert VehiculoActualizar(placa=" abc123 ").model_dump(exclude_unset=True) == {"placa": "ABC123"}
    assert VehiculoActualizar().model_dump(exclude_unset=True) == {}
    with pytest.raises(ValidationError):
        VehiculoActualizar(id=1)


def test_patch_accepts_explicit_null_client_id():
    assert VehiculoActualizar(cliente_id=None).model_dump(exclude_unset=True) == {"cliente_id": None}


def test_creation_requires_every_field():
    with pytest.raises(ValidationError):
        VehiculoCrear(placa="ABC123")


def test_patch_endpoint_unlinks_vehicle_from_client():
    vehicle = Vehiculo(
        id=11,
        placa="ABC123",
        color="Azul",
        modelo=2024,
        marca="Toyota",
        tipo="AUTOMOVIL",
        cliente_id=7,
        activo=True,
    )
    session = MagicMock()
    session.get.return_value = vehicle

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        response = TestClient(app).patch("/vehiculos/11", json={"cliente_id": None})
    finally:
        app.dependency_overrides.pop(get_session, None)

    assert response.status_code == 200
    assert response.json()["cliente_id"] is None
    assert vehicle.cliente_id is None
    session.commit.assert_called_once()


def test_deactivation_is_logical_and_does_not_delete_vehicle():
    vehicle = Vehiculo(
        id=12,
        placa="XYZ123",
        color="Rojo",
        modelo=2023,
        marca="Kia",
        tipo="AUTOMOVIL",
        activo=True,
    )
    session = MagicMock()
    session.get.return_value = vehicle
    session.scalar.return_value = None

    result = delete_vehicle(session, vehicle.id)

    assert result.activo is False
    session.commit.assert_called_once()
    session.delete.assert_not_called()
