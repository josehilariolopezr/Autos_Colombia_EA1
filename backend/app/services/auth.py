from functools import wraps

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth import create_access_token, verify_password
from app.models import Usuario
from app.schemas.auth import LoginSolicitud, TokenRespuesta
from app.schemas.usuario import UsuarioRespuesta


class AuthError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail


def authenticate_user(session: Session, data: LoginSolicitud) -> TokenRespuesta:
    identifier = data.identificador
    statement = select(Usuario).where(
        or_(
            Usuario.correo == identifier.lower(),
            Usuario.documento == identifier,
        )
    )
    user = session.scalar(statement)
    if user is None:
        raise AuthError(401, "Credenciales incorrectas.")

    if not user.activo:
        raise AuthError(403, "El usuario se encuentra inactivo. Comuníquese con el administrador.")

    if not verify_password(data.password, user.password_hash):
        raise AuthError(401, "Credenciales incorrectas.")

    token = create_access_token(
        {
            "sub": str(user.id),
            "nombre": user.nombre,
            "correo": user.correo,
            "rol": user.rol,
            "documento": user.documento,
        }
    )

    return TokenRespuesta(
        access_token=token,
        token_type="bearer",
        usuario=UsuarioRespuesta.model_validate(user),
    )
