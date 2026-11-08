from calendar import monthrange
from datetime import date, datetime, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.models import Cliente, Operador, PagoMensualidad, Vehiculo
from app.schemas.cliente import ClienteCrear, ClienteRespuesta
from app.schemas.mensualidad import MensualidadPagoCrear, MensualidadPagoRespuesta


class ClienteError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail


def create_client(session: Session, data: ClienteCrear) -> ClienteRespuesta:
    try:
        with session.begin():
            vehiculo = None
            if data.placa is not None:
                vehiculo = session.scalar(
                    select(Vehiculo).where(Vehiculo.placa == data.placa).with_for_update()
                )
                if vehiculo is None:
                    raise ClienteError(404, "No existe un vehículo registrado con esa placa.")
                if vehiculo.cliente_id is not None:
                    raise ClienteError(409, "El vehículo ya está asociado a un cliente.")
            cliente = Cliente(
                codigo=f"TMP-{uuid4().hex}", nombre=data.nombre, telefono=data.telefono
            )
            session.add(cliente)
            session.flush()
            cliente.codigo = f"CL-{cliente.id:04d}"
            if vehiculo is not None:
                vehiculo.cliente = cliente
            session.flush()
            return ClienteRespuesta.model_validate(cliente)
    except ClienteError:
        session.rollback()
        raise
    except IntegrityError:
        session.rollback()
        raise ClienteError(409, "No se pudo asignar un código único al cliente.") from None
    except SQLAlchemyError:
        session.rollback()
        raise ClienteError(503, "No se pudo registrar el cliente.") from None


def list_clients(session: Session, offset: int, limit: int) -> dict:
    try:
        total = session.scalar(select(func.count()).select_from(Cliente)) or 0
        items = list(
            session.scalars(
                select(Cliente)
                .options(selectinload(Cliente.vehiculos))
                .order_by(Cliente.codigo.desc())
                .offset(offset)
                .limit(limit)
            )
        )
        return {"items": items, "total": total, "offset": offset, "limit": limit}
    except SQLAlchemyError:
        session.rollback()
        raise ClienteError(503, "No se pudo consultar el registro de clientes.") from None


def _sumar_mes(value: date) -> date:
    year = value.year + (value.month // 12)
    month = value.month % 12 + 1
    return date(year, month, min(value.day, monthrange(year, month)[1]))


def register_monthly_payment(
    session: Session, cliente_id: int, data: MensualidadPagoCrear
) -> MensualidadPagoRespuesta:
    try:
        with session.begin():
            cliente = session.scalar(
                select(Cliente).where(Cliente.id == cliente_id).with_for_update()
            )
            if cliente is None:
                raise ClienteError(404, "Cliente no encontrado.")
            vehiculo = session.scalar(
                select(Vehiculo).where(Vehiculo.cliente_id == cliente.id, Vehiculo.placa == data.placa)
            )
            if vehiculo is None:
                raise ClienteError(409, "La placa no está asociada a este cliente.")
            operador = session.get(Operador, data.operador_id)
            if operador is None:
                raise ClienteError(404, "Operador no encontrado.")
            hoy = datetime.now(ZoneInfo("America/Bogota")).date()
            inicio = max(cliente.vencimiento, hoy) if cliente.vencimiento else hoy
            fin = _sumar_mes(inicio)
            valor = 30000 if vehiculo.tipo == "MOTO" else 60000
            pago = PagoMensualidad(
                cliente_id=cliente.id,
                operador_id=operador.id,
                vehiculo_id=vehiculo.id,
                valor=valor,
                metodo_pago=data.metodo_pago,
                fecha_inicio=inicio,
                fecha_fin=fin,
            )
            cliente.vencimiento = fin
            session.add(pago)
            session.flush()
            return MensualidadPagoRespuesta(
                id=pago.id,
                placa=vehiculo.placa,
                tipo_vehiculo=vehiculo.tipo,
                nombre_cliente=cliente.nombre,
                codigo_cliente=cliente.codigo,
                nombre_operador=operador.nombre,
                valor=pago.valor,
                metodo_pago=pago.metodo_pago,
                fecha_pago=pago.fecha_pago or datetime.now(timezone.utc),
                fecha_inicio=inicio,
                fecha_fin=fin,
            )
    except ClienteError:
        session.rollback()
        raise
    except SQLAlchemyError as error:
        session.rollback()
        sqlstate = getattr(getattr(error, "orig", None), "sqlstate", None)
        if sqlstate == "42P01":
            raise ClienteError(
                503,
                "Falta la tabla de pagos de mensualidad. Revisa y aplica la migración 0004.",
            ) from None
        raise ClienteError(
            503,
            "No se pudo guardar el pago. Verifica la conexión con PostgreSQL y la migración 0004.",
        ) from None


def list_monthly_payments(
    session: Session, cliente_id: int, offset: int, limit: int
) -> list[MensualidadPagoRespuesta]:
    try:
        if session.get(Cliente, cliente_id) is None:
            raise ClienteError(404, "Cliente no encontrado.")
        pagos = session.scalars(
            select(PagoMensualidad)
            .options(
                selectinload(PagoMensualidad.cliente),
                selectinload(PagoMensualidad.vehiculo),
                selectinload(PagoMensualidad.operador),
            )
            .where(PagoMensualidad.cliente_id == cliente_id)
            .order_by(PagoMensualidad.fecha_pago.desc(), PagoMensualidad.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return [
            MensualidadPagoRespuesta(
                id=pago.id,
                placa=pago.vehiculo.placa,
                tipo_vehiculo=pago.vehiculo.tipo,
                nombre_cliente=pago.cliente.nombre,
                codigo_cliente=pago.cliente.codigo,
                nombre_operador=pago.operador.nombre,
                valor=pago.valor,
                metodo_pago=pago.metodo_pago,
                fecha_pago=pago.fecha_pago,
                fecha_inicio=pago.fecha_inicio,
                fecha_fin=pago.fecha_fin,
            )
            for pago in pagos
        ]
    except ClienteError:
        raise
    except SQLAlchemyError:
        session.rollback()
        raise ClienteError(503, "No se pudo consultar el historial de pagos.") from None
