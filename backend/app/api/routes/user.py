from fastapi import APIRouter

from app.api.deps import CurrentUserDep
from app.database.models import User
from app.schemas import UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead, summary="Get current user information")
async def get_user_me(user: CurrentUserDep) -> User:
    return user
