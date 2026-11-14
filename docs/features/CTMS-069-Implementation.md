# CTMS-069 · Online first aid and survival

Story CTMS-257 · Backend CTMS-335 · Flutter CTMS-336 · Epic CTMS-448.
Baseline CTMS-068 was merged in PR #887. Jira AC1–AC5 and repository PB AC1–AC6 use
different numbering. The mapping below follows Jira and includes the additional repository rules.

## Request and result

Both routes require a valid JWT and an active Camper role. Responses use `Cache-Control: no-store`.

| Endpoint | Input | Result |
| --- | --- | --- |
| `POST /api/ai/answers` | JSON `{ question, locale, requestId }`, max 2,000 UTF-16 code units, UUID v4, locale from `RAG_LOCALES` | HTTP 200 with `ANSWERED`, `answerId`, `answer` and `sources`, or HTTP 200 with `INSUFFICIENT_CONTEXT` or `REFUSED`, `answer: null`, `sources: []` and the corresponding code |
| `GET /api/ai/answers/:answerId/sources` | Answer UUID | HTTP 200 with `answerId` and recorded cited `sources`. Unknown, expired and other owners' answers return 404. |

The Flutter client sends Vietnamese (`vi`). Unknown fields are rejected. Each source
records `documentId`, `documentVersionId`, `sourceVersion`, `chunkSetId`, `chunkId`,
`chunkIndex`, `title`, `classification`, `locale` and `locations[]` with `page` and
`itemRef`. The existing chat keeps this metadata in state for subsequent stories.

| HTTP | Code or condition | UI behavior |
| --- | --- | --- |
| 200 | `AI_KNOWLEDGE_INSUFFICIENT` | Ask for a more specific question |
| 200 | `AI_SAFETY_REFUSAL` | Show safety message and prompt to contact emergency help when needed |
| 400 | `AI_INVALID_QUESTION` or DTO validation | Correct the question |
| 401 / 403 | Session or role | Shared token refresh, followed by sign-in or permission copy when needed |
| 409 | `AI_REQUEST_ID_CONFLICT` | Submit a new question with a new request ID |
| 429 | `AI_RATE_LIMITED` | Wait briefly and retry |
| 503 | `RETRIEVAL_UNAVAILABLE`, `AI_UNAVAILABLE`, `AI_TIMEOUT` | Explanation and a retry action |

A retry from the current chat reuses the same request ID and bubble. The API returns the
same successful answer while its saved evidence remains current. Rate control is shared
across API replicas via PostgreSQL and allows one generation in flight per Camper, with
at least three seconds between accepted starts. The lease expires after 12 seconds.
An unsuccessful request can call the provider again on retry. The provider can still bill
an interrupted request, including when no answer was committed.

## Grounding, safety and persistence

- CTMS-068 owns ranking, chunk budgets, version and source eligibility. NestJS passes
  its bounded JSON context to FastAPI. The question and excerpts use a separate message
  from the system policy. FastAPI accepts an internal token and returns a constrained
  selection of chunk IDs from the supplied evidence, or a refusal.
- The server renders complete selected excerpts, using a short, fixed safety notice.
  Excerpts from the same source stay in PDF order. Free-form model text, model-generated titles, pages and URLs are excluded from the
  response contract. NestJS screens selected text for known unsafe patterns and checks
  that the cited set contains each entire referenced PDF item. The assistant has no
  tools or write path to Route, Trip, risk, payments, access control or SOS. Safety and
  relevance still depend on the approved corpus and require CTMS-098 evaluation.
- Before committing, the API takes shared document locks in a stable order and calls
  the same verification as CTMS-068. Publication, stop-use, deletion and READY activation
  use the same row locks. The commit is the final eligibility decision point. A newer
  publication that is still building fences off its predecessor.
- Migration `1795900000000` adds `ai_answers` and `ai_answer_request_limits`.
  `ai_answers` stores the validated answer, owner, request ID/hash, locale, model and
  prompt revisions, retrieval configuration, retrieved chunk identities/checksums and
  a separate ordered list of cited IDs. Snapshots survive upstream chunk cleanup.
  The original question and raw retrieved passages are omitted from storage, except
  excerpts included in the final answer. Owner deletion cascades to both tables.
- Answer access expires after 30 days. Successful writes purge expired rows in batches
  of up to 100. Low-traffic deployments need scheduled database maintenance for physical
  deletion on time. The source endpoint presents historical metadata for an old answer.
  It does not serve PDF bytes or represent a stopped source as current.
- NestJS records correlation ID, durations for retrieval, provider, validation/persistence
  and total, plus configuration identities and outcome. Questions, provider response
  bodies and PDF text are omitted from regular application logs.

## Configuration and production verification

Set the same `AI_SURVIVAL_SERVICE_TOKEN` in the API and FastAPI containers. Set
`AI_SURVIVAL_PROVIDER=openai` or `gemini`, model via `AI_SURVIVAL_MODEL`, and the
corresponding key on FastAPI. Pick a model that supports the provider's Chat Completions
JSON mode and output-token limit. Provider timeouts default to 3 seconds, API-to-FastAPI
to 3.5 seconds and API orchestration to 8 seconds. FastAPI allows up to four provider
requests in flight per process and makes zero automatic retries. The application bounds
the serialized prompt to 18,000 UTF-8 bytes and counts the complete input using the
provider's tokenizer before generation. The input limit is 4,096 tokens, including a
64-token reserve for role/format framing differences. The completion limit is 384 tokens.
An over-budget input returns insufficient context. Use a model supported by both its
provider's counting and Chat Completions endpoints.

Set `KNOWLEDGE_SERVICE_URL`, `KNOWLEDGE_SERVICE_TOKEN`, a calibrated `RAG_MIN_SCORE`,
`RAG_LOCALES` including `vi`, and the approved PDF hostname/hash policy. Confirm
published versions, READY chunk sets and professional review for medical sources.
Apply the migration before accepting traffic. Keep FastAPI and ingestion private.
Check that the chosen provider, configuration and retention terms permit sending
Camper questions and approved excerpts. Configure metrics collection, database expiry
maintenance and mobile `API_BASE_URL` for the target environment. Service health is a
liveness check. Verify readiness with a non-sensitive question on staging, after
explicit opt-in for a real provider call.

Run the versioned CTMS-098 evaluation with approved corpus and production-equivalent
model/configuration. Gates are Hit@5 ≥85%, grounded/relevant answers ≥90%, citation
correctness ≥95%, critical unsafe-answer rate 0%, online P95 ≤5 s.

## Acceptance and test map

| Criterion / rule | Evidence |
| --- | --- |
| AC1 | Existing Flutter chat asks via authenticated shared client. `survival_chat_test.dart` and `ai-answers.e2e-spec.ts` cover keyboard, prompts, validation, expired/missing token and wrong role. |
| AC2 / BR-248 | `ai-answers.service.spec.ts`, `test_survival_answers.py` and the CTMS-069 block in `knowledge-chunks.integration-spec.ts` cover bounded evidence, allowlist, output schema and source races. |
| AC3 / BR-249 | Stage instrumentation and bounded provider calls. Release latency and corpus quality remain CTMS-098 measurements. |
| AC4 / BR-249 | The unit, internal HTTP and widget suites cover insufficient evidence, refusal, invalid output and unavailable service. |
| AC5 / BR-248 | PostgreSQL suite covers exact version, item and checksum, concurrent retry and archived source snapshots. E2E covers cross-owner and expiry checks. |
| BR-216 | Provider contract rejects tool calls and invalid output. NestJS unit cases reject known unsafe interventions and false authoritative-state claims. The only new writes are answers and rate/lease records. |

## Local verification

| Check | Result in the Windows workspace |
| --- | --- |
| API unit regression, `jest --runInBand --silent` | 2,613 passed across 218 suites. After two additional CTMS-069 cases were added, the focused `jest --runInBand --testPathPattern=ai-answers.service.spec.ts` run passed 21/21. |
| Python parse and policy, `python -m compileall -q app` and `pytest app/test_survival_answers_policy.py app/test_knowledge_recall.py -q` | Compilation passed and 8 tests passed. The separate knowledge-chunking regression passed 14/14. |
| PostgreSQL integration and HTTP E2E | Connection to disposable PostgreSQL on port 55451 failed with EACCES before any test ran. |
| Python HTTP contract | Pytest collected 23 cases. FastAPI TestClient could not initialize its event-loop socket pair in this Windows session. |
| Flutter | Targeted Dart analysis passed. The widget runtime could not reach its loopback test transport. The app bundle and the offline package regression encountered missing `timezone` in the local package cache. |
| Lint and build | `pnpm lint:all` passed with 10 web warnings. API compilation passed with a temporary output directory. The aggregate build stopped at the web dependency `recharts` missing from the local install. |
| Aggregate tests and CI | `pnpm test:all` stopped at the existing Python review suite's missing `openai` dependency. The PR workflow parsed locally. Hosted CI requires a submitted ref. |

Run from the repository root with disposable PostgreSQL:

```powershell
docker compose -f docker-compose.test.yml up -d --wait
$env:TEST_DATABASE_URL = 'postgresql://ctms:ctms@127.0.0.1:55451/ctms_test'
pnpm --filter @ctms/api exec jest --runInBand ai-answers rag knowledge-chunks
pnpm --filter @ctms/api test:integration knowledge-chunks.integration-spec.ts survival-documents.integration-spec.ts auth.login.integration-spec.ts auth.refresh.integration-spec.ts
pnpm --filter @ctms/api test:e2e ai-answers.e2e-spec.ts survival-documents.e2e-spec.ts
Push-Location services/ai
python -m pytest app/test_survival_answers.py app/test_survival_answers_policy.py -q
Pop-Location
Push-Location apps/mobile
flutter pub get
flutter test --no-pub test/features/camper/survival_chat_test.dart
flutter analyze
Pop-Location
pnpm lint:all
pnpm build:all
pnpm test:all
```

Suggested PR title `feat(CTMS-257): connect Camper survival chat to grounded AI answers`.
PR summary: CTMS-335 adds Camper-only answer generation over CTMS-068 with safety
validation, version snapshots and retry handling. CTMS-336 connects the existing
Flutter chat with loading, retry and Vietnamese error states.
