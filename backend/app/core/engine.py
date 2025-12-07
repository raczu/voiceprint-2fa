from typing import Literal

import torch
import torch.nn.functional
from speechbrain.inference.speaker import SpeakerRecognition

from app.core.audio import (
    ECAPACompatHandler,
    MeanAggregator,
    PeakNormalizationHandler,
    RMSNormalizationHandler,
    SimpleSelfAttentionAggregator,
)
from app.core.settings import settings


class VoiceprintEngine:
    def __init__(
        self, recognizer: SpeakerRecognition, device: Literal["cpu", "cuda"] = "cpu"
    ) -> None:
        self._device = device
        recognizer.to(device=device)
        self._recognizer = recognizer

        ecapa = ECAPACompatHandler()
        ecapa.next(
            PeakNormalizationHandler()
            if settings.AMPLITUDE_NORMALIZATION_HANDLER == "peak"
            else RMSNormalizationHandler()
        )
        self._preprocessing_pipeline = ecapa
        self._aggregator = (
            MeanAggregator()
            if settings.EMBEDDING_AGGREGATION_STRATEGY == "mean"
            else SimpleSelfAttentionAggregator(dim=192)
        )

    @property
    def device(self) -> Literal["cpu", "cuda"]:
        """Get the device on which the engine (torch) is running."""
        return self._device

    def _preprocess(self, waveform: torch.Tensor, sr: int) -> tuple[torch.Tensor, int]:
        """Preprocess the audio waveform using a chain of audio handlers."""
        return self._preprocessing_pipeline.handle(waveform, sr)

    def embed(self, waveform: torch.Tensor, sr: int) -> torch.Tensor:
        """Assemble the voiceprint embedding from the given waveform and sample rate.

        Prepares the audio to match the ECAPA-TDNN model requirements and use additional
        preprocessing handlers to refine the audio quality before extracting the embedding.
        """
        waveform, _ = self._preprocess(waveform, sr)
        if waveform.dim() == 1:
            waveform = waveform.unsqueeze(0)
        if waveform.dim() > 2:
            waveform = waveform.mean(dim=0, keepdim=True)

        embedding = self._recognizer.encode_batch(waveform)
        return embedding.flatten()

    def aggregate(self, embeddings: list[torch.Tensor]) -> torch.Tensor:
        """Aggregate multiple voiceprint embeddings into a single embedding."""
        return self._aggregator.aggregate(embeddings)

    @staticmethod
    def verify(embedding: torch.Tensor, reference: torch.Tensor) -> tuple[bool, float]:
        """Verify if the given embedding matches the reference embedding.

        Uses cosine similarity to compare the two embeddings and determine if they
        belong to the same speaker.

        Returns:
            A tuple containing a boolean indicating if the embeddings match and the
            similarity score as a float.
        """
        emb = embedding.squeeze().float()
        ref = reference.squeeze().float()

        emb = torch.nn.functional.normalize(emb, p=2, dim=0)
        ref = torch.nn.functional.normalize(ref, p=2, dim=0)
        score = float(torch.dot(emb, ref).item())
        return score >= settings.VERIFICATION_THRESHOLD, score
