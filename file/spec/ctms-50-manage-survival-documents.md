# CTMS-050 — Manage Survival Documents

## 1. Overview

Story: CTMS-050

Epic: EPIC 11. AI Survival Assistant and RAG

Use Case: Manage Survival Documents

Priority: Must Have

Goal: Maintain authoritative, versioned survival-knowledge source documents that can safely feed knowledge chunking, offline guidance and RAG.

Acceptance Criteria:

| Source  | Criterion                                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| PB AC-1 | Authorized actor can create/update supported survival knowledge sources.                                                          |
| PB AC-2 | Source document has traceable identity/version/locale/status metadata.                                                            |
| PB AC-3 | Updating source creates or advances authoritative source version rather than silently changing the provenance of existing chunks. |
| PB AC-4 | Downstream chunks/packages can identify which source version they were generated from.                                            |
| PB AC-5 | Unsupported/unapproved content is not silently treated as authoritative survival knowledge.                                       |

## 2. Scope

### In Scope

- Survival source document.
- Source metadata.
- Version.
- Locale.
- Status.
- Update/version traceability.
- Downstream regeneration trigger/context.

### Out of Scope

- Chunk generation; CTMS-051.
- RAG retrieval; CTMS-068.
- AI answering; CTMS-069.
- Offline package generation; CTMS-052.

## 3. Actors & Authorization

- Authorized Admin/content-management actor according to the approved administration model.
- System.

## 4. Preconditions & Dependencies

Actor must have permission to manage authoritative survival knowledge.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-227 | A Survival Document must support upload, classification, review, publication, versioning, and lifecycle status so the knowledge base can identify the authoritative source version.                                                                                       |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                     |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                              |

## 6. State & Lifecycle

Conceptually:

source absent
→ create source/version
→ active/available source according to approved status.

Source update
→ new/updated authoritative source version
→ downstream knowledge artifacts may require regeneration.

Exact status enum follows Data Dictionary.

## 7. Business Flow

1. Authorized actor creates/updates survival source.
2. Backend validates permission.
3. Validate content/metadata.
4. Determine source identity/version.
5. Persist source version.
6. Preserve provenance of prior versions.
7. Mark/trigger downstream chunk regeneration as defined by Technical Design.
8. Return authoritative source state.

## 8. Data & Invariants

- Source has stable identity.
- Source version is traceable.
- Locale is preserved where applicable.
- Existing chunk provenance cannot silently change.
- Unsupported content is not automatically trusted merely because uploaded.
- Downstream artifacts can identify source version.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                | Expected Behavior                                           |
| ----------------------------------- | ----------------------------------------------------------- |
| Unauthorized actor                  | Reject.                                                     |
| Invalid source metadata             | Reject.                                                     |
| Source updated                      | Preserve version provenance.                                |
| Chunk still points to older version | Remains identifiable as older; regeneration policy applies. |
| Processing fails                    | Do not falsely advertise new downstream knowledge as ready. |

## 11. Acceptance & Test Matrix

| Source | Scenario                       | Expected Result             | Test Type    |
| ------ | ------------------------------ | --------------------------- | ------------ |
| BR-227 | Authorized valid source create | Source stored               | E2E          |
| BR-227 | Source updated                 | Version/provenance retained | Integration  |
| BR-227 | Downstream chunk inspected     | Source version identifiable | Traceability |
| BR-212 | Schema/version rule changes    | Documentation updated       | Process      |
| BR-213 | Invalid source operation       | Covered by violation test   | Test         |

## 12. Open Decisions

Exact supported document formats, moderation/approval status enum and ingestion size limits are not defined by BR-227 and must not be invented here.
