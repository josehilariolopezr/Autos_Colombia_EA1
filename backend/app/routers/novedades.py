from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_session
from app.schemas.novedad import NovedadCreate, NovedadOut
from app.services.novedad import create_novedad, list_novedades

router = APIRouter(prefix="/novedades", tags=["Novedades"])
DatabaseSession = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[NovedadOut])
def list_all(
    session: DatabaseSession,
    placa: Annotated[str | None, Query(min_length=1, max_length=32)] = None,
    vehiculo_id: Annotated[int | None, Query(ge=1)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
) -> list[NovedadOut]:
    return list_novedades(session, placa, vehiculo_id, limit)


@router.post("", response_model=NovedadOut, status_code=201)
def create(data: NovedadCreate, session: DatabaseSession) -> NovedadOut:
    return create_novedad(session, data)
