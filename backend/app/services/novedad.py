from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from app.models import Estancia, Novedad, Operador, Vehiculo
from app.schemas.novedad import NovedadCreate, NovedadOut


class NovedadError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail


def _output(row: Novedad) -> NovedadOut:
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


def list_novedades(
    session: Session,
    placa: str | None = None,
    vehiculo_id: int | None = None,
    limit: int = 100,
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
        return [_output(row) for row in session.scalars(statement)]
    except SQLAlchemyError:
        session.rollback()
        raise NovedadError(503, "No se pudieron consultar las novedades.") from None


def create_novedad(session: Session, data: NovedadCreate) -> NovedadOut:
    try:
        vehicle = session.get(Vehiculo, data.vehiculo_id)
        if vehicle is None:
            raise NovedadError(404, "Vehículo no encontrado.")
        operator = session.get(Operador, data.operador_id)
        if operator is None:
            raise NovedadError(404, "Operador no encontrado.")
        if not operator.activo:
            raise NovedadError(400, "El operador está inactivo y no puede registrar novedades.")
        stay = None
        if data.estancia_id is not None:
            stay = session.get(Estancia, data.estancia_id)
            if stay is None:
                raise NovedadError(404, "Estancia no encontrada.")
            if stay.vehiculo_id != vehicle.id:
                raise NovedadError(422, "La estancia no corresponde al vehículo seleccionado.")
        row = Novedad(
            vehiculo=vehicle,
            estancia=stay,
            operador=operator,
            descripcion=data.descripcion,
        )
        session.add(row)
        session.flush()
        session.refresh(row)
        result = _output(row)
        session.commit()
        return result
    except NovedadError:
        session.rollback()
        raise
    except IntegrityError:
        session.rollback()
        raise NovedadError(409, "No se pudo registrar la novedad por un conflicto de datos.") from None
    except SQLAlchemyError:
        session.rollback()
        raise NovedadError(503, "No se pudo registrar la novedad.") from None
