"""Pinned runtime artifacts, independent of document schemas and application code."""

EMBEDDING_MODEL = "intfloat/multilingual-e5-small"
EMBEDDING_REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3"
# SentenceTransformer's PyTorch backend needs one set of weights. Do not ship
# the duplicate pickle weights, ONNX/OpenVINO exports or evaluation datasets.
EMBEDDING_FILES = (
    "config.json",
    "model.safetensors",
    "modules.json",
    "sentence_bert_config.json",
    "sentencepiece.bpe.model",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "1_Pooling/config.json",
)

LAYOUT_MODEL = "docling-project/docling-layout-heron"
LAYOUT_REVISION = "8f39ad3c0b4c58e9c2d2c84a38465abf757272d8"
TABLE_MODEL = "docling-project/docling-models"
TABLE_REVISION = "fc0f2d45e2218ea24bce5045f58a389aed16dc23"  # v2.3.0
