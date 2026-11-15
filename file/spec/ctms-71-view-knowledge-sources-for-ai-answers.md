# CTMS-071 — View Knowledge Sources for AI Answers

## 1. Overview

Story: CTMS-071

Epic: EPIC 11. AI Survival Assistant and RAG

Use Case: View Knowledge Sources for AI Answers

Priority: Must Have

Goal: Allow Camper to see the actual knowledge source/category used to ground an AI answer without displaying fabricated or unused sources.

Backlog story: As a Camper, I want to see the knowledge sources behind an AI answer so I can understand where the guidance came from.

Acceptance Criteria:

| Source  | Criterion                                                                                                |
| ------- | -------------------------------------------------------------------------------------------------------- |
| PB AC-1 | AI answer exposes source information derived from actual retrieval metadata.                             |
| PB AC-2 | Source/document category displayed to the user must correspond to a source actually used for the answer. |
| PB AC-3 | System must not fabricate a source or show an unused source as evidence.                                 |
| PB AC-4 | Source information remains associated with the corresponding AI answer.                                  |

## 2. Scope

### In Scope

- AI-answer source metadata.
- Document/source category.
- Retrieval provenance.
- Collapsible source details per answer in the existing Camper AI Chat.

### Out of Scope

- RAG retrieval itself — CTMS-068.
- AI answer generation — CTMS-069.
- Knowledge-document management — CTMS-050.
- PDF download and new offline knowledge retrieval.

## 3. Actors & Authorization

- Camper.
- AI/RAG subsystem.

An authenticated, active Camper may read source snapshots for their own online answers within the CTMS-069 retention period. The backend enforces role, account status and ownership (BR-172).

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-068.
- CTMS-069.

For source display, an accessible AI answer and corresponding evidence metadata exist. A pretrained-only local reply has no source metadata.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-251 | An AI answer must display the actual document/source category present in retrieval metadata and must not invent or cite a source that was not used.                                   |
| BR-248 | RAG may retrieve only relevant knowledge chunks within the configured context limit, must preserve source references, and must not send unrelated knowledge to the language model.    |
| BR-172 | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization. |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done. |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.          |

## 6. State & Lifecycle

Retrieval
→ source metadata preserved
→ cited chunks verified
→ answer and evidence snapshot persisted
→ Camper views sources recorded for that answer.

No business-state mutation is performed by viewing sources.

## 7. Business Flow

1. When creating an authorized online answer, the server returns citations for the verified chunk IDs recorded for that answer.
2. The existing chat uses the returned citations. `Nguồn tham khảo (N)` starts collapsed. Camper can expand it or collapse it again.
3. Group cited chunks by document ID and document version ID. Show the recorded title, version when valid, and distinct verified page numbers when available. Count these groups in `N`.
4. Preserve the answer if sources are unavailable. Show `Không có thông tin nguồn` for an online answer without a usable source.
5. Keep completed chat turns and their source details together when inference mode changes. Apply CTMS-069's session isolation and local history rules (BR-500, BR-502, BR-503).

## 8. Data & Invariants

Sources derive from the intersection of `cited_chunk_ids` and valid provenance in the same answer's `retrieved_evidence` snapshot. The key is the cited chunk ID.

Invariant:

`displayed_source ∈ verified citations for this answer`

Each citation preserves the captured document identity, version, title, classification, locale and page/item references. Superseding, archiving or withdrawing a document leaves these historical references tied to the original answer. The source panel presents them as references to that answer.

A pretrained-only reply has no source metadata and keeps its existing general AI label (BR-497). The supported offline checkpoint lookup identifies the verified Trip snapshot and displays no Survival Document citation. A saved-package document citation requires verified evidence actually used and exact package and document provenance.

## 9. API / Integration Contract

For online answers, `POST /api/ai/answers` returns `answerId` and any verified `sources` with the reply. The chat uses this response when opening the source panel. Local answers have no server ID or source request.

`GET /api/ai/answers/:answerId/sources` returns `{ answerId, sources }` to the active Camper who owns the answer during the 30-day retention period. It reads the saved citation snapshot. Each source contains `documentId`, `documentVersionId`, `sourceVersion`, `chunkSetId`, `chunkId`, `chunkIndex`, `title`, `classification`, `locale` and `locations` with `page` and `itemRef`. Omit citations with missing or invalid stored provenance. If none remain, return `sources: []`.

## 10. Error & Edge Cases

| Case                                          | Expected Behavior                 |
| --------------------------------------------- | --------------------------------- |
| Cited chunks have valid provenance            | Display recorded title and available version/page details |
| Online answer has no usable source metadata   | Keep the answer and show that source details are unavailable |
| A chunk was retrieved but remained unused     | Exclude it from recorded citations |
| No session or wrong role/account status       | Return 401 or 403 as applicable |
| Unknown, expired or another Camper's answer   | Return 404 |
| Multiple chunks cite the same document/version | Group citations and deduplicate verified pages |
| Documents have the same title or versions differ | Keep distinct document/version groups |
| A document is superseded or withdrawn         | Preserve the historical citation snapshot |
| Connectivity or Camper account changes        | Keep completed turns across modes and clear them on account switch |

## 11. Acceptance & Test Matrix

| Source | Scenario                            | Expected Result                    | Test Type    |
| ------ | ----------------------------------- | ---------------------------------- | ------------ |
| BR-251 | Answer grounded by one or more sources | Show recorded source titles in a collapsed section that can expand and collapse | API unit, Flutter widget |
| BR-251 | Source B was retrieved but unused    | Exclude it from the answer citations | API unit |
| BR-251 | Provenance missing or invalid         | Omit invalid references and preserve the completed chat reply | API unit, HTTP E2E, Flutter widget |
| BR-248 / BR-251 | Source is superseded or archived after the answer | Preserve historical details under the same answer ID | PostgreSQL integration |
| BR-172 | Owner, unauthenticated user, wrong role, other Camper, unknown/expired answer | Allow only the active Camper who owns the retained answer | HTTP E2E |
| BR-251 | Equal titles, repeated pages and distinct versions | Keep exact document/version groups and show each page once per group | Flutter widget |
| BR-251 / BR-497 | Pretrained-only reply or Trip checkpoint lookup | Preserve the existing local reply label with no CTMS citations | Flutter widget |
| BR-500 / BR-502 / BR-503 | Change mode or account with an in-flight reply | Sources stay with their answer across modes. A stale reply cannot repopulate a different account's transcript. | Flutter widget |

