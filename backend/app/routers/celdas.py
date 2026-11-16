from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_session
from app.schemas.celda import CeldaActualizar, CeldaCrear, CeldaRespuesta, CeldasPagina
from app.services import celda as service

router = APIRouter(prefix="/celdas", tags=["Celdas"])
DatabaseSession = Annotated[Session, Depends(get_session)]
CellId = Annotated[int, Path(ge=1, le=9223372036854775807)]


@router.post("", response_model=CeldaRespuesta, status_code=201, dependencies=[Depends(require_role(["ADMINISTRADOR"]))])
def create(data: CeldaCrear, session: DatabaseSession):
    return service.create_cell(session, data)


@router.get("", response_model=CeldasPagina)
def list_all(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0, le=9223372036854775807)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    return service.list_cells(session, offset, limit)


@router.get("/{id}", response_model=CeldaRespuesta)
def get_one(id: CellId, session: DatabaseSession):
    return service.get_cell(session, id)


@router.patch("/{id}", response_model=CeldaRespuesta, dependencies=[Depends(require_role(["ADMINISTRADOR"]))])
def update(id: CellId, data: CeldaActualizar, session: DatabaseSession):
    return service.update_cell(session, id, data)


@router.delete("/{id}", response_model=CeldaRespuesta, dependencies=[Depends(require_role(["ADMINISTRADOR"]))])
def deactivate(id: CellId, session: DatabaseSession) -> CeldaRespuesta:
    return service.deactivate_cell(session, id)

