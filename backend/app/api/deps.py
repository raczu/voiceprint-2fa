import uuid
from typing import Annotated, AsyncGenerator

from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import OAuth2PasswordBearer, SecurityScopes
from jose import JWTError, jwt
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import VoiceprintEngine, settings
from app.database import AsyncSessionLocal
from app.database.models import User
from app.schemas import TokenPayload

REUSABLE_OAUTH2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_PATH}/auth/login",
    scopes={
        "auth:full": "Full API access (standard user)",
        "2fa:required": "Restricted access (pending voice verification)",
        "onboarding:required": "Restricted access (voice enrollment only)",
    },
)


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
TokenDep = Annotated[str, Depends(REUSABLE_OAUTH2)]


def parse_jwt_token(token: TokenDep) -> TokenPayload:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY.get_secret_value(), algorithms=[settings.JWT_ALGORITHM])
        data = TokenPayload(**payload)
    except (JWTError, ValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Could not verify credentials"
        ) from exc
    return data


ParseJWTTokenDep = Annotated[TokenPayload, Depends(parse_jwt_token)]


async def get_current_user(
    security_scopes: SecurityScopes, session: SessionDep, payload: ParseJWTTokenDep
) -> User:
    authval = f"Bearer scope={security_scopes.scope_str}" if security_scopes.scopes else "Bearer"
    for scope in security_scopes.scopes:
        if scope not in payload.scopes:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not enough permissions",
                headers={"WWW-Authenticate": authval},
            )

    user: User | None = await session.get(User, uuid.UUID(payload.sub))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


CurrentUserDep = Annotated[User, Security(get_current_user, scopes=["auth:full"])]
Current2FAUserDep = Annotated[User, Security(get_current_user, scopes=["2fa:required"])]
CurrentEnrollmentUserDep = Annotated[User, Security(get_current_user, scopes=["onboarding:required"])]
