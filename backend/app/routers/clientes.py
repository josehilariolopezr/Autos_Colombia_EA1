from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.database import get_session
from app.schemas.cliente import ClienteCrear, ClienteRespuesta, ClientesPagina
from app.schemas.mensualidad import MensualidadPagoCrear, MensualidadPagoRespuesta
from app.services.cliente import create_client, list_clients, list_monthly_payments, register_monthly_payment

router = APIRouter(prefix="/clientes", tags=["Clientes"])
DatabaseSession = Annotated[Session, Depends(get_session)]


@router.post("", response_model=ClienteRespuesta, status_code=201)
def create(data: ClienteCrear, session: DatabaseSession) -> ClienteRespuesta:
    return create_client(session, data)


@router.get("", response_model=ClientesPagina)
def list_all(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0, le=9223372036854775807)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ClientesPagina:
    return list_clients(session, offset, limit)


@router.post("/{cliente_id}/mensualidades", response_model=MensualidadPagoRespuesta, status_code=201)
def pagar_mensualidad(
    cliente_id: Annotated[int, Path(ge=1, le=9223372036854775807)],
    data: MensualidadPagoCrear,
    session: DatabaseSession,
) -> MensualidadPagoRespuesta:
    return register_monthly_payment(session, cliente_id, data)


@router.get("/{cliente_id}/mensualidades", response_model=list[MensualidadPagoRespuesta])
def historial_mensualidades(
    cliente_id: Annotated[int, Path(ge=1, le=9223372036854775807)],
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0, le=9223372036854775807)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[MensualidadPagoRespuesta]:
    return list_monthly_payments(session, cliente_id, offset, limit)
