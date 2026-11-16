from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator

from app.models import required_text

Texto = Annotated[str, BeforeValidator(lambda value: required_text(value, "El campo"))]
RolUsuario = Literal["ADMINISTRADOR", "OPERADOR"]


class UsuarioBase(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nombre: Texto
    documento: Texto
    correo: Texto
    rol: RolUsuario
    operador_id: Annotated[int, Field(ge=1, le=9223372036854775807)] | None = None

    @field_validator("correo")
    @classmethod
    def normalizar_correo(cls, value: str) -> str:
        return value.strip().lower()


class UsuarioCrear(UsuarioBase):
    password: Texto = Field(min_length=6)


class UsuarioActualizar(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nombre: Texto | None = None
    documento: Texto | None = None
    correo: Texto | None = None
    rol: RolUsuario | None = None
    password: Texto | None = Field(default=None, min_length=6)
    activo: bool | None = None
    operador_id: Annotated[int, Field(ge=1, le=9223372036854775807)] | None = None

    @field_validator("nombre", "documento", "rol", "password", "activo", mode="before")
    @classmethod
    def reject_null(cls, value):
        if value is None:
            raise ValueError("El campo no puede ser nulo.")
        return value

    @field_validator("correo", mode="before")
    @classmethod
    def validar_correo(cls, value):
        if value is None:
            raise ValueError("El correo no puede ser nulo.")
        return value.strip().lower()


class UsuarioRespuesta(UsuarioBase):
    model_config = ConfigDict(from_attributes=True, extra="forbid")
    id: int
    activo: bool
    creado_en: datetime


class UsuariosPagina(BaseModel):
    items: list[UsuarioRespuesta]
    total: int
    offset: int
    limit: int
