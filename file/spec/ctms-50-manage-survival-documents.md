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
| BR-482 | A draft starts from one local PDF, one direct HTTPS PDF URL, or a confirmed internal composition authorized for each exact source version. A draft requires a title, classification and language. The source URL is optional for local uploads and for CTMS compositions. The PDF may be up to 50 MiB (52,428,800 bytes) by default. A deployment may configure a lower limit. Validate bytes and parsed structure before storage. Accept standard PDF object compression. Reject encryption, active content and embedded files, including inside compressed objects. |
| BR-483 | Both the normalized PDF filename and SHA-256 must be new across all stored versions, including drafts, superseded and archived versions. Apply this to new documents and replacement versions. A duplicate conflict leaves documents, versions, files, revision counters and audit history unchanged. Concurrent submissions sharing either key may create at most one version. |
| BR-484 | Publication requires source confirmation for the exact PDF version. The Admin web **Xuất bản** action confirms that source and records the publisher, publication time and checksum. A configured exact HTTPS hostname, configured SHA-256 or recorded exact-version source and internal-use rights can also establish eligibility. The source confirmation does not grant specialist approval, translation or offline redistribution rights. |
| BR-485 | After confirmation, an authorized Admin can permanently delete a whole Survival Document and all its versions. A stale document revision or a reference from another document blocks deletion. Preserve audit history under BR-191 and remove private PDF files after the transaction commits. |
| BR-534 | Publishing an eligible version records its automatic ingestion event in the same transaction as publication. |
| BR-535 | Knowledge processing excludes sources with a restricted or review-required rights status. |
| BR-536 | Admin source confirmation for an uploaded first-aid or medical PDF establishes source/content eligibility for automatic extraction. An explicit rejected medical-content status remains blocking. Technical extraction validation applies before READY. |
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

The **Sửa thông tin** form edits the draft title, classification, language, publisher and notes. Saving these fields preserves the existing source URL, recorded provenance and licence metadata.

#### Duplicate decision table (BR-483)

| Case | PDF filename | SHA-256 | Outcome | HTTP 409 code |
| --- | --- | --- | --- | --- |
| TH1 | Different | Same | Reject as duplicate content | `SOURCE_DUPLICATE_PDF` |
| TH2 | Same | Same | Reject as duplicate filename and content | `SOURCE_DUPLICATE_PDF_NAME_AND_CONTENT` |
| TH3 | Same | Different | Reject as duplicate filename | `SOURCE_DUPLICATE_PDF_NAME` |
| Valid | New across the repository | New across the repository | Continue draft creation | - |

The filename comparison uses the stored PDF filename with Unicode NFC normalization, case-insensitive comparison and leading/trailing spaces ignored. SHA-256 identifies identical file bytes. For URL import, the system uses a valid PDF basename from the final URL, then from the originally requested URL. If neither supplies one, it generates `imported-<sha256>.pdf`. If the filename and checksum match different records, the conflict identifies a checksum match. A match on both keys in the same version takes precedence over a checksum-only match.

### B. Publish or stop use

1. Admin selects **Xuất bản** from intake or the draft detail to confirm the source of that version. Intake saves the draft first, then publishes that version. **Lưu bản nháp** only saves the draft.
2. The API checks the revision, PDF integrity, metadata and source verification, including the recorded licence, attribution and evidence for the exact PDF where applicable. The transaction supersedes the previous version and emits `published_version_changed`. The worker queues eligible content automatically.
3. To stop use, Admin selects the current published version and supplies a reason. The API archives it, clears the publication pointer and emits `source_unavailable`.
4. Downstream consumers treat these events as a change in source availability or a need to regenerate. Event creation alone does not indicate derived content is ready.

### C. Permanently delete a document

1. Admin opens the document, selects **Xóa tài liệu** and confirms deletion of all versions.
2. The API checks the document revision. In one transaction it deletes the document and all version rows, records the audit entry and releases the files for cleanup. A reference from another document rolls back the transaction and returns HTTP 409.
3. After commit the system removes the private PDF files. The cleanup job retries any failed file removal. The workspace closes the detail and refreshes the list.

### D. Edit from the current version

1. An Admin opens an editable draft based on the current version and its document revision. The editor reads verified PDF bytes and accepts text PDFs whose structure and content pass the extraction checks. Historical comparisons read the chosen version of the same document.
2. Instructions propose changes to the draft. An Admin can also keep, replace, remove, restore, insert or reorder a section directly. Show the original and proposed ordered content, including tables, warnings and historical source locations. Require an explicit choice when names or positions are ambiguous. Restoring content requires an explicit operation.
3. An Admin confirms the proposed content and records the basis for the conclusions, warnings and applicability. Standalone warnings and prerequisites identified in retained source versions must remain with their guidance. Any further change invalidates that confirmation. Saving or confirming a draft leaves the published version available.
4. Creating a version from the confirmed draft requires adaptation authorization for the exact base PDF and each included historical PDF. Generate a new PDF attributed to CTMS and validate it through the regular file and duplicate checks. The generated version starts as `DRAFT` and preserves a link to the confirmed snapshot. Stale revisions or a previously committed edit request cannot create an extra version.
5. The existing publish action rechecks adaptation authorization and uses the existing publication transaction, including BR-534. A medical composition needs separately recorded specialist approval for the SHA-256 of the generated PDF. Offline redistribution and translation require separate authorization under the existing rules. If publication is blocked, the generated version stays private and can be reviewed and retried.

## 8. Data and Invariants

- A document has a stable ID, revision, monotonic version count and at most one current publication.
- Each version stores its ID, version number, source metadata, SHA-256, original filename, private file reference, size, state and revision. Published provenance and the original file identity are immutable.
- The publication audit identifies the Admin and the exact version's SHA-256. Historical `processing_approved_at` values remain readable for compatibility. Eligibility uses the source and rights evidence.
- Historical versions keep their audit and provenance. Duplicate filename and checksum indexes allow pre-existing duplicate rows to remain in history. Every new intake checks those rows.
- Downstream consumers can identify the precise source version, checksum and locale. Only the current eligible publication can supply bytes for new processing. Previously published versions can resolve historical citations.

## 9. API Contract

Editor endpoints under `/api/admin/survival-documents/:id` apply the same Admin authorization as uploaded versions. Write endpoints after creation require the expected editor revision and a request UUID. Drafts are scoped to the creating Admin.

| Method and path | Result |
| --- | --- |
| `POST /edit-drafts` | Start or reopen the editor for the expected current document revision. |
| `GET /versions/:versionId/editor-content` | Read editable structure from the exact stored version. |
| `POST /edit-drafts/:draftId/plan` | Propose and save draft revisions for preview. |
| `GET /edit-drafts/:draftId/preview` | Read the base and current draft snapshots. |
| `PATCH /edit-drafts/:draftId` | Confirm the exact draft revision with the review basis. |
| `POST /edit-drafts/:draftId/commit` | Generate a verified PDF and create a normal `DRAFT` version. |
| `GET /versions/:versionId/editor-lineage` | Read the recorded section-level sources of a composed version. |

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
| POST | `/:id/versions/:versionId/publish` | Publish with `expectedRevision`, optional Admin source confirmation (`confirmSource`) and optional verified rights. The deprecated `approveProcessing` input has no effect. |
| POST | `/:id/versions/:versionId/archive` | Stop use with `expectedRevision` and a reason |

A duplicate response includes `code`, `message`, `documentId`, `versionId`, `versionNumber` and `sourceTitle`. Authorization, invalid input, unsafe/unavailable URLs, oversize files, stale revisions and illegal transitions return errors without advancing the lifecycle. See the [implementation and data documentation](../../docs/features/CTMS-050-Implementation.md) for technical details.

## 10. Acceptance and Test Matrix

Each BR ID refers to its definition in Section 5. The scenarios below describe the expected behavior for Survival Documents.

| Rule ID | Valid path | Violation or edge case | Coverage |
| --- | --- | --- | --- |
| BR-227 | New publication supersedes the previous one and archive retains history | Stale revisions, illegal transitions, overwrite of published provenance, and downstream access after archive | PostgreSQL integration, Chrome |
| BR-482 | Admin creates a private draft by local upload or URL import, including a valid PDF exactly at the size limit | Malformed or unsafe PDF, blocked URL, PDF one byte over the size limit | Unit, HTTP E2E, PostgreSQL integration, Chrome |
| BR-482, BR-484, BR-536 | Admin confirms `ABCDG` from `ABCDE` and `ABDFG`, creates a PDF, and publishes an eligible exact version | Ambiguous history, stale or duplicate requests, missing permission, unconfirmed draft, invalid generated PDF or missing specialist approval | Unit, PostgreSQL integration with guarded HTTP, PDF round trip |
| BR-483 | A new name and new bytes create one draft | TH1–TH3, case/NFC/space variants, legacy or archived matches, and concurrent same-name or same-checksum requests | PostgreSQL integration, HTTP E2E, Chrome |
| BR-484 | Admin confirms the exact source on publication, or publishes with a configured source or documented exact-version rights | Saving a draft or sending only the legacy `approveProcessing` flag leaves an unverified source unconfirmed | Policy unit, HTTP E2E, PostgreSQL integration, Web |
| BR-534 | Successful eligible publication leaves a durable event for CTMS-051 | Rejected or rolled-back publication leaves no ingestion event | PostgreSQL integration, HTTP E2E |
| BR-535 | Source with permitted use can be processed | Restricted or review-required source is excluded | PostgreSQL integration |
| BR-536 | Admin confirmation permits an otherwise eligible uploaded medical source | Explicit rejection or failed technical extraction blocks ingestion | Policy unit, PostgreSQL integration |
| BR-537 | Translation with verified provenance and a grant can be processed | Missing translation grant blocks ingestion | Policy unit, PostgreSQL integration |
| BR-538 | Private reader allows a granted use | An original PDF cannot be used for offline distribution or translation without a grant | Policy unit, PostgreSQL integration |
| BR-485 | Confirmed deletion removes document, versions and PDFs, and retains audit | Stale revision or another document referencing a version | PostgreSQL integration, Chrome |
| BR-172 | The API allows an active Admin to access private PDFs and manage document versions | The API returns HTTP 401 without a session and HTTP 403 for a disallowed role. Rejected writes leave the document unchanged. | HTTP E2E, PostgreSQL integration |
| BR-191 | A successful publication records the Admin, action, document, timestamp and version state before and after publication. Archiving also records its reason. | If the audit write fails, the publication, current-version pointer and outbox event roll back together. | PostgreSQL integration |
| BR-212 and BR-213 | Rule, spec, implementation notes and tests align | Missing failure or transaction coverage blocks completion | Documentation and test review |

## 11. Source policy configuration

The Admin web publication action sends `confirmSource: true` and records source confirmation on the published version. Configure comma-separated verified HTTPS hostnames with `SURVIVAL_KNOWLEDGE_APPROVED_HOSTS` and exact PDF digests with `SURVIVAL_KNOWLEDGE_APPROVED_SHA256` for sources verified by configuration. For URL imports, the hostname check uses the final download URL. The API also supports exact-version licence, attribution and use evidence. Admin-confirmed uploaded medical sources enter automatic extraction; an explicit medical rejection remains blocking. Translated sources require their recorded translation grant. An older publication that relied solely on the retired approval flag needs independent source evidence. A verified source configuration can make that same version eligible without changing its history.
