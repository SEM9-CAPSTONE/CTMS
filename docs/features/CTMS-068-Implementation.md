# CTMS-068 · RAG retrieval

Story [CTMS-256](https://thuha140105.atlassian.net/browse/CTMS-256), implementation subtask [CTMS-333](https://thuha140105.atlassian.net/browse/CTMS-333).

## Consumer contract

Import `RagModule` in the CTMS-069 consumer module. Inject `RagRetrievalService` and call `retrieve(actor, { question, locale })`. Supply the actor from CTMS's authenticated user context. The internal service requires an active Camper and accepts no client-selected source IDs, model, scope or budget. Locale matching is exact across the server allowlist, so a query with `vi-VN` searches a `vi-VN` corpus. Use the corpus locale when the consumer resolves regional preferences.

| Result | Meaning |
| --- | --- |
| `GROUNDED` | `context` is JSON text containing selected chunk IDs, heading paths and complete chunk contents in ranked order. `selectedChunks` and `sources` describe exactly that evidence. |
| `INSUFFICIENT_CONTEXT / NO_MATCH` | No candidate passed eligibility, provenance and relevance. |
| `INSUFFICIENT_CONTEXT / CONTEXT_BUDGET` | The first relevant block could not fit intact. |
| `INSUFFICIENT_CONTEXT / INCOMPLETE_EVIDENCE` | Selection omitted another chunk belonging to a selected PDF item. |
| `INSUFFICIENT_CONTEXT / SOURCE_CHANGED` | Revalidation found a changed publication, incomplete set or changed selected chunk. |
| HTTP exception 400 / 403 | Invalid query or forbidden actor. |
| HTTP exception 503 | Invalid configuration, provider unavailable, database unavailable or corpus limit exceeded. |

Insufficient results have empty context, chunks and sources. All normal results include a configuration version, context token count and metrics for candidate count, selected count and duration. Operational errors have stable codes and exclude question text, source excerpts and provider/DB details. There is no NestJS retrieval controller.

The evidence is untrusted data. The CTMS-069 consumer must pass it to the generation model as quoted data separate from instructions. Use the chunk IDs to associate evidence with the answer and persist the used provenance snapshot for CTMS-071. Do not rely on a later lookup of historical chunks that may have been cleaned up. Apply the generation model's tokenizer to the full prompt and preserve or reject whole evidence blocks. The CTMS-068 budget counts the serialized retrieval JSON with the pinned E5 tokenizer. It does not cover other prompt elements or a different model's tokenization.

## Source and ranking invariants

A bounded eligibility preflight skips the model for an empty corpus. A PostgreSQL read-only repeatable-read search snapshot then intersects the CTMS-050 current publication with the CTMS-051 active pointer, READY status, passed extraction report and compatible configuration. The repository checks version number, version UUID, SHA-256, locale, configuration identity and contiguous chunk count. It applies the existing `isEligiblePublishedSource` policy, including the CTMS-219/220/221 allowlist and medical/translation gates. It validates page/item references against the recorded page count and checks the stored title against source metadata.

PostgreSQL scores the bounded eligible corpus using exact cosine similarity on the existing arrays. It rejects malformed vectors and returns at most 128 ranked rows, tied by set UUID, chunk index and chunk UUID. NestJS uses lexical corroboration on the heading and content, deduplicates normalized content, and enforces the configured limits. Lexical corroboration is deliberately conservative and can omit paraphrases. Whole chunks retain the warnings and conditions supplied by CTMS-051. A fresh read-only snapshot after token counting revalidates selected pointers, source rights, version, checksum, configuration, selected chunks and source-item completeness. A commit visible to that snapshot can revoke evidence. A change after that decision point requires a new retrieval before reuse. This path performs no business writes.

Search work is proportional to eligible vector count × 384, plus ranking and publication validation. The default scan limit is 5,000 vectors per locale. Over-limit requests fail closed. No migration or extension is needed. The 128-row rank window bounds Node memory and can reduce recall where many high-scoring rows fail the lexical gate.

## Data dictionary

| Data | Source |
| --- | --- |
| Document/version UUID, numbered source version, checksum, title, publisher, category, locale | Current CTMS-050 publication |
| Chunk-set UUID, pipeline, embedding model/revision/dimensions, config hash | Active CTMS-051 set |
| Chunk UUID/index, headings, content, one-based page and original item reference | Selected CTMS-051 chunk |
| Score, tokenizer count, result status/reason, retrieval configuration hash | CTMS-068 request computation |

## Settings

| Variable | Default | Valid range or policy |
| --- | --- | --- |
| `RAG_MIN_SCORE` | Required | 0.01–1, calibrated on approved PDFs |
| `RAG_LOCALES` | `vi,vi-VN,en` | Up to 20 canonical locale identifiers |
| `RAG_TOP_K` | 5 | 1–10 chunks |
| `RAG_MAX_SOURCES` | 3 | 1–10 documents |
| `RAG_MAX_CANDIDATES` | 5000 | 1–10000 vectors |
| `RAG_CONTEXT_TOKEN_BUDGET` | 1200 | 1–4096 retrieval tokens |
| `RAG_MAX_QUERY_LENGTH` | 2000 | 1–2000 UTF-16 code units, plus E5's 480-token embedding limit |
| `RAG_PROVIDER_TIMEOUT_MS` | 2500 | 100–30000 ms per HTTP call |
| `RAG_DATABASE_TIMEOUT_MS` | 2000 | 100–10000 ms per SQL statement |

The existing `KNOWLEDGE_SERVICE_URL` and `KNOWLEDGE_SERVICE_TOKEN` configure the private Python boundary. Its `POST /query-embedding` receives a bounded question and returns model, revision, dimensions and a normalized vector. `POST /context-token-counts` receives up to 10 bounded serialized blocks and returns exact token counts for each cumulative JSON array, including framing. Both require `X-CTMS-Knowledge-Token`. The encoder is loaded lazily, shares the ingestion process/model, and returns 503 when that model is busy. Cold startup and model contention should be measured with the configured timeout.

## Verification

| Requirement | Tests |
| --- | --- |
| Eligibility, replacement, stop-use, allowlist and race | CTMS-051 PostgreSQL integration suite, CTMS-068 cases |
| Provenance, ranking and context size | RAG unit tests and PostgreSQL integration cases |
| Active Camper and public route absence | RAG unit tests and NestJS HTTP integration cases |
| Pinned embedding, token validation and sanitized errors | TypeScript provider unit tests and Python HTTP tests |
| Ingestion regression | Existing CTMS-051 Jest and Python suites |

```powershell
pnpm --filter @ctms/api exec jest --runInBand rag knowledge-chunks
docker compose -f docker-compose.test.yml up -d --wait
$env:TEST_DATABASE_URL='postgresql://ctms:ctms@127.0.0.1:55451/ctms_test'
pnpm --filter @ctms/api test:integration knowledge-chunks.integration-spec.ts survival-documents.integration-spec.ts
pnpm --filter @ctms/api test:e2e survival-documents.e2e-spec.ts

pnpm lint:all
pnpm build:all
pnpm test:all

# From services/ai with the ingestion environment active
python -m pytest app/test_rag_knowledge_api.py app/test_knowledge_api.py app/test_knowledge_chunking.py app/test_knowledge_recall.py -q
```

Set `RUN_RAG_BENCHMARK=true` before running the integration suite to run 10 requests over 2,000 synthetic vectors. This measures the local service and database with the embedding provider stubbed. Treat heap delta as an observation rather than peak memory.

Use 30–50 distinct labelled questions from approved PDFs for release evaluation. Label exact version, page, item and source excerpt. The existing CTMS-051 evaluator measures raw embedding ranking. For CTMS-098 release evidence, also evaluate final selected chunks through this runtime retrieval service so the score threshold, lexical gate and context budget affect the measured Hit@5. The corpus threshold, actual Hit@5 and operational latency remain unmeasured until that evaluation runs.
