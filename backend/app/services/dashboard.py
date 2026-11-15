from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from app.models import Celda, Cliente, Estancia, PagoMensualidad, Vehiculo
from app.schemas.cliente import ClienteEnVehiculo
from app.schemas.dashboard import CeldaDashboard, DashboardResumen, VehiculoEnCelda


class DashboardError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail


def get_dashboard_summary(session: Session) -> DashboardResumen:
    """Devuelve el estado de cada celda y los indicadores de ocupación actuales."""
    now = datetime.now(timezone.utc)
    yesterday_at_same_time = now - timedelta(days=1)
    hoy = now.astimezone(ZoneInfo("America/Bogota")).date()
    inicio_dia = datetime.combine(hoy, time.min, tzinfo=ZoneInfo("America/Bogota"))
    fin_dia = inicio_dia + timedelta(days=1)

    try:
        rows = session.execute(
            select(Celda, Estancia, Vehiculo)
            .outerjoin(
                Estancia,
                and_(Estancia.celda_id == Celda.id, Estancia.salida.is_(None)),
            )
            .outerjoin(Vehiculo, Vehiculo.id == Estancia.vehiculo_id)
            .options(joinedload(Vehiculo.cliente))
            .order_by(Celda.codigo, Celda.id)
        ).all()

        occupied_yesterday = session.scalar(
            select(func.count(Estancia.id)).where(
                Estancia.entrada <= yesterday_at_same_time,
                or_(Estancia.salida.is_(None), Estancia.salida > yesterday_at_same_time),
            )
        ) or 0
        monthly_active = session.scalar(
            select(func.count(Cliente.id)).where(Cliente.vencimiento >= hoy)
        ) or 0
        revenue_today = session.scalar(
            select(func.coalesce(func.sum(PagoMensualidad.valor), 0)).where(
                PagoMensualidad.fecha_pago >= inicio_dia,
                PagoMensualidad.fecha_pago < fin_dia,
            )
        ) or 0
    except SQLAlchemyError:
        session.rollback()
        raise DashboardError(503, "No se pudo consultar el resumen del parqueadero.") from None

    cells: list[CeldaDashboard] = []
    for cell, stay, vehicle in rows:
        maintenance = cell.estado == "MANTENIMIENTO"
        occupied = stay is not None
        prefix = cell.codigo.split("-", maxsplit=1)[0].upper()
        cells.append(
            CeldaDashboard(
                id=cell.id,
                codigo=cell.codigo,
                tipo=cell.tipo,
                zona=prefix if prefix in {"A", "M", "P"} else "OTRA",
                estado="MANTENIMIENTO" if maintenance else "OCUPADA" if occupied else "DISPONIBLE",
                mensualidad=(
                    bool(vehicle.cliente and vehicle.cliente.vencimiento and vehicle.cliente.vencimiento >= hoy)
                    if vehicle is not None
                    else None
                ),
                vehiculo=(
                    VehiculoEnCelda(
                        placa=vehicle.placa,
                        tipo=vehicle.tipo,
                        cliente=(
                            ClienteEnVehiculo.model_validate(vehicle.cliente)
                            if vehicle is not None and vehicle.cliente is not None
                            else None
                        ),
                    )
                    if vehicle is not None
                    else None
                ),
                entrada=stay.entrada if stay is not None else None,
            )
        )

    occupied = sum(cell.estado == "OCUPADA" for cell in cells)
    available = sum(cell.estado == "DISPONIBLE" for cell in cells)
    return DashboardResumen(
        total_celdas=len(cells),
        celdas_disponibles=available,
        celdas_ocupadas=occupied,
        estancias_activas=occupied,
        mensualidades_activas=monthly_active,
        recaudacion_hoy=revenue_today,
        variacion_recaudacion_pct=None,
        variacion_ocupadas_24h=occupied - occupied_yesterday,
        celdas=cells,
    )
