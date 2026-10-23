from datetime import date, datetime
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, computed_field

ClienteId = Annotated[int, Field(strict=True, ge=1, le=9223372036854775807)]


class ClienteEnVehiculo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    nombre: str
    telefono: str
    vencimiento: date | None


class ClienteRespuesta(ClienteEnVehiculo):
    placa: str | None = None

    @computed_field
    @property
    def estado(self) -> Literal["Al día", "Por vencer", "Vencido", "Sin mensualidad"]:
        if self.vencimiento is None:
            return "Sin mensualidad"
        today = datetime.now(ZoneInfo("America/Bogota")).date()
        if self.vencimiento < today:
            return "Vencido"
        if (self.vencimiento - today).days <= 7:
            return "Por vencer"
        return "Al día"


class ClientesPagina(BaseModel):
    items: list[ClienteRespuesta]
    total: int
    offset: int
    limit: int
