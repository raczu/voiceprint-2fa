import asyncio
import logging
from typing import Any

import numpy as np
import torch
import torchaudio
from fastapi import APIRouter, HTTPException, Response, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.api.deps import SessionDep, VPEngineDep
from app.core import settings
from app.database import DummyVoiceprint
from app.schemas import VerifyResponse

router = APIRouter(prefix="/private", tags=["private"])
logger = logging.getLogger(__name__)


@router.post(
    "/enroll/{username}",
    summary="Enroll a user's voiceprint for testing purposes",
    status_code=status.HTTP_201_CREATED,
)
async def enroll(
    username: str, files: list[UploadFile], *, session: SessionDep, vpengine: VPEngineDep
) -> Response:
    result = await session.execute(
        select(DummyVoiceprint).where(DummyVoiceprint.username == username)
    )
    voiceprint = result.scalar_one_or_none()
    if voiceprint is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Voiceprint for this user already exists",
        )
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
    session.add(DummyVoiceprint(username=username, voiceprint=voiceprint))
    return Response(status_code=status.HTTP_201_CREATED)


@router.post(
    "/verify/{username}",
    summary="Verify a user's test voiceprint",
    response_model=VerifyResponse,
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": VerifyResponse},
    },
)
async def verify(
    username: str, file: UploadFile, *, session: SessionDep, vpengine: VPEngineDep
) -> Any:
    result = await session.execute(
        select(DummyVoiceprint).where(DummyVoiceprint.username == username)
    )
    voiceprint = result.scalar_one_or_none()
    if voiceprint is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Voiceprint for this user does not exist",
        )

    waveform, sr = await asyncio.to_thread(torchaudio.load, file.file)
    embedding = vpengine.embed(waveform, sr)
    reference = torch.from_numpy(voiceprint.voiceprint).to(device=vpengine.device)
    success, score = vpengine.verify(embedding, reference)
    logger.info("Voiceprint verification score for user '%s': %.4f", username, score)

    response = VerifyResponse(
        success=success, score=score, threshold=settings.VERIFICATION_THRESHOLD
    )
    if not success:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content=response.model_dump())
    return response
