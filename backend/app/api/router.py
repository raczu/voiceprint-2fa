from fastapi import APIRouter

from app.api.routes import private
from app.core import settings

router = APIRouter()
if settings.ENVIRONMENT == "development":
    router.include_router(private.router)
