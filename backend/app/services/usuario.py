from functools import wraps

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.models import Operador, Usuario
from app.schemas.usuario import UsuarioActualizar, UsuarioCrear


class UsuarioError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail


def database_operation(operation):
    @wraps(operation)
    def wrapped(session: Session, *args, **kwargs):
        try:
            return operation(session, *args, **kwargs)
        except IntegrityError as error:
            session.rollback()
            code = getattr(error.orig, "sqlstate", None)
            constraint = getattr(getattr(error.orig, "diag", None), "constraint_name", None)
            if code == "23505":
                if constraint == "uq_usuario_correo":
                    raise UsuarioError(409, "Ya existe un usuario registrado con ese correo.") from None
                if constraint == "uq_usuario_documento":
                    raise UsuarioError(409, "Ya existe un usuario registrado con ese número de documento.") from None
                raise UsuarioError(409, "Ya existe un registro con esos datos únicos.") from None
            if code == "23503":
                if constraint == "fk_usuario_operador":
                    raise UsuarioError(404, "El operador asociado no existe.") from None
                raise UsuarioError(409, "El usuario tiene registros asociados.") from None
            if code in {"23502", "23514"}:
                raise UsuarioError(422, "Los datos del usuario incumplen las restricciones del sistema.") from None
            raise UsuarioError(409, "Conflicto con los datos del usuario en la base de datos.") from None
        except SQLAlchemyError:
            session.rollback()
            raise UsuarioError(503, "No se pudo completar la operación con la base de datos.") from None

    return wrapped


def find_user(session: Session, user_id: int) -> Usuario:
    user = session.get(Usuario, user_id)
    if user is None:
        raise UsuarioError(404, "Usuario no encontrado.")
    return user


def _validar_no_ultimo_admin_activo(db: Session, usuario: Usuario) -> None:
    if usuario.rol == "ADMINISTRADOR" and usuario.activo is True:
        admin_count = db.scalar(
            select(func.count())
            .select_from(Usuario)
            .where(
                Usuario.rol == "ADMINISTRADOR",
                Usuario.activo.is_(True),
            )
        ) or 0
        if admin_count <= 1:
            raise HTTPException(
                status_code=409,
                detail="No es posible desactivar ni quitar el rol al único administrador activo del sistema.",
            )


@database_operation
def create_user(session: Session, data: UsuarioCrear) -> Usuario:
    correo_norm = data.correo.lower().strip()
    if session.scalar(select(Usuario.id).where(Usuario.correo == correo_norm)):
        raise UsuarioError(409, "Ya existe un usuario registrado con ese correo.")

    if session.scalar(select(Usuario.id).where(Usuario.documento == data.documento.strip())):
        raise UsuarioError(409, "Ya existe un usuario registrado con ese número de documento.")

    if data.operador_id is not None:
        operador = session.get(Operador, data.operador_id)
        if operador is None:
            raise UsuarioError(404, "El operador asociado especificado no existe.")

    hashed = hash_password(data.password)
    user = Usuario(
        nombre=data.nombre.strip(),
        documento=data.documento.strip(),
        correo=correo_norm,
        password_hash=hashed,
        rol=data.rol,
        operador_id=data.operador_id,
        activo=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@database_operation
def list_users(
    session: Session,
    offset: int = 0,
    limit: int = 20,
    search: str | None = None,
    rol: str | None = None,
    activo: bool | None = None,
) -> dict:
    statement = select(Usuario)

    if search:
        term = f"%{search.strip().lower()}%"
        statement = statement.where(
            or_(
                func.lower(Usuario.nombre).like(term),
                func.lower(Usuario.documento).like(term),
                func.lower(Usuario.correo).like(term),
            )
        )

    if rol:
        statement = statement.where(Usuario.rol == rol.strip().upper())

    if activo is not None:
        statement = statement.where(Usuario.activo.is_(activo))

    total = session.scalar(select(func.count()).select_from(statement.subquery())) or 0
    items = list(session.scalars(statement.order_by(Usuario.id).offset(offset).limit(limit)))
    return {"items": items, "total": total, "offset": offset, "limit": limit}


@database_operation
def get_user(session: Session, user_id: int) -> Usuario:
    return find_user(session, user_id)


@database_operation
def update_user(session: Session, user_id: int, data: UsuarioActualizar) -> Usuario:
    user = session.scalar(select(Usuario).where(Usuario.id == user_id).with_for_update())
    if user is None:
        raise UsuarioError(404, "Usuario no encontrado.")

    changes = data.model_dump(exclude_unset=True)
    if (
        changes.get("rol") not in (None, "ADMINISTRADOR")
        or changes.get("activo") is False
    ):
        _validar_no_ultimo_admin_activo(session, user)

    if "correo" in changes:
        correo_norm = changes["correo"].lower().strip()
        existing = session.scalar(
            select(Usuario.id).where(Usuario.correo == correo_norm, Usuario.id != user_id)
        )
        if existing:
            raise UsuarioError(409, "Ya existe otro usuario registrado con ese correo.")
        changes["correo"] = correo_norm

    if "documento" in changes:
        doc_clean = changes["documento"].strip()
        existing = session.scalar(
            select(Usuario.id).where(Usuario.documento == doc_clean, Usuario.id != user_id)
        )
        if existing:
            raise UsuarioError(409, "Ya existe otro usuario registrado con ese número de documento.")
        changes["documento"] = doc_clean

    if "operador_id" in changes and changes["operador_id"] is not None:
        operador = session.get(Operador, changes["operador_id"])
        if operador is None:
            raise UsuarioError(404, "El operador asociado especificado no existe.")

    if "password" in changes:
        pwd = changes.pop("password")
        if pwd:
            user.password_hash = hash_password(pwd)

    for key, value in changes.items():
        setattr(user, key, value)

    session.commit()
    session.refresh(user)
    return user


@database_operation
def deactivate_user(session: Session, user_id: int) -> Usuario:
    user = session.scalar(select(Usuario).where(Usuario.id == user_id).with_for_update())
    if user is None:
        raise UsuarioError(404, "Usuario no encontrado.")

    _validar_no_ultimo_admin_activo(session, user)
    user.activo = False
    session.commit()
    session.refresh(user)
    return user
