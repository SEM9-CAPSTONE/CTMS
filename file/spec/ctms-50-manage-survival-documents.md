# CTMS-050 — Manage Survival Documents

## CTMS-052 dependency amendment — 2026-11-06

BR-227.3 publication and exact-version OFFLINE rights remain authoritative. Publication/classification does not approve a guidance unit's applicability. Proposed **Approve Safety Guidance Applicability** owns Admin approval, taxonomy, complete guidance grouping and versioned coverage policy; see [upstream contracts](ctms-52-upstream-safety-contracts.md). 052 consumes this result and does not add a document Admin UI or second per-Trip approval. Acceptance: PUBLISHED without OFFLINE rights or guidance approval is excluded; exact-version approval with READY chunks and coverage can be consumed; stop-use/deletion prevents new consumption without editing prior package bytes.

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
| PB AC-3 | Publishing a draft advances the current version and records a publication event. Prior provenance remains available and downstream processing requires verified use rights. |
| PB AC-4 | Downstream consumers can identify the precise source version that generated chunks or packages. |
| PB AC-5 | Invalid or ineligible content cannot become authoritative. Admin can stop use of a publication with a reason, and downstream access respects lifecycle and permitted use. |
| BR-227.2 | The system rejects duplicate filenames, duplicate SHA-256 checksums, and matches on both. Admin can open the exact version returned by the conflict. |

## 5. Business Rules

| ID | Rule |
| --- | --- |
| BR-227 | An authorized Admin manages a PDF source through intake, classification, draft metadata, direct publication, versioning and stop-use. The current publication identifies the authoritative source version. |
| BR-227.1 | Intake accepts one local PDF or one direct HTTPS PDF URL. A draft requires a valid PDF, title, classification and language. The URL is optional for local upload metadata. PDF validation is based on the file bytes and parsed structure and is enforced before storage. Standard PDF object compression is accepted; encryption, active content and embedded files are rejected, including when hidden in compressed objects. |
| BR-227.2 | Both the PDF filename and SHA-256 must be new across all stored versions, including drafts, superseded and archived versions. This applies to independent documents and new versions. A conflict leaves documents, versions, files, revision counters and audit history unchanged. Concurrent requests sharing either key may create at most one version. |
| BR-227.3 | Publication requires an intact stored PDF and valid metadata. The Admin workflow publishes without collecting rights evidence. Downstream use requires recorded exact-version permissions and evidence, including separate grants for offline redistribution and translation and professional review for medical content. |
| BR-227.4 | Only one version per document may be current and published. A replacement draft leaves the current version available. Publishing a newer eligible version supersedes the current one, and stopping use archives it. The system retains file identity, published provenance and audit history. |
| BR-227.5 | Admin can permanently delete a whole document and its versions after confirmation. A stale document revision or a reference from another document blocks deletion. Audit history remains, and private files are removed after commit. |
| BR-212 | Changes to business rules, enums, state transitions or the API contract must be reflected in the specification, tests and data documentation. |
| BR-213 | Every business rule must cover a valid path and a violation path. Concurrency, idempotency and transaction rules require integration or E2E coverage. |

### Duplicate decision table (BR-227.2)

| Case | PDF filename | SHA-256 | Outcome | HTTP 409 code |
| --- | --- | --- | --- | --- |
| TH1 | Different | Same | Reject as duplicate content | `SOURCE_DUPLICATE_PDF` |
| TH2 | Same | Same | Reject as duplicate filename and content | `SOURCE_DUPLICATE_PDF_NAME_AND_CONTENT` |
| TH3 | Same | Different | Reject as duplicate filename | `SOURCE_DUPLICATE_PDF_NAME` |
| Valid | New across the repository | New across the repository | Continue draft creation | — |

The filename comparison uses the stored PDF filename with Unicode NFC normalization, case-insensitive comparison and leading/trailing spaces ignored. SHA-256 identifies identical file bytes. For URL import, the system uses a valid PDF basename from the final URL, then from the originally requested URL. If neither supplies one, it generates `imported-<sha256>.pdf`. If the filename and checksum match different records, the conflict identifies a checksum match. A match on both keys in the same version takes precedence over a checksum-only match.

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

### B. Publish or stop use

1. Admin selects **Xuất bản** from intake or the draft detail. Intake saves the draft first, then publishes that version.
2. The API checks the revision, PDF integrity and metadata, publishes the version, supersedes the prior current version if present and emits `published_version_changed`. The event requests regeneration only when the version has verified processing rights.
3. To stop use, Admin selects the current published version and supplies a reason. The API archives it, clears the publication pointer and emits `source_unavailable`.
4. Downstream consumers treat these events as a change in source availability or a need to regenerate. Event creation alone does not indicate derived content is ready.

### C. Permanently delete a document

1. Admin opens the document, selects **Xóa tài liệu** and confirms deletion of all versions.
2. The API checks the document revision. In one transaction it deletes the document and all version rows, records the audit entry and releases the files for cleanup. A reference from another document rolls back the transaction and returns HTTP 409.
3. After commit the system removes the private PDF files. The cleanup job retries any failed file removal. The workspace closes the detail and refreshes the list.

## 8. Data and Invariants

- A document has a stable ID, revision, monotonic version count and at most one current publication.
- Each version stores its ID, version number, source metadata, SHA-256, original filename, private file reference, size, state and revision. Published provenance and the original file identity are immutable.
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
| POST | `/:id/versions/:versionId/publish` | Publish with `expectedRevision`. API callers can supply optional verified rights, subject to exact-version validation. |
| POST | `/:id/versions/:versionId/archive` | Stop use with `expectedRevision` and a reason |

A duplicate response includes `code`, `message`, `documentId`, `versionId`, `versionNumber` and `sourceTitle`. Authorization, invalid input, unsafe/unavailable URLs, oversize files, stale revisions and illegal transitions return errors without advancing the lifecycle. See the [implementation and data documentation](../../docs/features/CTMS-050-Implementation.md) for technical details.

## 10. Acceptance and Test Matrix

| Rule | Valid path | Violation or edge case | Coverage |
| --- | --- | --- | --- |
| BR-227, BR-227.1 | Admin creates a private draft by local upload or URL import | Non-Admin, malformed or unsafe PDF, blocked URL, oversize response | Unit, HTTP E2E, PostgreSQL integration, Chrome |
| BR-227.2 | A new name and new bytes create one draft | TH1–TH3, case/NFC/space variants, legacy or archived matches, and concurrent same-name or same-checksum requests | PostgreSQL integration, HTTP E2E, Chrome |
| BR-227.3 | Draft publishes without rights input. A verified version can be used within the recorded permission scope. | Downstream use of an unverified version or a use outside the recorded permission scope | Policy unit, PostgreSQL integration, Chrome |
| BR-227.4 | New publication supersedes the previous one and archive retains history | Stale revisions, illegal transitions, overwrite of published provenance, and downstream access after archive | PostgreSQL integration, Chrome |
| BR-227.5 | Confirmed deletion removes document, versions and PDFs, and retains audit | Missing permission, stale revision, or another document referencing a version | PostgreSQL integration, Chrome |
| BR-212, BR-213 | Rule, spec, implementation notes and tests align | Missing failure or transaction coverage blocks completion | Documentation and test review |
