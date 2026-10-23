from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.database import get_session
from app.main import app


class FakeSession:
    def execute(self, _statement):
        cell_available = SimpleNamespace(id=1, codigo="A-01", tipo="Automóvil")
        cell_occupied = SimpleNamespace(id=2, codigo="A-02", tipo="Automóvil")
        stay = SimpleNamespace(entrada=datetime(2026, 10, 22, 12, tzinfo=timezone.utc))
        vehicle = SimpleNamespace(placa="ABC123", tipo="AUTOMOVIL")
        return SimpleNamespace(all=lambda: [(cell_available, None, None), (cell_occupied, stay, vehicle)])

    def scalar(self, _statement):
        return 2

    def rollback(self):
        raise AssertionError("No se debe revertir una consulta exitosa.")


def test_dashboard_returns_counts_and_cell_occupancy():
    session = FakeSession()

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        with TestClient(app) as client:
            response = client.get("/dashboard/resumen")
    finally:
        app.dependency_overrides.pop(get_session, None)

    assert response.status_code == 200
    assert response.json() == {
        "total_celdas": 2,
        "celdas_disponibles": 1,
        "celdas_ocupadas": 1,
        "estancias_activas": 1,
        "mensualidades_activas": None,
        "recaudacion_hoy": None,
        "variacion_recaudacion_pct": None,
        "variacion_ocupadas_24h": -1,
        "celdas": [
            {
                "id": 1,
                "codigo": "A-01",
                "tipo": "Automóvil",
                "zona": "A",
                "estado": "DISPONIBLE",
                "mensualidad": None,
                "vehiculo": None,
                "entrada": None,
            },
            {
                "id": 2,
                "codigo": "A-02",
                "tipo": "Automóvil",
                "zona": "A",
                "estado": "OCUPADA",
                "mensualidad": None,
                "vehiculo": {"placa": "ABC123", "tipo": "AUTOMOVIL"},
                "entrada": "2026-10-22T12:00:00Z",
            },
        ],
    }
