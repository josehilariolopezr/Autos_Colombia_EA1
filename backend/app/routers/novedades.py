from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from app.database import get_session
from app.models import Estancia, Novedad, Operador, Vehiculo
from app.schemas.novedad import NovedadCreate, NovedadOut

router = APIRouter(prefix="/novedades", tags=["Novedades"])
DatabaseSession = Annotated[Session, Depends(get_session)]


def output(row: Novedad) -> NovedadOut:
    return NovedadOut(
        id=row.id,
        vehiculo_id=row.vehiculo_id,
        estancia_id=row.estancia_id,
        operador_id=row.operador_id,
        descripcion=row.descripcion,
        fecha_registro=row.fecha_registro,
        placa=row.vehiculo.placa,
        nombre_operador=row.operador.nombre,
    )


@router.get("", response_model=list[NovedadOut])
def list_novedades(
    session: DatabaseSession,
    placa: Annotated[str | None, Query(min_length=1, max_length=32)] = None,
    vehiculo_id: Annotated[int | None, Query(ge=1)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
) -> list[NovedadOut]:
    statement = (
        select(Novedad)
        .options(joinedload(Novedad.vehiculo), joinedload(Novedad.operador))
        .order_by(Novedad.fecha_registro.desc(), Novedad.id.desc())
        .limit(limit)
    )
    if vehiculo_id is not None:
        statement = statement.where(Novedad.vehiculo_id == vehiculo_id)
    if placa is not None:
        statement = statement.join(Novedad.vehiculo).where(Vehiculo.placa == placa.strip().upper())
    try:
        return [output(row) for row in session.scalars(statement)]
    except SQLAlchemyError:
        session.rollback()
        raise HTTPException(503, "No se pudieron consultar las novedades.") from None


@router.post("", response_model=NovedadOut, status_code=201)
def create_novedad(data: NovedadCreate, session: DatabaseSession) -> NovedadOut:
    try:
        vehicle = session.get(Vehiculo, data.vehiculo_id)
        if vehicle is None:
            raise HTTPException(404, "Vehículo no encontrado.")
        operator = session.get(Operador, data.operador_id)
        if operator is None:
            raise HTTPException(404, "Operador no encontrado.")
        if not operator.activo:
            raise HTTPException(400, "El operador está inactivo y no puede registrar novedades.")
        stay = None
        if data.estancia_id is not None:
            stay = session.get(Estancia, data.estancia_id)
            if stay is None:
                raise HTTPException(404, "Estancia no encontrada.")
            if stay.vehiculo_id != vehicle.id:
                raise HTTPException(422, "La estancia no corresponde al vehículo seleccionado.")
        row = Novedad(
            vehiculo_id=vehicle.id,
            estancia_id=stay.id if stay else None,
            operador_id=operator.id,
            descripcion=data.descripcion,
        )
        session.add(row)
        session.flush()
        session.refresh(row)
        result = output(row)
        session.commit()
        return result
    except HTTPException:
        session.rollback()
        raise
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "No se pudo registrar la novedad por un conflicto de datos.") from None
    except SQLAlchemyError:
        session.rollback()
        raise HTTPException(503, "No se pudo registrar la novedad.") from None
