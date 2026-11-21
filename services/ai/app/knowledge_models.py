"""CTMS-051 internal ingestion contract. No LLM or generated source context."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

PIPELINE_VERSION = "ctms-content-integrity-v5"
EMBEDDING_MODEL = "intfloat/multilingual-e5-small"
EMBEDDING_REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3"
EMBEDDING_DIMENSIONS = 384
MAX_EMBEDDING_TOKENS = 480
CONTEXT_TOKENIZER = "e5-sentencepiece"
MAX_QUERY_LENGTH = 2_000
MAX_CONTEXT_BLOCKS = 10
MAX_CONTEXT_BLOCK_BYTES = 16_384
MAX_PDF_BYTES = 52_428_800
MAX_CHUNKS = 10_000
MAX_PAGES = 1_000
MAX_PASSAGE_BATCH = 128


class IngestionConfiguration(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    pipeline_version: Literal["ctms-content-integrity-v5"] = PIPELINE_VERSION
    verification_revision: int = Field(default=0, ge=0)
    embedding_model: Literal["intfloat/multilingual-e5-small"] = EMBEDDING_MODEL
    embedding_revision: Literal["614241f622f53c4eeff9890bdc4f31cfecc418b3"] = EMBEDDING_REVISION
    embedding_dimensions: Literal[384] = EMBEDDING_DIMENSIONS
    max_tokens: Literal[480] = MAX_EMBEDDING_TOKENS


class IngestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_version_id: UUID
    source_version: int = Field(gt=0)
    checksum: str = Field(pattern=r"^[a-f0-9]{64}$")
    locale: str = Field(min_length=2, max_length=35)
    title: str = Field(min_length=1, max_length=300)
    configuration: IngestionConfiguration
    pdf_base64: str = Field(min_length=1, max_length=4 * ((MAX_PDF_BYTES + 2) // 3))
    extraction_snapshot: dict | None = None


class SourceBox(BaseModel):
    l: float
    t: float
    r: float
    b: float
    coord_origin: Literal["TOPLEFT", "BOTTOMLEFT"]


class SourceLocation(BaseModel):
    page: int = Field(gt=0)
    item_ref: str
    bbox: SourceBox


class PreparedChunk(BaseModel):
    chunk_index: int
    content: str
    embedding_text: str
    token_count: int
    headings: list[str]
    locations: list[SourceLocation]


class EmbeddedChunk(PreparedChunk):
    embedding: list[float]


class PageExtractionReport(BaseModel):
    page: int
    mode: Literal["native", "ocr", "mixed", "blank", "unverified", "manual"]
    ocr_words: int = 0
    minimum_confidence: float | None = None
    text_coverage: float | None = None
    issues: list[str] = Field(default_factory=list)
    regions: list[dict] = Field(default_factory=list)


class QualityReport(BaseModel):
    status: Literal["PASSED", "NEEDS_REVIEW"]
    issues: list[str]
    page_count: int
    pages: list[PageExtractionReport] = Field(default_factory=list)
    integrity: dict | None = None


class PreparedIngestionResponse(BaseModel):
    document_version_id: UUID
    source_version: int
    checksum: str
    locale: str
    configuration: IngestionConfiguration
    quality: QualityReport
    chunks: list[PreparedChunk]
    extraction_snapshot: dict | None = None


class IngestionResponse(PreparedIngestionResponse):
    chunks: list[EmbeddedChunk]


class PassageEmbeddingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    configuration: IngestionConfiguration
    passages: list[Annotated[str, Field(pattern=r"^passage: ")]] = Field(min_length=1, max_length=MAX_PASSAGE_BATCH)


class PassageEmbeddingResponse(BaseModel):
    embeddings: list[list[float]]


class QueryEmbeddingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    question: str = Field(min_length=1, max_length=MAX_QUERY_LENGTH)


class QueryEmbeddingResponse(BaseModel):
    model: str = EMBEDDING_MODEL
    revision: str = EMBEDDING_REVISION
    dimensions: int = EMBEDDING_DIMENSIONS
    embedding: list[float]


class ContextTokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    blocks: list[str] = Field(min_length=1, max_length=MAX_CONTEXT_BLOCKS)


class ContextTokenResponse(BaseModel):
    model: str = EMBEDDING_MODEL
    revision: str = EMBEDDING_REVISION
    tokenizer: str = CONTEXT_TOKENIZER
    counts: list[int]
