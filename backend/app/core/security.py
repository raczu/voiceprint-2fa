from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext

from app.core.settings import settings

PWD_CONTEXT = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_token(subject: str, name: str, delta: timedelta, scopes: list[str]) -> str:
    now = datetime.now(timezone.utc)
    expire = now + delta
    to_encode = {"exp": expire, "sub": subject, "name": name, "iat": now, "scopes": scopes}
    encoded_jwt = jwt.encode(
        to_encode, settings.JWT_SECRET_KEY.get_secret_value(), algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def verify_password(plan: str, hashed: str) -> bool:
    return PWD_CONTEXT.verify(plan, hashed)


def get_password_hash(password: str) -> str:
    return PWD_CONTEXT.hash(password)
