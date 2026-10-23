from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import Celda, Estancia, Vehiculo
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

    try:
        rows = session.execute(
            select(Celda, Estancia, Vehiculo)
            .outerjoin(
                Estancia,
                and_(Estancia.celda_id == Celda.id, Estancia.salida.is_(None)),
            )
            .outerjoin(Vehiculo, Vehiculo.id == Estancia.vehiculo_id)
            .order_by(Celda.codigo, Celda.id)
        ).all()

        occupied_yesterday = session.scalar(
            select(func.count(Estancia.id)).where(
                Estancia.entrada <= yesterday_at_same_time,
                or_(Estancia.salida.is_(None), Estancia.salida > yesterday_at_same_time),
            )
        ) or 0
    except SQLAlchemyError:
        session.rollback()
        raise DashboardError(503, "No se pudo consultar el resumen del parqueadero.") from None

    cells: list[CeldaDashboard] = []
    for cell, stay, vehicle in rows:
        occupied = stay is not None
        prefix = cell.codigo.split("-", maxsplit=1)[0].upper()
        cells.append(
            CeldaDashboard(
                id=cell.id,
                codigo=cell.codigo,
                tipo=cell.tipo,
                zona=prefix if prefix in {"A", "M", "P"} else "OTRA",
                estado="OCUPADA" if occupied else "DISPONIBLE",
                mensualidad=None,
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
    available = len(cells) - occupied
    return DashboardResumen(
        total_celdas=len(cells),
        celdas_disponibles=available,
        celdas_ocupadas=occupied,
        estancias_activas=occupied,
        mensualidades_activas=None,
        recaudacion_hoy=None,
        variacion_recaudacion_pct=None,
        variacion_ocupadas_24h=occupied - occupied_yesterday,
        celdas=cells,
    )
