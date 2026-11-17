# CTMS-050 — Manage Survival Documents

## CTMS-052 dependency amendment — 2026-11-06

BR-227 defines the current publication. BR-484 and BR-535 through BR-537 define source eligibility. **Approve Safety Guidance Applicability** owns Admin approval, taxonomy, complete guidance grouping and versioned coverage policy. CTMS-052 consumes approved extracts for the current eligible version and active READY chunk set. BR-538 applies to distribution or translation of the original PDF. Stop-use and deletion prevent new consumption. Existing package bytes remain immutable. See [upstream contracts](ctms-52-upstream-safety-contracts.md).

## 1. Overview

| Field | Value |
| --- | --- |
| Story | CTMS-050 |
| Epic | EPIC 11. AI Survival Assistant and RAG |
| Priority | Must Have |
| Goal | Maintain authoritative, versioned PDF sources for downstream survival knowledge. |

An active Admin can create a document or add a version by uploading a PDF from their device or importing a PDF from a direct HTTPS URL. The workspace supports search, filters, private preview, draft metadata edits, publication, version history and stop-use. The source catalog and the former Submit → Review → Approve workflow are retired.

## 2. Scope

In scope are PDF intake and safety checks, duplicate detection, draft and published lifecycle, provenance, use permissions, audit, and downstream regeneration events. Chunk generation (CTMS-051), offline package generation (CTMS-052), RAG retrieval (CTMS-068) and AI answering (CTMS-069) are downstream work.

## 3. Actors and Preconditions

- **Admin** signs in with an active account and the Admin role. Each write to an existing document or version supplies its expected revision.
- **System** validates input, stores private files, enforces lifecycle and use permissions, and records audit and downstream events.
- **Downstream consumer** uses the internal reader for the current published version and revalidates eligibility before committing derived artifacts.

## 4. Acceptance Criteria

| Source | Criterion |
| --- | --- |
| PB AC-1 | Admin can create a private draft or add a version from exactly one PDF source, local file or direct HTTPS URL. |
| PB AC-2 | A valid unique intake stores traceable identity, version, classification, language and status. |
| PB AC-3 | Publishing advances the current version, preserves past provenance and automatically queues eligible PDF content for knowledge processing. |
| PB AC-4 | Downstream consumers can identify the precise source version that generated chunks or packages. |
| PB AC-5 | Invalid or ineligible content cannot become authoritative. Admin can stop use of a publication with a reason, and downstream access respects lifecycle and permitted use. |
| PB AC-6 | The system rejects duplicate filenames, duplicate SHA-256 checksums, and matches on both. Admin can open the exact version returned by the conflict. |

## 5. Business Rules

| ID | Rule |
| --- | --- |
| BR-227 | An authorized Admin manages the publication lifecycle. Each document has at most one authoritative current published version. A replacement draft leaves the current version available. Publishing a newer draft that meets BR-484 supersedes the current version. Stop-use archives the current version. File identity and published provenance are retained, with critical actions audited under BR-191. |
| BR-482 | A draft starts from one local PDF or one direct HTTPS PDF URL and requires a title, classification and language. The source URL is optional when saving a local upload as a draft. Validate bytes and parsed structure before storage. Accept standard PDF object compression. Reject encryption, active content and embedded files, including inside compressed objects. |
| BR-483 | Both the normalized PDF filename and SHA-256 must be new across all stored versions, including drafts, superseded and archived versions. Apply this to new documents and replacement versions. A duplicate conflict leaves documents, versions, files, revision counters and audit history unchanged. Concurrent submissions sharing either key may create at most one version. |
| BR-484 | Publication requires a verified source for the exact PDF version, backed by a configured exact HTTPS hostname, a configured SHA-256, or recorded evidence of source identity and internal use rights for that version. |
| BR-485 | After confirmation, an authorized Admin can permanently delete a whole Survival Document and all its versions. A stale document revision or a reference from another document blocks deletion. Preserve audit history under BR-191 and remove private PDF files after the transaction commits. |
| BR-534 | Publishing an eligible version records its automatic ingestion event in the same transaction as publication. |
| BR-535 | Knowledge processing excludes sources with a restricted or review-required rights status. |
| BR-536 | Knowledge processing of first-aid or medical material requires recorded specialist review approval. |
| BR-537 | Knowledge processing of a translated source requires a recorded translation grant. |
| BR-538 | Distribution or translation of a private original PDF requires a recorded grant for the requested use. |
| BR-172 | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization. |
| BR-191 | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change. |
| BR-212 | Changes to business rules, enums, state transitions or the API contract must be reflected in the specification, tests and data documentation. |
| BR-213 | Every business rule must cover a valid path and a violation path. Concurrency, idempotency and transaction rules require integration or E2E coverage. |

## 6. State and Lifecycle

| Current state | Action | Result |
| --- | --- | --- |
| No version | Save a valid unique PDF | Create a private `DRAFT`. |
| `DRAFT` | Edit metadata | Stay in `DRAFT` and advance its revision. Changed metadata invalidates previously recorded rights for the draft. |
| `DRAFT` | Publish | Set it as current `PUBLISHED`. A previously current version becomes `SUPERSEDED` in the same transaction. |
| Current `PUBLISHED` | Stop use with a reason | Move to `ARCHIVED` and clear the current publication pointer. |
| `SUPERSEDED` or `ARCHIVED` | View history | Retain immutable provenance for Admin and historical references. |

A draft older than a version already published for that document cannot be published. Publication and stop-use write audit and downstream events in the same transaction as the state change.

## 7. Business Flow

### A. Add a document or version

1. Admin opens **Thêm tài liệu** or **Tạo phiên bản mới**, selects local upload or direct HTTPS URL, enters title, classification and language, and saves the draft. A local PDF can be previewed in the editor.
2. The API verifies Admin access and validates the input. For a URL, the server checks DNS/IP and the destination of each allowed redirect, enforces timeout and size limits, then downloads the bytes.
3. The system checks the PDF bytes, determines the filename and computes SHA-256.
4. The system checks both keys against existing versions. On a conflict, the API returns HTTP 409 with the reason and the existing document/version. The editor keeps the input available and offers **Mở phiên bản đã có**.
5. If neither key matches, the system serializes competing writes by checksum and normalized filename and checks again before writing. It also verifies the expected document revision when adding a version.
6. The system stores the private PDF, creates the draft and audit entry, and returns the document detail. Admin can open the stored PDF from the draft detail. Creating a draft does not trigger downstream regeneration.

#### Duplicate decision table (BR-483)

| Case | PDF filename | SHA-256 | Outcome | HTTP 409 code |
| --- | --- | --- | --- | --- |
| TH1 | Different | Same | Reject as duplicate content | `SOURCE_DUPLICATE_PDF` |
| TH2 | Same | Same | Reject as duplicate filename and content | `SOURCE_DUPLICATE_PDF_NAME_AND_CONTENT` |
| TH3 | Same | Different | Reject as duplicate filename | `SOURCE_DUPLICATE_PDF_NAME` |
| Valid | New across the repository | New across the repository | Continue draft creation | - |

The filename comparison uses the stored PDF filename with Unicode NFC normalization, case-insensitive comparison and leading/trailing spaces ignored. SHA-256 identifies identical file bytes. For URL import, the system uses a valid PDF basename from the final URL, then from the originally requested URL. If neither supplies one, it generates `imported-<sha256>.pdf`. If the filename and checksum match different records, the conflict identifies a checksum match. A match on both keys in the same version takes precedence over a checksum-only match.

### B. Publish or stop use

1. Admin selects **Xuất bản** from intake or the draft detail. Intake saves the draft first, then publishes that version.
2. The API checks the revision, PDF integrity, metadata and source verification. Where applicable, Admin records the licence, attribution and evidence for the exact PDF when publishing. The transaction supersedes the previous version and emits `published_version_changed`. The worker queues eligible content automatically.
3. To stop use, Admin selects the current published version and supplies a reason. The API archives it, clears the publication pointer and emits `source_unavailable`.
4. Downstream consumers treat these events as a change in source availability or a need to regenerate. Event creation alone does not indicate derived content is ready.

### C. Permanently delete a document

1. Admin opens the document, selects **Xóa tài liệu** and confirms deletion of all versions.
2. The API checks the document revision. In one transaction it deletes the document and all version rows, records the audit entry and releases the files for cleanup. A reference from another document rolls back the transaction and returns HTTP 409.
3. After commit the system removes the private PDF files. The cleanup job retries any failed file removal. The workspace closes the detail and refreshes the list.

## 8. Data and Invariants

- A document has a stable ID, revision, monotonic version count and at most one current publication.
- Each version stores its ID, version number, source metadata, SHA-256, original filename, private file reference, size, state and revision. Published provenance and the original file identity are immutable.
- The publication audit identifies the Admin and the exact version's SHA-256. Historical `processing_approved_at` values remain readable for compatibility. Eligibility uses the source and rights evidence.
- Historical versions keep their audit and provenance. Duplicate filename and checksum indexes allow pre-existing duplicate rows to remain in history. Every new intake checks those rows.
- Downstream consumers can identify the precise source version, checksum and locale. Only the current eligible publication can supply bytes for new processing. Previously published versions can resolve historical citations.

## 9. API Contract

All endpoints are under `/api/admin/survival-documents` and require an active Admin session.

| Method | Relative route | Purpose |
| --- | --- | --- |
| GET | `/` | Search/filter documents and paginate results |
| GET | `/:id` | Document details, version history and audit |
| DELETE | `/:id?expectedRevision=…` | Permanently delete the document and versions. Returns HTTP 204 on success. |
| GET | `/:id/versions` | Version history |
| GET | `/:id/versions/:versionId/file` | Authenticated private PDF download or preview |
| POST | `/` | Create draft v1 from multipart `file` and JSON-encoded `metadata` |
| POST | `/import-url` | Create draft v1 from JSON `sourceUrl` and `metadata` |
| POST | `/:id/versions` | Multipart draft replacement with `expectedDocumentRevision` |
| POST | `/:id/versions/import-url` | JSON URL draft replacement with `expectedDocumentRevision` |
| PATCH | `/:id/versions/:versionId/metadata` | Edit draft metadata with `expectedRevision` |
| POST | `/:id/versions/:versionId/publish` | Publish with `expectedRevision` and optional verified rights. The deprecated `approveProcessing` input has no effect. |
| POST | `/:id/versions/:versionId/archive` | Stop use with `expectedRevision` and a reason |

A duplicate response includes `code`, `message`, `documentId`, `versionId`, `versionNumber` and `sourceTitle`. Authorization, invalid input, unsafe/unavailable URLs, oversize files, stale revisions and illegal transitions return errors without advancing the lifecycle. See the [implementation and data documentation](../../docs/features/CTMS-050-Implementation.md) for technical details.

## 10. Acceptance and Test Matrix

Each BR ID refers to its definition in Section 5. The scenarios below describe the expected behavior for Survival Documents.

| Rule ID | Valid path | Violation or edge case | Coverage |
| --- | --- | --- | --- |
| BR-227 | New publication supersedes the previous one and archive retains history | Stale revisions, illegal transitions, overwrite of published provenance, and downstream access after archive | PostgreSQL integration, Chrome |
| BR-482 | Admin creates a private draft by local upload or URL import | Malformed or unsafe PDF, blocked URL, oversize response | Unit, HTTP E2E, PostgreSQL integration, Chrome |
| BR-483 | A new name and new bytes create one draft | TH1–TH3, case/NFC/space variants, legacy or archived matches, and concurrent same-name or same-checksum requests | PostgreSQL integration, HTTP E2E, Chrome |
| BR-484 | Admin publishes a PDF with a configured source or documented exact-version rights | Unverified source stays a draft even when a legacy client sends `approveProcessing` | Policy unit, PostgreSQL integration, Web |
| BR-534 | Successful eligible publication leaves a durable event for CTMS-051 | Rejected or rolled-back publication leaves no ingestion event | PostgreSQL integration, HTTP E2E |
| BR-535 | Source with permitted use can be processed | Restricted or review-required source is excluded | PostgreSQL integration |
| BR-536 | Recorded specialist approval permits an otherwise eligible medical source | Missing or rejected specialist review blocks ingestion | Policy unit, PostgreSQL integration |
| BR-537 | Translation with verified provenance and a grant can be processed | Missing translation grant blocks ingestion | Policy unit, PostgreSQL integration |
| BR-538 | Private reader allows a granted use | An original PDF cannot be used for offline distribution or translation without a grant | Policy unit, PostgreSQL integration |
| BR-485 | Confirmed deletion removes document, versions and PDFs, and retains audit | Stale revision or another document referencing a version | PostgreSQL integration, Chrome |
| BR-172 | The API allows an active Admin to access private PDFs and manage document versions | The API returns HTTP 401 without a session and HTTP 403 for a disallowed role. Rejected writes leave the document unchanged. | HTTP E2E, PostgreSQL integration |
| BR-191 | A successful publication records the Admin, action, document, timestamp and version state before and after publication. Archiving also records its reason. | If the audit write fails, the publication, current-version pointer and outbox event roll back together. | PostgreSQL integration |
| BR-212 and BR-213 | Rule, spec, implementation notes and tests align | Missing failure or transaction coverage blocks completion | Documentation and test review |

## 11. Source policy configuration

Configure comma-separated verified HTTPS hostnames with `SURVIVAL_KNOWLEDGE_APPROVED_HOSTS` and exact PDF digests with `SURVIVAL_KNOWLEDGE_APPROVED_SHA256`. For URL imports, the hostname check uses the final download URL. Admin can also record exact-version licence, attribution and use evidence during publication. Medical and translated sources use their existing recorded specialist decision or grant. An older publication that relied solely on the retired approval flag needs independent source evidence. A verified source configuration can make that same version eligible without changing its history.
