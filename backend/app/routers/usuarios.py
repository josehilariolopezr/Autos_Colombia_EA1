from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_session
from app.models import Usuario
from app.schemas.usuario import (
    UsuarioActualizar,
    UsuarioCrear,
    UsuarioRespuesta,
    UsuariosPagina,
)
from app.services import usuario as service

router = APIRouter(
    prefix="/usuarios",
    tags=["Usuarios"],
    dependencies=[Depends(require_role(["ADMINISTRADOR"]))],
)

DatabaseSession = Annotated[Session, Depends(get_session)]
UserId = Annotated[int, Path(ge=1, le=9223372036854775807)]


@router.get("", response_model=UsuariosPagina)
def list_all(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0, le=9223372036854775807)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query()] = None,
    rol: Annotated[str | None, Query()] = None,
    activo: Annotated[bool | None, Query()] = None,
) -> dict:
    return service.list_users(session, offset, limit, search, rol, activo)


@router.post("", response_model=UsuarioRespuesta, status_code=201)
def create(data: UsuarioCrear, session: DatabaseSession) -> Usuario:
    return service.create_user(session, data)


@router.get("/{id}", response_model=UsuarioRespuesta)
def get_one(id: UserId, session: DatabaseSession) -> Usuario:
    return service.get_user(session, id)


@router.patch("/{id}", response_model=UsuarioRespuesta)
def update(id: UserId, data: UsuarioActualizar, session: DatabaseSession) -> Usuario:
    return service.update_user(session, id, data)


@router.delete("/{id}", response_model=UsuarioRespuesta)
def deactivate(id: UserId, session: DatabaseSession) -> Usuario:
    return service.deactivate_user(session, id)
