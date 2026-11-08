from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.vehiculo import Placa

Identificador = Annotated[int, Field(strict=True, ge=1, le=9223372036854775807)]
MetodoPago = Literal["EFECTIVO", "TARJETA", "TRANSFERENCIA"]


class MensualidadPagoCrear(BaseModel):
    model_config = ConfigDict(extra="forbid")
    placa: Placa
    operador_id: Identificador
    metodo_pago: MetodoPago


class MensualidadPagoRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    placa: str
    tipo_vehiculo: str
    nombre_cliente: str
    codigo_cliente: str
    nombre_operador: str
    valor: int
    metodo_pago: MetodoPago
    fecha_pago: datetime
    fecha_inicio: date
    fecha_fin: date
