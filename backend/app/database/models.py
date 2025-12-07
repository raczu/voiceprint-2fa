import re
import uuid

import numpy as np
from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, validates

EMBEDDING_DIM = 192
EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$")
USERNAME_RE = re.compile(r"^\w{4,}$")


class Base(DeclarativeBase): ...


class User(Base):
    __tablename__: str = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), index=True, unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(50), nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    voiceprint: Mapped[np.ndarray] = mapped_column(Vector(EMBEDDING_DIM))
    phrase: Mapped["Phrase"] = relationship("Phrase", back_populates="user", uselist=False)

    @validates("email")
    def _validate_email(self, key: str, address: str) -> str:
        if not EMAIL_RE.match(address):
            raise ValueError("Email address violates format requirements")
        return address

    @validates("username")
    def _validate_username(self, key: str, username: str) -> str:
        if not USERNAME_RE.match(username):
            raise ValueError("Username violates format requirements")
        return username


class Phrase(Base):
    __tablename__: str = "phrases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content: Mapped[str] = mapped_column(String(2048), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True
    )
    user: Mapped["User"] = relationship("User", back_populates="phrase")


class DummyVoiceprint(Base):
    """Dummy table for testing purposes only during development."""

    __tablename__: str = "dummy_voiceprints"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    voiceprint: Mapped[np.ndarray] = mapped_column(Vector(EMBEDDING_DIM))
