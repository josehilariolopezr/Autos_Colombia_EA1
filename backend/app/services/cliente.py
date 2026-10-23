from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.models import Cliente


class ClienteError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail


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
