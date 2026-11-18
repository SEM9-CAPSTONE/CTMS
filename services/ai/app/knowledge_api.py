"""Private ingestion, embedding and token-count endpoints."""

import hmac
import os
from collections.abc import Callable
from functools import lru_cache
from typing import TypeVar

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from pydantic import ValidationError

from app.document_editor import ComposeRequest, EditorSection, compose_pdf
from app.knowledge_ingestion import InvalidEmbedding, InvalidPdf, InvalidQuery, KnowledgeIngestionService, ModelBusy
from app.knowledge_models import (
    MAX_CONTEXT_BLOCKS, MAX_CONTEXT_BLOCK_BYTES, MAX_PDF_BYTES, ContextTokenRequest, ContextTokenResponse,
    IngestionRequest, IngestionResponse, PassageEmbeddingRequest, PassageEmbeddingResponse,
    PreparedIngestionResponse, QueryEmbeddingRequest, QueryEmbeddingResponse,
)

app = FastAPI(title="CTMS Knowledge Ingestion", version="1.0.0")
IngestionResult = TypeVar("IngestionResult", bound=PreparedIngestionResponse)


def require_token(x_ctms_knowledge_token: str | None = Header(default=None)) -> None:
    expected = os.environ.get("KNOWLEDGE_SERVICE_TOKEN")
    if not expected:
        raise HTTPException(503, detail={"code": "ingestion_not_configured"})
    if not x_ctms_knowledge_token or not hmac.compare_digest(expected.encode("utf-8"), x_ctms_knowledge_token.encode("utf-8")):
        raise HTTPException(401, detail={"code": "unauthorized"})


@lru_cache
def get_service() -> KnowledgeIngestionService:
    return KnowledgeIngestionService()


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "ctms-knowledge-ingestion", "status": "ok"}


@app.get("/readiness", status_code=204, dependencies=[Depends(require_token)])
def readiness() -> Response:
    return Response(status_code=204)


@app.post("/knowledge-chunks", response_model=IngestionResponse, dependencies=[Depends(require_token)])
def ingest(request: IngestionRequest, service: KnowledgeIngestionService = Depends(get_service)) -> IngestionResponse:
    return run_ingestion(service.generate, request)


@app.post("/knowledge-chunks/prepare", response_model=PreparedIngestionResponse, dependencies=[Depends(require_token)])
def prepare_chunks(request: IngestionRequest, service: KnowledgeIngestionService = Depends(get_service)) -> PreparedIngestionResponse:
    return run_ingestion(service.prepare, request)


@app.post("/document-editor/extract", response_model=list[EditorSection], dependencies=[Depends(require_token)])
def extract_editor_content(request: IngestionRequest, service: KnowledgeIngestionService = Depends(get_service)):
    try:
        return service.editor_content(request)
    except (InvalidPdf, ValidationError):
        raise HTTPException(422, detail={"code": "editor_extraction_unverified"}) from None
    except Exception:
        raise HTTPException(502, detail={"code": "editor_extraction_failed"}) from None


@app.post("/document-editor/compose", dependencies=[Depends(require_token)])
def compose_document(request: ComposeRequest) -> Response:
    try:
        return Response(compose_pdf(request), media_type="application/pdf")
    except InvalidPdf:
        raise HTTPException(422, detail={"code": "editor_pdf_unverified"}) from None
    except Exception:
        raise HTTPException(502, detail={"code": "editor_composition_failed"}) from None


def run_ingestion(operation: Callable[[IngestionRequest], IngestionResult], request: IngestionRequest) -> IngestionResult:
    try:
        return operation(request)
    except InvalidPdf as error:
        detail = {"code": "invalid_pdf"}
        if str(error) in {"pdf_encrypted", "pdf_no_pages", "pdf_page_limit_exceeded", "pdf_text_read_failed"}:
            detail["issue"] = str(error)
        raise HTTPException(422, detail=detail) from None
    except InvalidEmbedding:
        raise HTTPException(502, detail={"code": "invalid_embedding"}) from None
    except Exception:
        # Neither source content nor model/library errors leave this trusted boundary.
        raise HTTPException(502, detail={"code": "ingestion_failed"}) from None


async def bounded_body(request: Request, max_bytes: int) -> bytes:
    body = bytearray()
    async for part in request.stream():
        if len(body) + len(part) > max_bytes:
            raise HTTPException(413, detail={"code": "payload_too_large"})
        body.extend(part)
    return bytes(body)


async def passage_body(request: Request) -> PassageEmbeddingRequest:
    body = await bounded_body(request, 4 * ((MAX_PDF_BYTES + 2) // 3))
    try:
        return PassageEmbeddingRequest.model_validate_json(body)
    except ValidationError:
        raise HTTPException(422, detail={"code": "invalid_passages"}) from None


@app.post("/passage-embeddings", response_model=PassageEmbeddingResponse, dependencies=[Depends(require_token)])
def embed_passages(
    payload: PassageEmbeddingRequest = Depends(passage_body),
    service: KnowledgeIngestionService = Depends(get_service),
) -> PassageEmbeddingResponse:
    try:
        return PassageEmbeddingResponse(embeddings=service.embed_passages(
            payload.passages, payload.configuration.embedding_dimensions,
        ))
    except Exception:
        raise HTTPException(502, detail={"code": "invalid_embedding"}) from None


async def query_body(request: Request) -> QueryEmbeddingRequest:
    body = await bounded_body(request, 16_384)
    try:
        return QueryEmbeddingRequest.model_validate_json(body)
    except ValidationError:
        raise HTTPException(422, detail={"code": "invalid_query"}) from None


async def context_body(request: Request) -> ContextTokenRequest:
    # The inner JSON blocks are escaped again by the HTTP JSON envelope.
    body = await bounded_body(request, MAX_CONTEXT_BLOCKS * MAX_CONTEXT_BLOCK_BYTES * 2 + 256)
    try:
        payload = ContextTokenRequest.model_validate_json(body)
        if any(not block or len(block.encode("utf-8")) > MAX_CONTEXT_BLOCK_BYTES for block in payload.blocks):
            raise HTTPException(422, detail={"code": "invalid_context"})
        return payload
    except (ValidationError, UnicodeError):
        raise HTTPException(422, detail={"code": "invalid_context"}) from None


@app.post("/query-embedding", response_model=QueryEmbeddingResponse, dependencies=[Depends(require_token)])
def embed_query(
    payload: QueryEmbeddingRequest = Depends(query_body),
    service: KnowledgeIngestionService = Depends(get_service),
) -> QueryEmbeddingResponse:
    try:
        return QueryEmbeddingResponse(embedding=service.embed_query(payload.question))
    except InvalidQuery:
        raise HTTPException(422, detail={"code": "invalid_query"}) from None
    except ModelBusy:
        raise HTTPException(503, detail={"code": "knowledge_model_busy"}) from None
    except Exception:
        raise HTTPException(502, detail={"code": "query_embedding_failed"}) from None


@app.post("/context-token-counts", response_model=ContextTokenResponse, dependencies=[Depends(require_token)])
def context_token_counts(
    payload: ContextTokenRequest = Depends(context_body),
    service: KnowledgeIngestionService = Depends(get_service),
) -> ContextTokenResponse:
    try:
        return ContextTokenResponse(counts=service.count_context_prefixes(payload.blocks))
    except ModelBusy:
        raise HTTPException(503, detail={"code": "knowledge_model_busy"}) from None
    except Exception:
        raise HTTPException(502, detail={"code": "context_tokenization_failed"}) from None
