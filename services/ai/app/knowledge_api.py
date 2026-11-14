"""Private ingestion, embedding and token-count endpoints."""

import hmac
import os
from functools import lru_cache

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import ValidationError

from app.knowledge_ingestion import InvalidEmbedding, InvalidPdf, InvalidQuery, KnowledgeIngestionService, ModelBusy
from app.knowledge_models import (
    MAX_CONTEXT_BLOCKS, MAX_CONTEXT_BLOCK_BYTES, ContextTokenRequest, ContextTokenResponse,
    IngestionRequest, IngestionResponse, QueryEmbeddingRequest, QueryEmbeddingResponse,
)

app = FastAPI(title="CTMS Knowledge Ingestion", version="1.0.0")


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


@app.post("/knowledge-chunks", response_model=IngestionResponse, dependencies=[Depends(require_token)])
def ingest(request: IngestionRequest, service: KnowledgeIngestionService = Depends(get_service)) -> IngestionResponse:
    try:
        return service.generate(request)
    except InvalidPdf:
        raise HTTPException(422, detail={"code": "invalid_pdf"}) from None
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
