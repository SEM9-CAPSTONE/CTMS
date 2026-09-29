# CTMS-070 — Access Survival Guidance Offline

## 1. Overview

Story: CTMS-070

Epic: EPIC 11. AI Survival Assistant and RAG

Use Case: Access Survival Guidance Offline

Priority: Must Have

Goal: Provide useful survival-guidance retrieval from the downloaded local package without requiring an online LLM.

Backlog story: As a Camper, I want to access survival guidance while offline so loss of connectivity does not remove critical reference material.

Acceptance Criteria:

| Source  | Criterion                                                     |
| ------- | ------------------------------------------------------------- |
| PB AC-1 | Survival guidance can be searched while offline.              |
| PB AC-2 | Search operates on downloaded local package.                  |
| PB AC-3 | Retrieval supports keyword/full-text search.                  |
| PB AC-4 | Core offline guidance does not require an online LLM call.    |
| PB AC-5 | Returned guidance belongs to the active Trip/package version. |

## 2. Scope

### In Scope

- Local survival knowledge.
- Keyword search.
- Full-text search.
- Offline results.
- Active package/version context.

### Out of Scope

- Online RAG generation.
- Online LLM.
- Survival-document authoring.

## 3. Actors & Authorization

- Camper.
- Local offline-search subsystem.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-052/055.

Applicable survival guidance has been downloaded in valid local package.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-250 | Offline survival guidance must search the downloaded local package using keyword/full-text retrieval and must not require an online LLM call.                                             |
| BR-233 | Downloaded Route, Checkpoint, and survival-guidance data must remain usable in airplane/offline mode without calling an online API and must correspond to the exact Trip/package version. |

## 6. State & Lifecycle

Valid local package
→ offline query
→ local keyword/full-text retrieval
→ guidance result.

No online generation is required.

## 7. Business Flow

1. Camper opens Survival Guidance offline.
2. Load active package.
3. User enters keyword/query.
4. Search local guidance index/content.
5. Rank/filter local matches according to local search implementation.
6. Display matching guidance.
7. Preserve source/category metadata where available.
8. Make no online LLM request as a requirement for core function.

## 8. Data & Invariants

- Search source = downloaded local package.
- Correct package/version.
- No online LLM dependency.
- No fabricated content if no local match exists.
- Offline guidance is retrieval, not generative AI.

## 9. API / Integration Contract

No online API required for core offline search.

Local index/search contract: TBD — Technical Design.

## 10. Error & Edge Cases

| Case                     | Expected Behavior                                        |
| ------------------------ | -------------------------------------------------------- |
| Airplane mode            | Search works                                             |
| No matching guidance     | Show no result/fallback local behavior; do not fabricate |
| Package missing          | Guidance unavailable                                     |
| Package failed integrity | Do not use                                               |
| Online LLM unavailable   | Core offline search unaffected                           |
| Wrong package            | Do not use as current Trip guidance                      |

## 11. Acceptance & Test Matrix

| Source | Scenario                | Expected Result         | Test Type   |
| ------ | ----------------------- | ----------------------- | ----------- |
| BR-250 | Offline keyword query   | Local result            | Offline E2E |
| BR-250 | Full-text query         | Local retrieval         | Search      |
| BR-250 | LLM/network unavailable | Search still works      | Offline     |
| BR-233 | Correct active package  | Correct guidance        | Version     |
| BR-250 | No local match          | No fabricated AI answer | Safety      |

## 12. Open Decisions

Local full-text indexing/search technology belongs to Technical Design.
