"""Separate, authenticated ingestion worker. Heavy dependencies load only on ingestion."""

import hmac
import os
from functools import lru_cache

from fastapi import Depends, FastAPI, Header, HTTPException

from app.knowledge_ingestion import InvalidEmbedding, InvalidPdf, KnowledgeIngestionService
from app.knowledge_models import IngestionRequest, IngestionResponse

app = FastAPI(title="CTMS Knowledge Ingestion", version="1.0.0")


def require_token(x_ctms_knowledge_token: str | None = Header(default=None)) -> None:
    expected = os.environ.get("KNOWLEDGE_SERVICE_TOKEN")
    if not expected:
        raise HTTPException(503, detail={"code": "ingestion_not_configured"})
    if not x_ctms_knowledge_token or not hmac.compare_digest(expected, x_ctms_knowledge_token):
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
