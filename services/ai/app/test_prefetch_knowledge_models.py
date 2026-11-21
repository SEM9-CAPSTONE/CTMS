"""Model provisioning must ship a complete offline runtime, not every export."""

import os
from pathlib import Path
import shutil
import socket

import pytest

from app.knowledge_artifacts import (
    EMBEDDING_FILES, EMBEDDING_MODEL, EMBEDDING_REVISION,
    LAYOUT_MODEL, LAYOUT_REVISION, TABLE_MODEL, TABLE_REVISION,
)
from app.prefetch_knowledge_models import prefetch_models


def embedding_snapshot(root):
    for name in EMBEDDING_FILES:
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"artifact")
    return str(root)


@pytest.mark.parametrize("missing", ["model.safetensors", "modules.json", "tokenizer.json", "1_Pooling/config.json"])
def test_incomplete_embedding_fails_before_publishing_or_downloading_other_models(tmp_path, monkeypatch, missing):
    from unittest.mock import Mock

    embedding_snapshot(tmp_path)
    (tmp_path / missing).unlink()
    download = Mock(return_value=str(tmp_path))
    monkeypatch.setattr("huggingface_hub.snapshot_download", download)
    with pytest.raises(RuntimeError, match="Incomplete embedding snapshot"):
        prefetch_models()
    assert download.call_count == 1


def test_embedding_layer_does_not_require_docling_configuration(tmp_path, monkeypatch):
    from unittest.mock import Mock

    download = Mock(return_value=embedding_snapshot(tmp_path))
    monkeypatch.setattr("huggingface_hub.snapshot_download", download)
    monkeypatch.delenv("DOCLING_ARTIFACTS_PATH", raising=False)
    prefetch_models("embedding")
    download.assert_called_once()
    assert download.call_args.args == (EMBEDDING_MODEL,)
    assert download.call_args.kwargs["revision"] == EMBEDDING_REVISION
    selected = download.call_args.kwargs["allow_patterns"]
    assert "model.safetensors" in selected
    assert "1_Pooling/config.json" in selected
    assert not any("*" in name for name in selected)
    assert "pytorch_model.bin" not in selected


def test_all_artifact_groups_keep_pinned_provenance_and_schema_contract(tmp_path, monkeypatch):
    from unittest.mock import Mock
    from app.knowledge_models import IngestionConfiguration

    download = Mock(return_value=embedding_snapshot(tmp_path / "embedding"))
    monkeypatch.setattr("huggingface_hub.snapshot_download", download)
    monkeypatch.setenv("DOCLING_ARTIFACTS_PATH", str(tmp_path / "docling"))
    prefetch_models()
    calls = download.call_args_list
    assert [(call.args[0], call.kwargs["revision"]) for call in calls] == [
        (EMBEDDING_MODEL, EMBEDDING_REVISION), (LAYOUT_MODEL, LAYOUT_REVISION), (TABLE_MODEL, TABLE_REVISION),
    ]
    contract = IngestionConfiguration()
    assert contract.embedding_model == EMBEDDING_MODEL
    assert contract.embedding_revision == EMBEDDING_REVISION
    assert contract.embedding_dimensions == 384


@pytest.mark.skipif(os.environ.get("RUN_KNOWLEDGE_MODEL_SMOKE") != "true", reason="Requires cached pinned E5 weights")
def test_only_selected_embedding_files_can_encode_both_languages_without_network(tmp_path, monkeypatch):
    from huggingface_hub import snapshot_download
    from sentence_transformers import SentenceTransformer

    cached = Path(snapshot_download(EMBEDDING_MODEL, revision=EMBEDDING_REVISION, local_files_only=True))
    # A fresh folder prevents an unused export or file in an older cache from
    # accidentally hiding an incomplete runtime allowlist.
    for name in EMBEDDING_FILES:
        destination = tmp_path / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(cached / name, destination)

    def deny_network(*args, **kwargs):
        raise AssertionError("The packaged embedding model must run offline")

    monkeypatch.setattr(socket.socket, "connect", deny_network)
    monkeypatch.setattr(socket, "create_connection", deny_network)
    model = SentenceTransformer(str(tmp_path), device="cpu", local_files_only=True, trust_remote_code=False)
    vectors = model.encode(["query: What does the handbook say?", "query: Nội dung tài liệu là gì?"],
                           normalize_embeddings=True, show_progress_bar=False)
    assert vectors.shape == (2, 384)
    assert all(abs(float((vector ** 2).sum()) - 1) < 0.001 for vector in vectors)
