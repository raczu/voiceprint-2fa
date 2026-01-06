import importlib.metadata
import logging.config
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Literal

import torch
from fastapi import FastAPI
from speechbrain.inference.speaker import SpeakerRecognition
from starlette.middleware.cors import CORSMiddleware

from app.api import router
from app.core import LOGGING_CONFIG, VoiceprintEngine, settings

logging.config.dictConfig(LOGGING_CONFIG)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    device: Literal["cpu", "cuda"] = "cuda" if torch.cuda.is_available() else "cpu"
    recognizer = SpeakerRecognition.from_hparams(
        source=f"speechbrain/spkrec-{settings.RECOGNIZER_MODEL}-voxceleb",
        run_opts={"device": device},
    )
    vpengine = VoiceprintEngine(recognizer=recognizer, device=device)
    app.state.vpengine = vpengine  # type: ignore[attr-defined]
    yield
    del app.state.vpengine  # type: ignore[attr-defined]
    if device == "cuda":
        torch.cuda.empty_cache()


app = FastAPI(
    lifespan=lifespan,
    title="voiceprint-app",
    version=importlib.metadata.version("app"),
    openapi_url=f"{settings.API_PATH}/openapi.json",
    description="Voiceprint-based two-factor authentication system.",
)

if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(router, prefix=settings.API_PATH)
