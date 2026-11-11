"""CTMS-051 internal ingestion contract. No LLM or generated source context."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

PIPELINE_VERSION = "ctms-hybrid-v1"
EMBEDDING_MODEL = "intfloat/multilingual-e5-small"
EMBEDDING_REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3"
MAX_PDF_BYTES = 52_428_800
MAX_CHUNKS = 10_000
MAX_PAGES = 1_000


class IngestionConfiguration(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    pipeline_version: Literal["ctms-hybrid-v1"] = PIPELINE_VERSION
    embedding_model: Literal["intfloat/multilingual-e5-small"] = EMBEDDING_MODEL
    embedding_revision: Literal["614241f622f53c4eeff9890bdc4f31cfecc418b3"] = EMBEDDING_REVISION
    embedding_dimensions: Literal[384] = 384
    max_tokens: Literal[480] = 480


class IngestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_version_id: UUID
    source_version: int = Field(gt=0)
    checksum: str = Field(pattern=r"^[a-f0-9]{64}$")
    locale: str = Field(min_length=2, max_length=35)
    title: str = Field(min_length=1, max_length=300)
    configuration: IngestionConfiguration
    pdf_base64: str = Field(min_length=1, max_length=4 * ((MAX_PDF_BYTES + 2) // 3))


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


class QualityReport(BaseModel):
    status: Literal["PASSED", "NEEDS_REVIEW"]
    issues: list[str]
    page_count: int


class IngestionResponse(BaseModel):
    document_version_id: UUID
    source_version: int
    checksum: str
    locale: str
    configuration: IngestionConfiguration
    quality: QualityReport
    chunks: list[EmbeddedChunk]
