from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_session
from app.models import Usuario
from app.schemas.auth import LoginSolicitud, TokenRespuesta
from app.schemas.usuario import UsuarioRespuesta
from app.services import auth as service

router = APIRouter(prefix="/auth", tags=["Autenticación"])
DatabaseSession = Annotated[Session, Depends(get_session)]


@router.post("/login", response_model=TokenRespuesta)
def login(data: LoginSolicitud, session: DatabaseSession) -> TokenRespuesta:
    return service.authenticate_user(session, data)


@router.get("/me", response_model=UsuarioRespuesta)
def me(current_user: Annotated[Usuario, Depends(get_current_user)]) -> Usuario:
    return current_user
