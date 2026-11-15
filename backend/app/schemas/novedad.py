from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

from app.models import required_text

Identificador = Annotated[int, Field(strict=True, ge=1, le=9223372036854775807)]
Descripcion = Annotated[str, BeforeValidator(lambda value: required_text(value, "descripcion"))]


class NovedadCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vehiculo_id: Identificador
    estancia_id: Identificador | None = None
    operador_id: Identificador
    descripcion: Descripcion


class NovedadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vehiculo_id: int
    estancia_id: int | None
    operador_id: int
    descripcion: str
    fecha_registro: datetime
    placa: str
    nombre_operador: str
