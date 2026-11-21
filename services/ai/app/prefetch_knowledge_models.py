"""Download only the pinned public model artifacts; no source PDF is read."""

import argparse
import os
from pathlib import Path

from app.knowledge_artifacts import (
    EMBEDDING_FILES, EMBEDDING_MODEL, EMBEDDING_REVISION,
    LAYOUT_MODEL, LAYOUT_REVISION, TABLE_MODEL, TABLE_REVISION,
)

os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["DO_NOT_TRACK"] = "1"
os.environ["HF_HUB_DISABLE_XET"] = "1"


def prefetch_models(target: str = "all") -> None:
    if target not in {"all", "embedding", "layout", "table"}:
        raise ValueError("Unknown model artifact group")
    from huggingface_hub import snapshot_download
    if target in {"all", "embedding"}:
        snapshot = Path(snapshot_download(
            EMBEDDING_MODEL, revision=EMBEDDING_REVISION, allow_patterns=list(EMBEDDING_FILES),
        ))
        # Fail the build instead of publishing an image that later needs network
        # access to complete its tokenizer, pooling configuration or weights.
        missing = [name for name in EMBEDDING_FILES if not (snapshot / name).is_file()]
        if missing:
            raise RuntimeError(f"Incomplete embedding snapshot: {', '.join(missing)}")
    if target == "embedding":
        return
    root = Path(os.environ["DOCLING_ARTIFACTS_PATH"])
    if target in {"all", "layout"}:
        snapshot_download(LAYOUT_MODEL, revision=LAYOUT_REVISION,
                          allow_patterns=["config.json", "preprocessor_config.json", "model.safetensors"],
                          local_dir=root / "docling-project--docling-layout-heron")
    if target in {"all", "table"}:
        snapshot_download(TABLE_MODEL, revision=TABLE_REVISION,
                          allow_patterns=["model_artifacts/tableformer/**"],
                          local_dir=root / "docling-project--docling-models")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", nargs="?", default="all", choices=("all", "embedding", "layout", "table"))
    prefetch_models(parser.parse_args().target)
