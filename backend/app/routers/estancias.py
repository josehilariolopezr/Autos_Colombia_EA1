from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_session
from app.schemas.celda import CeldaRespuesta
from app.models import Celda, Estancia, Vehiculo
from app.schemas.estancia import EntradaCrear, SalidaCrear, EstanciaRespuesta, EstadoVehiculoRespuesta
from app.schemas.vehiculo import Placa
from app.services.estancia import EstanciaError, ServicioEstancia

router = APIRouter(
    prefix="/estancias",
    tags=["Estancias"],
    dependencies=[Depends(get_current_user)],
)
DatabaseSession = Annotated[Session, Depends(get_session)]


class EstanciaReciente(BaseModel):
    id: int
    placa: str
    celda: str
    entrada: datetime
    salida: datetime | None


@router.post("/entrada", response_model=EstanciaRespuesta, status_code=201)
def entrada(data: EntradaCrear, session: DatabaseSession) -> EstanciaRespuesta:
    return ServicioEstancia(session).entrada(data)


@router.get("/sugerir-celda", response_model=CeldaRespuesta)
def sugerir_celda(
    session: DatabaseSession,
    tipo: Literal["MOTO", "AUTOMOVIL", "CAMIONETA"] = Query(),
) -> CeldaRespuesta:
    return CeldaRespuesta.model_validate(ServicioEstancia(session).sugerir_celda(tipo))


@router.post("/salida", response_model=EstanciaRespuesta)
def salida(data: SalidaCrear, session: DatabaseSession) -> EstanciaRespuesta:
    return ServicioEstancia(session).salida(data)


@router.get("/vehiculo/{placa}", response_model=EstadoVehiculoRespuesta)
def consultar(placa: Placa, session: DatabaseSession) -> EstadoVehiculoRespuesta:
    return ServicioEstancia(session).consultar(placa)


@router.get(
    "/recientes",
    response_model=list[EstanciaReciente],
    dependencies=[Depends(require_role(["ADMINISTRADOR"]))],
)
def recientes(
    session: DatabaseSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[EstanciaReciente]:
    try:
        rows = session.execute(
            select(Estancia, Vehiculo, Celda)
            .join(Vehiculo, Vehiculo.id == Estancia.vehiculo_id)
            .join(Celda, Celda.id == Estancia.celda_id)
            .order_by(Estancia.entrada.desc(), Estancia.id.desc())
            .limit(limit)
        ).all()
        return [EstanciaReciente(id=stay.id, placa=vehicle.placa, celda=cell.codigo,
                                 entrada=stay.entrada, salida=stay.salida)
                for stay, vehicle, cell in rows]
    except SQLAlchemyError:
        session.rollback()
        raise EstanciaError(503, "No se pudieron consultar las estancias recientes.") from None
