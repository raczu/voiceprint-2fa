from typing import Annotated, AsyncGenerator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import VoiceprintEngine
from app.database import AsyncSessionLocal


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except SQLAlchemyError:
            await session.rollback()
            raise
        finally:
            await session.close()


def get_vpengine(request: Request) -> VoiceprintEngine:
    vpengine = getattr(request.app.state, "vpengine", None)
    if vpengine is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Speaker recognizer model is not available at the moment",
        )
    return vpengine


VPEngineDep = Annotated[VoiceprintEngine, Depends(get_vpengine)]
SessionDep = Annotated[AsyncSession, Depends(get_db)]
