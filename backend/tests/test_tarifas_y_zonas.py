from unittest.mock import MagicMock

import pytest

from app.models import Celda
from app.services.cliente import ClienteError, tarifa_mensual
from app.services.estancia import ServicioEstancia


@pytest.mark.parametrize(
    ("tipo", "valor"),
    [("MOTO", 30000), ("AUTOMOVIL", 50000), ("CAMIONETA", 60000)],
)
def test_tarifa_mensual_segun_tipo_de_vehiculo(tipo, valor):
    assert tarifa_mensual(tipo) == valor


def test_tarifa_mensual_rechaza_tipo_desconocido():
    with pytest.raises(ClienteError, match="Tipo de vehículo"):
        tarifa_mensual("PESADO")


@pytest.mark.parametrize(
    ("tipo", "codigo"),
    [("MOTO", "M-01"), ("AUTOMOVIL", "A-01"), ("CAMIONETA", "C-01")],
)
def test_sugerir_celda_usa_la_zona_del_tipo_de_vehiculo(tipo, codigo):
    cells = [
        Celda(id=1, codigo="A-01", tipo="AUTOMOVIL", estado="ACTIVA"),
        Celda(id=2, codigo="C-01", tipo="CAMIONETA", estado="ACTIVA"),
        Celda(id=3, codigo="M-01", tipo="MOTO", estado="ACTIVA"),
    ]
    session = MagicMock()
    session.scalars.return_value = cells

    suggested = ServicioEstancia(session).sugerir_celda(tipo)

    assert suggested.codigo == codigo
