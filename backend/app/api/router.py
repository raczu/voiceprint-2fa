from fastapi import APIRouter

from app.api.routes import auth, private, user
from app.core import settings

router = APIRouter()
router.include_router(auth.router)
router.include_router(user.router)
if settings.ENVIRONMENT == "development":
    router.include_router(private.router)
