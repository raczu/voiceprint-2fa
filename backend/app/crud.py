import uuid

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import get_password_hash, verify_password
from app.database.models import Phrase, User
from app.schemas import UserCreate


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user_with_phrase(
    session: AsyncSession, user_in: UserCreate, phrase_id: uuid.UUID
) -> User:
    user = User(
        name=user_in.name,
        surname=user_in.surname,
        email=str(user_in.email),
        username=user_in.username,
        password=get_password_hash(user_in.password),
        phrase_id=phrase_id,
        is_enrollment_complete=False,
        voiceprint=None,
    )
    session.add(user)
    await session.flush()
    await session.refresh(user)
    return user


async def reset_incomplete_enrollment_user(
    session: AsyncSession, user: User, user_in: UserCreate, phrase_id: uuid.UUID
) -> User:
    user.name = user_in.name
    user.surname = user_in.surname
    user.email = str(user_in.email)
    user.username = user_in.username
    user.password = get_password_hash(user_in.password)
    user.phrase_id = phrase_id
    user.is_enrollment_complete = False
    user.voiceprint = None

    await session.flush()
    await session.refresh(user)
    return user


async def update_user_voiceprint(session: AsyncSession, user: User, embedding: np.ndarray) -> User:
    user.voiceprint = embedding
    user.is_enrollment_complete = True
    await session.flush()
    await session.refresh(user)
    return user


async def authenticate_user(session: AsyncSession, email: str, password: str) -> User | None:
    user = await get_user_by_email(session, email)
    if user is not None:
        mismatch = not verify_password(password, user.password)
        if mismatch:
            user = None
    return user


async def get_random_phrase(session: AsyncSession) -> Phrase | None:
    result = await session.execute(select(Phrase).order_by(func.random()).limit(1))
    return result.scalar_one_or_none()


async def create_phrase(session: AsyncSession, content: str) -> Phrase:
    phrase = Phrase(content=content)
    session.add(phrase)
    await session.flush()
    await session.refresh(phrase)
    return phrase
