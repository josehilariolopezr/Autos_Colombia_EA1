from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.cliente import ClienteEnVehiculo


class VehiculoEnCelda(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    placa: str
    tipo: str
    cliente: ClienteEnVehiculo | None = None


class CeldaDashboard(BaseModel):
    id: int
    codigo: str
    tipo: str
    zona: Literal["A", "M", "P", "OTRA"]
    estado: Literal["DISPONIBLE", "OCUPADA"]
    mensualidad: bool | None = None
    vehiculo: VehiculoEnCelda | None = None
    entrada: datetime | None = None


class DashboardResumen(BaseModel):
    total_celdas: int
    celdas_disponibles: int
    celdas_ocupadas: int
    estancias_activas: int
    mensualidades_activas: int | None = None
    recaudacion_hoy: float | None = None
    variacion_recaudacion_pct: float | None = None
    variacion_ocupadas_24h: int
    celdas: list[CeldaDashboard]
