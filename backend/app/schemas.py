import re
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

PASSWORD_RE = re.compile(r"^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{12,}$")
USERNAME_RE = re.compile(r"^\w{4,}$")


class VerifyResponse(BaseModel):
    success: bool
    score: float
    threshold: float


class Token(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class TokenWithPhrase(Token):
    phrase: str


class TokenPayload(BaseModel):
    sub: str | None = None
    scopes: list[str] = []


class UserBase(BaseModel):
    name: str
    surname: str
    email: EmailStr
    username: str


class UserCreate(UserBase):
    password: str

    @field_validator("password", mode="after")
    @classmethod
    def _validate_password(cls, v: str) -> str:
        if not PASSWORD_RE.match(v):
            raise ValueError(
                "Password must be at least 8 characters long and include at least one uppercase letter, "
                "one lowercase letter, one digit, and one special character"
            )
        return v

    @field_validator("username", mode="after")
    @classmethod
    def _validate_username(cls, v: str) -> str:
        if not USERNAME_RE.match(v):
            raise ValueError(
                "Username must be at least 4 characters long and contain only alphanumeric characters "
                "and underscores"
            )
        return v


class UserInDB(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


class UserRead(UserInDB): ...
