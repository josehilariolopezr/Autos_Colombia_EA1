from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_session
from app.schemas.dashboard import DashboardResumen
from app.services.dashboard import get_dashboard_summary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
DatabaseSession = Annotated[Session, Depends(get_session)]


@router.get("/resumen", response_model=DashboardResumen)
def resumen(session: DatabaseSession) -> DashboardResumen:
    return get_dashboard_summary(session)
