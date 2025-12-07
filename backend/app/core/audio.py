from abc import ABC, abstractmethod
from typing import Self, override

import torch
import torchaudio


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

    def __init__(self, dim: int) -> None:
        super().__init__()
        self._attention = torch.nn.Sequential(
            torch.nn.Linear(dim, self._ATTENTION_DIM),
            torch.nn.Tanh(),
            torch.nn.Linear(self._ATTENTION_DIM, 1),
            torch.nn.Softmax(dim=0),
        )

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
        if self._next_handler is not None:
            return self._next_handler.handle(waveform, sr)
        return waveform, sr


class ECAPACompatHandler(AudioHandler):
    """
    Guarantees that the audio waveform is compatible with ECAPA-TDNN model requirements.

    Resamples the audio to 16 kHz and converts it to mono if necessary.
    """

    _TARGET_SR: int = 16000

    @override
    def process(self, waveform: torch.Tensor, sr: int) -> tuple[torch.Tensor, int]:
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
