"""Opt-in real parser/model smoke test; downloads pinned local model artifacts on first run."""

import base64
import hashlib
import os
from io import BytesIO
from uuid import uuid4

import pytest

from app.knowledge_ingestion import KnowledgeIngestionService
from app.knowledge_models import IngestionConfiguration, IngestionRequest


@pytest.mark.skipif(os.environ.get("RUN_KNOWLEDGE_MODEL_SMOKE") != "true", reason="Opt-in pinned model download")
def test_real_pdf_parser_and_multilingual_embedding_model():
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    writer = PdfWriter()
    page = writer.add_blank_page(width=595, height=842)
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
                             NameObject("/BaseFont"): NameObject("/Helvetica")})
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
    lines = [(22, 760, "Fictional Field Handbook"), (16, 710, "Fictional section"),
             (12, 680, "This document is a synthetic software fixture with no survival advice."),
             (12, 650, "The fictional sample names are alpha, beta, and gamma."),
             (12, 620, "The sample records are ordered from the first to the final entry.")]
    content = DecodedStreamObject()
    content.set_data("\n".join(f"BT /F1 {size} Tf 50 {y} Td ({line}) Tj ET" for size, y, line in lines).encode())
    page[NameObject("/Contents")] = writer._add_object(content)
    buffer = BytesIO()
    writer.write(buffer)
    pdf = buffer.getvalue()
    request = IngestionRequest(document_version_id=uuid4(), source_version=1, checksum=hashlib.sha256(pdf).hexdigest(),
                               locale="en", title="Fictional Field Handbook", configuration=IngestionConfiguration(),
                               pdf_base64=base64.b64encode(pdf).decode())
    service = KnowledgeIngestionService()
    result = service.generate(request)
    assert result.quality.status == "PASSED", result.quality.issues
    assert result.chunks
    assert all(len(chunk.embedding) == 384 and chunk.token_count <= 480 for chunk in result.chunks)
    again = service.generate(request)
    assert [(chunk.content, chunk.headings, chunk.locations) for chunk in again.chunks] == [
        (chunk.content, chunk.headings, chunk.locations) for chunk in result.chunks]
    # Separate Vietnamese input demonstrates the same pinned multilingual encoder is usable.
    vector = service._model.encode(["query: Nội dung tài liệu thử nghiệm là gì?"], normalize_embeddings=True)
    assert vector.shape == (1, 384)
