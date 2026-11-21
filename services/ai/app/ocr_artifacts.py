"""Pinned Tesseract 5.5.0 / tessdata_best 4.1.0 artifacts, prefetched at build time."""

import hashlib
import os
from pathlib import Path
import urllib.request

MODELS = {
    "vie": "b6b49293d95d0b6dbd8780174627e82c75be957b6f4ed9862155540d6b00bb45",
    "eng": "8280aed0782fe27257a68ea10fe7ef324ca0f8d85bd2fd145d1c2b560bcb66ba",
    "osd": "9cf5d576fcc47564f11265841e5ca839001e7e6f38ff7f7aacf46d15a96b00ff",
}
TSV_CONFIG = b"tessedit_create_tsv 1\n"


class OcrRuntimeError(RuntimeError):
    """Missing runtime/artifacts, timeout or failed recognition is retryable."""


def verify_models(folder: str | None) -> None:
    if not folder:
        raise OcrRuntimeError("ocr_models_not_configured")
    for language, expected in MODELS.items():
        path = Path(folder) / f"{language}.traineddata"
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise OcrRuntimeError("ocr_model_checksum_mismatch")
    config = Path(folder) / "configs" / "tsv"
    if not config.is_file() or config.read_bytes() != TSV_CONFIG:
        raise OcrRuntimeError("ocr_tsv_config_missing")


def download_models(folder: str) -> None:
    root = Path(folder)
    root.mkdir(parents=True, exist_ok=True)
    for language, checksum in MODELS.items():
        target = root / f"{language}.traineddata"
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == checksum:
            continue
        with urllib.request.urlopen(
            f"https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/4.1.0/{language}.traineddata",
            timeout=120,
        ) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != checksum:
            raise ValueError("OCR artifact checksum mismatch")
        target.write_bytes(data)
    (root / "configs").mkdir(exist_ok=True)
    (root / "configs" / "tsv").write_bytes(TSV_CONFIG)
    verify_models(folder)


if __name__ == "__main__":
    download_models(os.environ["CTMS_TESSDATA_PATH"])
