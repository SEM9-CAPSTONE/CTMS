from uuid import uuid4

import pytest

from app.knowledge_models import IngestionConfiguration, IngestionResponse
from app.knowledge_recall import EvaluationQuestion, recall_at_five


def fixture():
    version = str(uuid4())
    chunks = [dict(chunk_index=index, content=f"Fictional answer {index}.", embedding_text=f"passage: Fictional answer {index}.",
                   token_count=10, headings=[], locations=[dict(page=1, item_ref="#/texts/0", bbox=dict(l=0,t=1,r=1,b=0,coord_origin="BOTTOMLEFT"))],
                   embedding=[1.0, 0.0] if index < 5 else [0.0, 1.0]) for index in range(6)]
    snapshot = IngestionResponse(document_version_id=version, source_version=1, checksum="0"*64, locale="vi-VN",
                                 configuration=IngestionConfiguration(), quality=dict(status="PASSED",issues=[],page_count=1), chunks=chunks)
    questions = [EvaluationQuestion(id=str(index), question="Câu hỏi giả lập?", locale="vi-VN",
                    expected_sources=[dict(document_version_id=version, page=1, item_ref="#/texts/0", source_excerpt="Fictional answer 5")]) for index in range(30)]
    return snapshot, questions


def test_recall_requires_answer_excerpt_not_just_the_same_page_or_large_item():
    snapshot, questions = fixture()
    result = recall_at_five(questions, [snapshot], [[1.0,0.0]]*30)
    assert result["recall_at_5"] == 0
    result = recall_at_five(questions, [snapshot], [[0.0,1.0]]*30)
    assert result["recall_at_5"] == 1
    assert result["hits"] == 30


def test_bad_gold_sources_and_duplicate_or_insufficient_questions_are_rejected():
    snapshot, questions = fixture()
    with pytest.raises(ValueError, match="30–50"):
        recall_at_five(questions[:2], [snapshot], [[1.0,0.0]]*2)
    questions[0].expected_sources[0].document_version_id = str(uuid4())
    with pytest.raises(ValueError, match="Gold source missing"):
        recall_at_five(questions, [snapshot], [[1.0,0.0]]*30)


def test_only_complete_unique_version_snapshots_are_accepted():
    snapshot, questions = fixture()
    with pytest.raises(ValueError, match="one complete chunk set"):
        recall_at_five(questions, [snapshot, snapshot], [[1.0,0.0]]*30)
    snapshot.quality.status = "NEEDS_REVIEW"
    with pytest.raises(ValueError, match="quality-checked"):
        recall_at_five(questions, [snapshot], [[1.0,0.0]]*30)
