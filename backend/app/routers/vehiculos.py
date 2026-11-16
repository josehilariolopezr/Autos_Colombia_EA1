from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_session
from app.models import Usuario
from app.schemas.vehiculo import VehiculoActualizar, VehiculoCrear, VehiculoRespuesta, VehiculosPagina
from app.services import vehiculo as service

router = APIRouter(
    prefix="/vehiculos",
    tags=["Vehículos"],
    dependencies=[Depends(get_current_user)],
)
DatabaseSession = Annotated[Session, Depends(get_session)]
VehicleId = Annotated[int, Path(ge=1, le=9223372036854775807)]
CurrentUser = Annotated[Usuario, Depends(get_current_user)]


@router.post("", response_model=VehiculoRespuesta, status_code=201, dependencies=[Depends(require_role(["ADMINISTRADOR"]))])
def create(data: VehiculoCrear, session: DatabaseSession):
    return service.create_vehicle(session, data)


@router.get("", response_model=VehiculosPagina)
def list_all(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0, le=9223372036854775807)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    incluir_inactivos: bool = False,
):
    return service.list_vehicles(session, offset, limit, incluir_inactivos)


@router.get(
    "/{id}",
    response_model=VehiculoRespuesta,
    dependencies=[Depends(require_role(["ADMINISTRADOR"]))],
)
def get_one(
    id: VehicleId,
    session: DatabaseSession,
):
    return service.get_vehicle(session, id)


@router.patch("/{id}", response_model=VehiculoRespuesta)
def update(
    id: VehicleId,
    data: VehiculoActualizar,
    session: DatabaseSession,
    current_user: CurrentUser,
):
    if current_user.rol != "ADMINISTRADOR" and data.model_fields_set != {"cliente_id"}:
        raise HTTPException(
            status_code=403,
            detail="El operador solo puede asociar o desvincular vehículos de clientes.",
        )
    return service.update_vehicle(session, id, data)


@router.delete(
    "/{id}",
    response_model=VehiculoRespuesta,
    dependencies=[Depends(require_role(["ADMINISTRADOR"]))],
)
def deactivate(id: VehicleId, session: DatabaseSession):
    return service.delete_vehicle(session, id)
