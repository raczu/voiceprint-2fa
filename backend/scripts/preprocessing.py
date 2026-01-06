import argparse
import logging
import sys
from pathlib import Path

import torchaudio
from app.core import (
    ModelCompatHandler,
    PeakNormalizationHandler,
    RMSNormalizationHandler,
    VADHandler,
)
from app.core.settings import settings

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Audio preprocessing script for testing purposes.")
    parser.add_argument(
        "--input", "-i", required=True, type=Path, help="Path to the input audio file."
    )
    parser.add_argument(
        "--output", "-o", required=True, type=Path, help="Path to save the processed audio file."
    )
    args = parser.parse_args()

    if args.input.suffix != ".wav":
        raise ValueError("Input file must be a .wav file")

    waveform, sr = torchaudio.load(args.input)
    pipeline = ModelCompatHandler()
    tail = pipeline
    if settings.VAD_ENABLED:
        tail = tail.next(VADHandler())
    tail.next(
        PeakNormalizationHandler()
        if settings.AMPLITUDE_NORMALIZATION_HANDLER == "peak"
        else RMSNormalizationHandler()
    )
    logger.info("Processing audio file: %s", args.input)
    waveform, sr = pipeline.handle(waveform, sr)
    torchaudio.save(args.output, waveform, sr)
    logger.info("Audio successfully processed and saved to: %s", args.output)


if __name__ == "__main__":
    main()
