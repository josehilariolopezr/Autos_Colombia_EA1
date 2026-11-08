from datetime import date, datetime
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, Field, computed_field

from app.models import required_text

ClienteId = Annotated[int, Field(strict=True, ge=1, le=9223372036854775807)]
Texto = Annotated[str, BeforeValidator(lambda value: required_text(value, "El campo"))]
PlacaCliente = Annotated[Texto, AfterValidator(str.upper)]


class ClienteCrear(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: Texto
    telefono: Texto
    placa: PlacaCliente | None = None


class ClienteEnVehiculo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    nombre: str
    telefono: str
    vencimiento: date | None


class ClienteRespuesta(ClienteEnVehiculo):
    placa: str | None = None
    tipo_vehiculo: Literal["MOTO", "AUTOMOVIL", "CAMIONETA"] | None = None

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
