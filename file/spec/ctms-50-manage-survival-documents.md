# CTMS-050 — Manage Survival Documents

## Approved lifecycle amendment — 2026-11-28

Eligible drafts now prepare knowledge before publication. The previous eligible publication remains current until an explicit atomic source/knowledge switch. READY drafts remain private. See [the lifecycle contract and diagrams](../../docs/features/Document-Version-Knowledge-Lifecycle.md) and [CTMS-220 restoration](ctms-220-document-version-editor.md).

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
| PB AC-3 | Eligible drafts prepare knowledge before publication. Explicit publication atomically switches the current version and its complete READY knowledge, preserving immutable history. |
| PB AC-4 | Downstream consumers can identify the precise source version that generated chunks or packages. |
| PB AC-5 | Invalid or ineligible content cannot become authoritative. Admin can stop use of a publication with a reason, and downstream access respects lifecycle and permitted use. |
| PB AC-6 | The system rejects duplicate filenames, duplicate SHA-256 checksums, and matches on both. Admin can open the exact version returned by the conflict. |

## 5. Business Rules

| ID | Rule |
| --- | --- |
| BR-227 | An authorized Admin manages one current publication per document. A replacement remains DRAFT during preparation. Normal publication requires current complete READY knowledge for RAG-eligible inputs and atomically switches both the source version and active knowledge. Stop-use archives the current version immediately without historical fallback. Preserve immutable history and audit under BR-191. |
| BR-482 | A draft starts from one local PDF, one direct HTTPS PDF URL, or a confirmed internal composition authorized for each exact source version. A draft requires a title, classification and language. The source URL is optional for local uploads and for CTMS compositions. The PDF may be up to 50 MiB (52,428,800 bytes) by default. A deployment may configure a lower limit. Validate bytes and parsed structure before storage. Accept standard PDF object compression. Reject encryption, active content and embedded files, including inside compressed objects. |
| BR-483 | Ordinary upload/import requires a globally new normalized filename and SHA-256. Explicit authorized restoration or a confirmed historical composition may ignore matching SUPERSEDED rows of the same document only. Current publications, other drafts, archived records and unrelated documents retain duplicate protection. Reject current-content no-ops and preserve concurrency serialization. Restoration always creates a new version. |
| BR-484 | Source confirmation is exact-version evidence. Admin may confirm a private draft for preparation without publication, or use the existing configured source/rights evidence. Publication separately records publisher, time and checksum. Source confirmation does not grant specialist approval, adaptation, translation or offline distribution rights. |
| BR-485 | After confirmation, an authorized Admin can permanently delete a whole Survival Document and all its versions. A stale document revision or a reference from another document blocks deletion. Preserve audit history under BR-191 and remove private PDF files after the transaction commits. |
| BR-534 | Eligible draft creation, confirmation and relevant input changes record durable preparation delivery in the source transaction. Publication requires prepared knowledge and atomically records source activation, the active chunk-set reference, audit and the publication outbox event. READY never publishes a draft automatically. |
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
| `DRAFT` | Explicitly publish current READY inputs | Atomically set current `PUBLISHED` and its active knowledge; supersede the previous version. |
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
6. The system stores the private PDF, creates the draft and audit entry, and returns the document detail. Admin can open the stored PDF from the draft detail. Creating an eligible draft records a preparation event. Unconfirmed sources remain private until the Admin confirms preparation eligibility.

The **Sửa thông tin** form edits the draft title, classification, language, publisher and notes. Saving these fields preserves the existing source URL, recorded provenance and licence metadata.

#### Duplicate decision table (BR-483)

| Case | PDF filename | SHA-256 | Outcome | HTTP 409 code |
| --- | --- | --- | --- | --- |
| TH1 | Different | Same | Reject as duplicate content | `SOURCE_DUPLICATE_PDF` |
| TH2 | Same | Same | Reject as duplicate filename and content | `SOURCE_DUPLICATE_PDF_NAME_AND_CONTENT` |
| TH3 | Same | Different | Reject as duplicate filename | `SOURCE_DUPLICATE_PDF_NAME` |
| Valid | New across the repository | New across the repository | Continue draft creation | - |

The filename comparison uses the stored PDF filename with Unicode NFC normalization, case-insensitive comparison and leading/trailing spaces ignored. SHA-256 identifies identical file bytes. For URL import, the system uses a valid PDF basename from the final URL, then from the originally requested URL. If neither supplies one, it generates `imported-<sha256>.pdf`. If the filename and checksum match different records, the conflict identifies a checksum match. A match on both keys in the same version takes precedence over a checksum-only match.

### B. Prepare, publish or stop use

1. Save a private draft. Eligible sources are scheduled automatically; other uploaded sources require **Xác nhận nguồn và chuẩn bị nội dung**. This records preparation confirmation without publication.
2. The existing worker performs full extraction/chunking, quality validation, historical exact-input vector reuse and encoding of misses. It persists an independent READY set. V1 remains retrievable while V2 is pending, processing, under review or failed.
3. Admin explicitly selects **Xuất bản** after the current draft inputs are READY. Under the document lock, the API checks expected document/draft revisions and all current source, adaptation and medical requirements. It verifies complete prepared knowledge, supersedes the previous version, publishes the replacement, switches both pointers and records audit/outbox in one transaction. Any failure rolls everything back.
4. **Ngừng sử dụng** still requires a reason, immediately archives the current version and removes retrieval eligibility. No replacement readiness or historical fallback is used.

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
- Downstream consumers can identify the precise source version, checksum and locale. Eligible private drafts can supply bytes only to the preparation boundary. Production retrieval and offline guidance continue to require the current eligible publication. Previously published versions can resolve historical citations.

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
| POST | `/:id/versions/:versionId/prepare` | Confirm source/rights and queue private preparation with `expectedRevision` and `expectedDocumentRevision`. |
| POST | `/:id/versions/:versionId/restore` | Create a new draft from an eligible historical version using both revisions and a required reason. |
| POST | `/:id/versions/:versionId/publish` | Publish current READY inputs with `expectedRevision` and `expectedDocumentRevision`, optional Admin source confirmation (`confirmSource`) and optional verified rights. The deprecated `approveProcessing` input has no effect. |
| POST | `/:id/versions/:versionId/archive` | Stop use with `expectedRevision` and a reason |

A duplicate response includes `code`, `message`, `documentId`, `versionId`, `versionNumber` and `sourceTitle`. Authorization, invalid input, unsafe/unavailable URLs, oversize files, stale revisions and illegal transitions return errors without advancing the lifecycle. See the [implementation and data documentation](../../docs/features/CTMS-050-Implementation.md) for technical details.

## 10. Acceptance and Test Matrix

Each BR ID refers to its definition in Section 5. The scenarios below describe the expected behavior for Survival Documents.

| Rule ID | Valid path | Violation or edge case | Coverage |
| --- | --- | --- | --- |
| BR-227 | An authorized Admin manages one current publication per document. A replacement remains DRAFT during preparation. Normal publication requires current complete READY knowledge for RAG-eligible inputs and atomically switches both the source version and active knowledge. Stop-use archives the current version immediately without historical fallback. Preserve immutable history and audit under BR-191. |
| BR-482 | Admin creates a private draft by local upload or URL import, including a valid PDF exactly at the size limit | Malformed or unsafe PDF, blocked URL, PDF one byte over the size limit | Unit, HTTP E2E, PostgreSQL integration, Chrome |
| BR-482, BR-484, BR-536 | Admin confirms `ABCDG` from `ABCDE` and `ABDFG`, creates a PDF, and publishes an eligible exact version | Ambiguous history, stale or duplicate requests, missing permission, unconfirmed draft, invalid generated PDF or missing specialist approval | Unit, PostgreSQL integration with guarded HTTP, PDF round trip |
| BR-483 | Ordinary upload/import requires a globally new normalized filename and SHA-256. Explicit authorized restoration or a confirmed historical composition may ignore matching SUPERSEDED rows of the same document only. Current publications, other drafts, archived records and unrelated documents retain duplicate protection. Reject current-content no-ops and preserve concurrency serialization. Restoration always creates a new version. |
| BR-484 | Source confirmation is exact-version evidence. Admin may confirm a private draft for preparation without publication, or use the existing configured source/rights evidence. Publication separately records publisher, time and checksum. Source confirmation does not grant specialist approval, adaptation, translation or offline distribution rights. |
| BR-534 | Eligible draft creation, confirmation and relevant input changes record durable preparation delivery in the source transaction. Publication requires prepared knowledge and atomically records source activation, the active chunk-set reference, audit and the publication outbox event. READY never publishes a draft automatically. |
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
