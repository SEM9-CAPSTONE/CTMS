"""Download only the pinned public model artifacts; no source PDF is read."""

import os
from pathlib import Path

os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["DO_NOT_TRACK"] = "1"
os.environ["HF_HUB_DISABLE_XET"] = "1"

if __name__ == "__main__":
    from huggingface_hub import snapshot_download
    from app.knowledge_models import EMBEDDING_MODEL, EMBEDDING_REVISION
    snapshot_download(EMBEDDING_MODEL, revision=EMBEDDING_REVISION)
    root = Path(os.environ["DOCLING_ARTIFACTS_PATH"])
    snapshot_download("docling-project/docling-layout-heron",
                      revision="8f39ad3c0b4c58e9c2d2c84a38465abf757272d8",
                      allow_patterns=["config.json", "preprocessor_config.json", "model.safetensors"],
                      local_dir=root / "docling-project--docling-layout-heron")
    snapshot_download("docling-project/docling-models",
                      revision="fc0f2d45e2218ea24bce5045f58a389aed16dc23",  # v2.3.0
                      allow_patterns=["model_artifacts/tableformer/**"],
                      local_dir=root / "docling-project--docling-models")
