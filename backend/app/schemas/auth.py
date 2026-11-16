from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.usuario import UsuarioRespuesta


class LoginSolicitud(BaseModel):
    model_config = ConfigDict(extra="ignore")
    correo: str | None = None
    documento: str | None = None
    credencial: str | None = None
    password: str = Field(min_length=1)

    @model_validator(mode="after")
    def validate_identifier(self) -> "LoginSolicitud":
        identifier = self.credencial or self.correo or self.documento
        if not identifier or not identifier.strip():
            raise ValueError("Debe ingresar correo o número de documento.")
        return self

    @property
    def identificador(self) -> str:
        raw = self.credencial or self.correo or self.documento or ""
        return raw.strip()


class TokenRespuesta(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioRespuesta
