import asyncio
from datetime import timedelta
from typing import Annotated

import numpy as np
import torch
import torchaudio
from fastapi import Depends, HTTPException, UploadFile, status
from fastapi.routing import APIRouter
from fastapi.security import OAuth2PasswordRequestForm

from app import crud
from app.api.deps import Current2FAUserDep, CurrentEnrollmentUserDep, SessionDep, VPEngineDep
from app.core import create_token, settings
from app.schemas import Token, TokenWithPhrase, UserCreate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    summary="Initiate user registration",
    response_model=TokenWithPhrase,
    status_code=status.HTTP_201_CREATED,
)
async def register(user_in: UserCreate, session: SessionDep) -> TokenWithPhrase:
    user = await crud.get_user_by_email(session, str(user_in.email))
    if user is not None and user.is_enrollment_complete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    phrase = await crud.get_random_phrase(session)
    if phrase is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No phrases available for enrollment",
        )

    if user is None:
        user = await crud.create_user_with_phrase(session, user_in, phrase.id)
    else:
        user = await crud.reset_incomplete_enrollment_user(session, user, user_in, phrase.id)

    token = create_token(
        subject=str(user.id),
        name=f"{user.name} {user.surname}",
        delta=timedelta(minutes=settings.ENROLLMENT_TOKEN_EXPIRE_MINUTES),
        scopes=["onboarding:required"],
    )
    return TokenWithPhrase(
        access_token=token,
        phrase=phrase.content,
        expires_in=settings.ENROLLMENT_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/register/enroll-voice",
    summary="Complete user registration with voice enrollment",
    response_model=Token,
)
async def enroll_voice(
    files: list[UploadFile],
    session: SessionDep,
    user: CurrentEnrollmentUserDep,
    vpengine: VPEngineDep,
) -> Token:
    if len(files) < settings.MIN_NUMBER_OF_ENROLLMENT_FILES:  # noqa
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"At least {settings.MIN_NUMBER_OF_ENROLLMENT_FILES} enrollment files are required",
        )

    embeddings = []
    for file in files:
        waveform, sr = await asyncio.to_thread(torchaudio.load, file.file)
        embedding = vpengine.embed(waveform, sr)
        embeddings.append(embedding)
    aggregated = vpengine.aggregate(embeddings)
    voiceprint = aggregated.detach().cpu().numpy().astype(np.float32)
    await crud.update_user_voiceprint(session, user, voiceprint)

    token = create_token(
        subject=str(user.id),
        name=f"{user.name} {user.surname}",
        delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        scopes=["auth:full"],
    )
    return Token(access_token=token, expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)


@router.post(
    "/login",
    summary="Authenticate user with email and password",
    response_model=TokenWithPhrase,
)
async def login(
    session: SessionDep, form: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> TokenWithPhrase:
    user = await crud.authenticate_user(session, form.username, form.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_enrollment_complete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Voice enrollment is not complete",
        )

    token = create_token(
        subject=str(user.id),
        name=f"{user.name} {user.surname}",
        delta=timedelta(minutes=settings.PRE_AUTH_TOKEN_EXPIRE_MINUTES),
        scopes=["2fa:required"],
    )
    return TokenWithPhrase(
        access_token=token,
        phrase=user.phrase.content,
        expires_in=settings.PRE_AUTH_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/login/verify-voice",
    summary="Verify user's voice for authentication",
    response_model=Token,
)
async def verify_voice(file: UploadFile, user: Current2FAUserDep, vpengine: VPEngineDep) -> Token:
    waveform, sr = await asyncio.to_thread(torchaudio.load, file.file)
    embedding = vpengine.embed(waveform, sr)
    reference = torch.from_numpy(user.voiceprint).to(device=vpengine.device)

    score = vpengine.verify(embedding, reference)
    if score < settings.VOICE_VERIFICATION_THRESHOLD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Voice verification failed",
        )

    token = create_token(
        subject=str(user.id),
        name=f"{user.name} {user.surname}",
        delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        scopes=["auth:full"],
    )
    return Token(access_token=token, expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
