"""Offline Recall@5 evaluation against human-labelled PDF source locations (CTMS-051)."""

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

from app.knowledge_models import EMBEDDING_MODEL, EMBEDDING_REVISION, IngestionResponse
from app.knowledge_chunking import words


class ExpectedSource(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_version_id: str
    page: int = Field(gt=0)
    item_ref: str = Field(min_length=1)
    source_excerpt: str = Field(min_length=1)
    locale: str | None = Field(default=None, pattern=r"^[a-z]{2,3}(?:-[A-Z]{2})?$")


class EvaluationQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1)
    question: str = Field(min_length=1)
    locale: str = Field(min_length=2)
    expected_sources: list[ExpectedSource] = Field(min_length=1)


def recall_at_five(questions: list[EvaluationQuestion], snapshots: list[IngestionResponse],
                   query_vectors: list[list[float]], *, source_locales: set[str] | None = None) -> dict:
    if not 30 <= len(questions) <= 50 or len({question.id for question in questions}) != len(questions):
        raise ValueError("Provide 30–50 distinct, human-labelled PDF questions")
    if len(query_vectors) != len(questions):
        raise ValueError("Query embedding count mismatch")
    if any(snapshot.quality.status != "PASSED" or snapshot.quality.issues or not snapshot.chunks
           for snapshot in snapshots):
        raise ValueError("Only complete, quality-checked snapshots may be evaluated")
    identities = [str(snapshot.document_version_id) for snapshot in snapshots]
    if len(set(identities)) != len(identities):
        raise ValueError("Supply one complete chunk set per exact document version")
    corpus = [snapshot for snapshot in snapshots if source_locales is None or snapshot.locale in source_locales]
    locales = {str(snapshot.document_version_id): snapshot.locale for snapshot in corpus}
    candidates = [(snapshot, chunk) for snapshot in corpus for chunk in snapshot.chunks]
    if not candidates:
        raise ValueError("No eligible source corpus")
    details = []
    direction_counts = defaultdict(lambda: {"questions": 0, "hits": 0})

    def matches(snapshot, chunk, expected):
        excerpt = " ".join(words(expected.source_excerpt))
        return (bool(excerpt) and str(snapshot.document_version_id) == expected.document_version_id and
                (expected.locale is None or snapshot.locale == expected.locale) and
                excerpt in " ".join(words(chunk.content)) and
                any(location.page == expected.page and location.item_ref == expected.item_ref for location in chunk.locations))

    for question, vector in zip(questions, query_vectors, strict=True):
        # Gold source validation prevents a typo in annotation from being reported as a retrieval miss.
        for expected in question.expected_sources:
            if not any(matches(snapshot, chunk, expected) for snapshot, chunk in candidates):
                raise ValueError(f"Gold source missing from corpus for question {question.id}")
        ranked = sorted(candidates, key=lambda candidate: (
            -cosine(vector, candidate[1].embedding), str(candidate[0].document_version_id), candidate[1].chunk_index,
        ))[:5]
        gold_by_locale = defaultdict(list)
        for expected in question.expected_sources:
            gold_by_locale[locales[expected.document_version_id]].append(expected)
        hit = False
        for locale, gold in gold_by_locale.items():
            direction = f"{question.locale}->{locale}"
            found = any(matches(snapshot, chunk, expected) for snapshot, chunk in ranked for expected in gold)
            direction_counts[direction]["questions"] += 1
            direction_counts[direction]["hits"] += found
            hit = hit or found
        details.append({"id": question.id, "query_locale": question.locale, "hit": hit,
                        "top_5": [{"document_version_id": str(snapshot.document_version_id),
                                   "source_locale": snapshot.locale, "chunk_index": chunk.chunk_index}
                                  for snapshot, chunk in ranked]})
    hits = sum(item["hit"] for item in details)
    by_direction = {direction: {**counts, "recall_at_5": counts["hits"] / counts["questions"]}
                    for direction, counts in sorted(direction_counts.items())}
    return {"question_count": len(questions), "hits": hits, "recall_at_5": hits / len(questions),
            "by_language_direction": by_direction, "questions": details}


def cosine(left: list[float], right: list[float]) -> float:
    if len(left) != len(right) or not left or not all(math.isfinite(value) for value in left + right):
        raise ValueError("Invalid embedding dimensions or values")
    denominator = math.sqrt(sum(value*value for value in left) * sum(value*value for value in right))
    if not denominator:
        raise ValueError("Zero embedding vector")
    return sum(a*b for a, b in zip(left, right, strict=True)) / denominator


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--questions", type=Path, required=True)
    parser.add_argument("--snapshots", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source-locales", nargs="+", help="Only evaluate snapshots with these exact source locales")
    args = parser.parse_args()
    questions = [EvaluationQuestion.model_validate(row) for row in json.loads(args.questions.read_text(encoding="utf-8"))]
    snapshots = [IngestionResponse.model_validate(row) for row in json.loads(args.snapshots.read_text(encoding="utf-8"))]
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(EMBEDDING_MODEL, revision=EMBEDDING_REVISION, device="cpu", trust_remote_code=False)
    queries = [f"query: {question.question}" for question in questions]
    if any(len(model.tokenizer.encode(query, add_special_tokens=True)) > 480 for query in queries):
        raise ValueError("Evaluation query exceeds token budget")
    vectors = model.encode(queries, normalize_embeddings=True, show_progress_bar=False).tolist()
    result = recall_at_five(questions, snapshots, vectors,
                            source_locales=set(args.source_locales) if args.source_locales else None)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
