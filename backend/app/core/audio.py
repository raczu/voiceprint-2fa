import logging
from abc import ABC, abstractmethod
from typing import Literal, Self, override

import numpy as np
import torch
import torchaudio
import webrtcvad

logger = logging.getLogger(__name__)


class AudioHandlerError(Exception):
    """Custom exception for audio handler errors."""


class EmbeddingAggregator(ABC):
    """Abstract base class for embedding aggregation strategies."""

    @abstractmethod
    def aggregate(self, embeddings: list[torch.Tensor]) -> torch.Tensor:
        raise NotImplementedError


class MeanAggregator(EmbeddingAggregator):
    """Aggregates embeddings by computing their mean."""

    @override
    def aggregate(self, embeddings: list[torch.Tensor]) -> torch.Tensor:
        return torch.mean(torch.stack(embeddings), dim=0)


class SimpleSelfAttentionAggregator(EmbeddingAggregator):
    """Aggregates embeddings using a simple self-attention mechanism."""

    _ATTENTION_DIM: int = 128

    def __init__(self, dim: int, device: Literal["cpu", "cuda"] = "cpu") -> None:
        super().__init__()
        self._attention = torch.nn.Sequential(
            torch.nn.Linear(dim, self._ATTENTION_DIM),
            torch.nn.Tanh(),
            torch.nn.Linear(self._ATTENTION_DIM, 1),
            torch.nn.Softmax(dim=0),
        ).to(device)

    @override
    def aggregate(self, embeddings: list[torch.Tensor]) -> torch.Tensor:
        stacked = torch.stack(embeddings)
        weights = self._attention(stacked)
        aggregated = torch.sum(weights * stacked, dim=0)
        return aggregated


class AudioHandler(ABC):
    """Abstract base class for audio processing handlers in a chain of responsibility pattern."""

    def __init__(self) -> None:
        self._next_handler: AudioHandler | None = None

    def next(self, handler: "AudioHandler") -> Self:
        self._next_handler = handler
        return handler

    @abstractmethod
    def process(self, waveform: torch.Tensor, sr: int) -> tuple[torch.Tensor, int]:
        raise NotImplementedError

    def handle(self, waveform: torch.Tensor, sr: int) -> tuple[torch.Tensor, int]:
        """Handle the audio by processing it and passing it to the next handler if exists."""
        waveform, sr = self.process(waveform, sr)
        logger.debug(
            "Processed audio with %s handler; waveform shape: %s",
            self.__class__.__name__,
            waveform.shape,
        )
        if self._next_handler is not None:
            return self._next_handler.handle(waveform, sr)
        return waveform, sr


class ModelCompatHandler(AudioHandler):
    """
    Guarantees that the audio waveform is compatible with ECAPA-TDNN or x-vector model requirements.

    Resamples the audio to 16 kHz and converts it to mono if necessary.
    """

    _TARGET_SR: int = 16000

    @override
    def process(self, waveform: torch.Tensor, sr: int) -> tuple[torch.Tensor, int]:
        if waveform.dtype not in (torch.float32, torch.float64):
            raise AudioHandlerError(
                "ModelCompatHandler expects a waveform with float32 or float64 dtype"
            )
        if sr != self._TARGET_SR:
            waveform = torchaudio.functional.resample(waveform, sr, self._TARGET_SR)
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)
        return waveform, self._TARGET_SR


class PeakNormalizationHandler(AudioHandler):
    """Applies peak normalization to the audio waveform."""

    _TARGET_DB: float = -6.0

    @override
    def process(self, waveform: torch.Tensor, sr: int) -> tuple[torch.Tensor, int]:
        peak = waveform.abs().max()
        if peak > 1e-6:
            tp = 10 ** (self._TARGET_DB / 20)
            waveform = waveform * (tp / peak)
        return waveform, sr


class RMSNormalizationHandler(AudioHandler):
    """Applies RMS normalization to the audio waveform."""

    _TARGET_DBFS: float = -20.0

    @override
    def process(self, waveform: torch.Tensor, sr: int) -> tuple[torch.Tensor, int]:
        rms = torch.sqrt(torch.mean(waveform**2))
        if rms > 1e-6:
            trms = 10 ** (self._TARGET_DBFS / 20)
            waveform = waveform * (trms / rms)
        return waveform, sr


class VADHandler(AudioHandler):
    """Applies Voice Activity Detection (VAD) to the audio waveform."""

    # Using WebRTC VAD aggressiveness mode (0-3):
    # * 0: least aggressive, most permissive.
    # * 1: low bitrate mode.
    # * 2: aggressive mode (recommended for voice authentication).
    # * 3: most aggressive, least permissive.
    _AGRESSIVENESS: int = 3
    # Use 10, 20, or 30 ms frame durations (required by webrtcvad).
    _FRAME_DURATION_MS: int = 30
    _SILENCE_PADDING_MS: int = 300

    def __init__(self) -> None:
        super().__init__()
        self._vad = webrtcvad.Vad(self._AGRESSIVENESS)

    @override
    def process(self, waveform: torch.Tensor, sr: int) -> tuple[torch.Tensor, int]:
        wav1d = waveform.squeeze(0).cpu().numpy()
        wavi16 = np.int16(wav1d * 32767)
        frame_len = int(sr * self._FRAME_DURATION_MS / 1000)
        frames_num = int(np.ceil(len(wavi16) / frame_len))
        padlen = frames_num * frame_len - len(wavi16)
        if padlen > 0:
            wavi16 = np.pad(wavi16, (0, padlen), mode="constant")

        frames = wavi16.reshape(frames_num, frame_len)
        voiced = np.zeros(frames_num, dtype=bool)
        for idx, frame in enumerate(frames):
            try:
                voiced[idx] = self._vad.is_speech(frame.tobytes(), sr)
            except Exception:  # noqa
                logger.warning("webrtcvad failed to process frame %d; marking as voiced", idx)
                voiced[idx] = True

        if not voiced.any():
            logger.debug("VAD detected no speech in the audio; returning original waveform")
            return waveform, sr

        padding_frames = max(0, int(self._SILENCE_PADDING_MS / self._FRAME_DURATION_MS))
        if padding_frames > 0:
            kernel = np.ones(2 * padding_frames + 1, dtype=int)
            dilated = np.convolve(voiced.astype(int), kernel, mode="same") > 0
        else:
            dilated = voiced

        selected = frames[dilated]
        if selected.size == 0:
            logger.debug("VAD detected no speech after padding; returning original waveform")
            return waveform, sr

        speechi16 = selected.reshape(-1)
        speechf32 = speechi16.astype(np.float32) / 32767.0
        speech = np.clip(speechf32, -1.0, 1.0)
        tensor = torch.from_numpy(speech).unsqueeze(0).to(torch.float32)
        logger.debug("VAD reduced audio from %.3fs to %.3fs", len(wav1d) / sr, tensor.shape[1] / sr)

        return tensor, sr
