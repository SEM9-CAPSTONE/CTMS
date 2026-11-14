# CTMS-050 implementation and data dictionary

CTMS-050 lets an active Admin upload a local PDF or import a direct public HTTPS PDF URL. Both methods create a private draft for either a new document or a new version of an existing document. See the [functional specification](../../file/spec/ctms-50-manage-survival-documents.md) for the business rules and acceptance criteria.

## Ingestion and duplicate detection

1. The Admin selects a local PDF or enters a direct PDF URL and provides the document title, classification and language. When creating a version, the request also identifies the document and includes its current revision.
2. The API validates the request, acquires the PDF bytes, determines the filename and calculates SHA-256 over the bytes. A local upload uses the received filename, with a lossless UTF-8 recovery step for multipart filenames decoded as Latin-1. An import uses a safe PDF filename from the final URL path, then from the requested URL path if needed. If neither path supplies one, the API uses `imported-<sha256>.pdf` with the full checksum. URL query strings do not form part of the filename.
3. The API compares the filename and checksum with all stored versions across the library, including the target document and archived or superseded versions. Filename comparison normalizes Unicode to NFC, removes leading and trailing spaces, and ignores case. The original filename remains available for display and download. The display title has its own field.
4. A conflict returns HTTP 409 and the identity of an existing version. The editor shows the reason, the existing document title and version, and the **Mở phiên bản đã có** action. It enables saving again after the Admin changes the file or URL.
5. When both keys are new, the API stores the file privately and creates the draft and audit entry. A new version starts with its own rights assessment. The current publication remains available until an eligible replacement is published.

| Case | Filename | SHA-256 | Result |
| --- | --- | --- | --- |
| TH1 | Different | Same | Block with `SOURCE_DUPLICATE_PDF` |
| TH2 | Same | Same | Block with `SOURCE_DUPLICATE_PDF_NAME_AND_CONTENT` |
| TH3 | Same | Different | Block with `SOURCE_DUPLICATE_PDF_NAME` |
| New PDF | Different | Different | Continue draft creation |

A duplicate response contains `code`, `message`, `documentId`, `versionId`, `versionNumber` and `sourceTitle`. If two different rows match the two keys, the API returns the checksum match. If several historical rows match, the selection prefers a row that matches both keys, then the target document when supplied, then a published row and then the oldest row with ID as a tie-breaker. A blocked request leaves the documents, versions, revisions, audit history and permanent files unchanged.

The service checks for conflicts before creating a storage reservation. Within a `READ COMMITTED` transaction, it acquires transaction-scoped locks on the checksum and normalized filename, in that order, and checks again before writing the PDF. The second check catches a conflict when concurrent requests share either key. A losing request cleans up its unlinked reservation through the same compensation path as other failed writes. Non-unique indexes support lookup without removing or renaming existing rows that already share a key.

### File controls

- A local upload requires PDF MIME and a safe PDF filename. Both methods validate the PDF header, EOF marker and size, then parse the document with `pdf-lib` and require at least one page. Standard compressed object streams (`/ObjStm`) are supported. The safety checks inspect parsed dictionaries, arrays and stream dictionaries, including objects expanded from compressed streams, and reject encryption, active scripts, launch actions and embedded files. Action names are checked with PDF's case sensitivity after decoding name escapes. Raw image and text stream bytes are not scanned for action names: a coincidental `/aa` or `/JavaScript` byte sequence inside image data is not a PDF action. This is a document structure and policy check, not a malware scanner. Validation preserves the original bytes; SHA-256 is calculated over the original file.
- A URL import permits public HTTPS on the default port, with a DNS hostname and without embedded credentials. The API checks DNS and IP ranges at each hop, pins the connection to a checked address while validating the TLS certificate, and permits up to three redirects within a 15-second total timeout. Requests identify the client as `CTMS-PDF-Importer/1.0`; some public servers reject requests without a User-Agent. The download must return HTTP 200 and identity encoding. A failed source response reports its HTTP status. The API enforces the size limit while reading the response and validates the bytes independently of the response MIME and path extension.
- `SURVIVAL_DOCUMENT_MAX_BYTES` defaults to 10 MiB and supports a maximum of 50 MiB. `SURVIVAL_DOCUMENT_STORAGE_ROOT` defaults to `.private-survival-documents` under the API working directory and must be outside the public upload root. The authenticated file endpoint verifies size and SHA-256 before serving the bytes.

## Publication and downstream use

A draft holds a PDF and the minimum metadata. Publishing checks the draft revision, metadata, stored bytes and a configured HTTPS source hostname or exact PDF SHA-256. The source policy applies to new publications and downstream reads. URL imports record the final download URL. Eligible publications queue automatically. The optional API rights payload still requires exact-version licence, evidence and attribution. Medical and translation safeguards apply to downstream use. Separate grants are required to distribute or translate the original PDF.

| Action | Transition | Effect |
| --- | --- | --- |
| Save a new PDF | Creates `DRAFT` | The draft remains private and permissions start disabled. |
| Publish eligible draft | `DRAFT → PUBLISHED` | Updates the current publication and records rights, audit and an outbox event. |
| Publish a replacement | Previous `PUBLISHED → SUPERSEDED` | The new version becomes current and the previous version remains in history. |
| Stop use of the current publication | `PUBLISHED → ARCHIVED` | Requires a reason, clears the current publication and records a stop-use event. |
| Permanently delete a document | Removes the document and all version rows | Requires confirmation and the current document revision. Retains audit and records a deletion event for documents with publication history. |

Publication rejects older drafts when a newer version has already been published. Published, superseded and archived versions retain their original file, provenance and rights. Draft metadata changes clear previously recorded rights. An unchanged legacy draft can carry forward its recorded rights. Ineligible sources report `NOT_PROCESSED` with a reason in document detail. Actual chunking state and count come from the CTMS-051 status endpoint.

`SurvivalSourceReader.readPublished(versionId, use)` checks current source eligibility for ingestion. `OFFLINE` and `TRANSLATION` additionally check recorded rights for the original PDF. The reader verifies bytes and returns the exact-version manifest. `resolvePublishedProvenance(versionId)` returns provenance for previously published versions, including superseded or archived ones, with `historicalOnly: true`. Consumers must revalidate before committing outputs and record the version ID, checksum and language.

## Data dictionary

| Table or field | Behavior |
| --- | --- |
| `survival_documents` | Stable UUID, document revision, monotonic version count, nullable current published version, creator and timestamps. `expectedDocumentRevision` is required for another version. |
| `survival_document_versions` | Version UUID, parent document, sequential version number, immutable file reference, SHA-256, size, original filename and MIME. Stores version revision, status, metadata, rights, reviewer/publisher and timestamps, plus lifecycle reason where applicable. `expectedRevision` is required to edit, publish or archive. |
| `metadata` | Required draft fields are `sourceTitle`, `classification` and `locale`. Optional fields include publisher, original language/version, HTTPS source and license URLs, publication/retrieval dates, license type, permission evidence, attribution, change summary and adaptation disclaimer. URL import records the supplied URL and server retrieval timestamp. |
| `rights` | Review status is `NOT_REVIEWED`, `REVIEW_REQUIRED`, `PERMITTED` or `RESTRICTED`. Stores confirmation and use flags for AI, offline distribution and translation, medical review status `NOT_REVIEWED`, `APPROVED` or `REJECTED`, and exact-version evidence. |
| `survival_document_uploads` | Durable reservation links to its version on commit. Compensation removes unlinked reservations and files after failures. Hourly cleanup retries unlinked reservations older than 24 hours with database row locks. |
| `survival_document_outbox` | Records `published_version_changed`, `source_unavailable` and `document_deleted` transactionally. Event identifiers and checksums survive deletion of source rows. Downstream completion has separate tracking. |
| `audit_logs` | Records `survival_document.upload`, `import_url`, `metadata`, `publish`, `supersede`, `archive` and legacy lifecycle migration activity under the feature prefix. Stores actor where applicable, document/version identity, state and revision changes, and reason where supplied. Detailed permission evidence stays with the version. |

Classifications are `NATURAL_HAZARDS`, `TREKKING_SAFETY`, `WEATHER_SAFETY`, `WATER_SAFETY`, `MEDICAL_REFERENCE` and `FIRST_AID`. A locale uses a lowercase two- or three-letter language code with an optional uppercase region, such as `vi`, `en` or `vi-VN`. Date-only provenance uses Vietnam calendar days (`Asia/Ho_Chi_Minh`). The API rejects invalid or future dates and publication dates later than retrieval.

## HTTP contract

Routes use `/api/admin/survival-documents` as the base and require JWT authentication, an active account and the Admin role. List filters are `search`, `classification`, `locale`, `status`, `page` and `limit`. Status, language and classification filter the latest version. The published version number is returned separately.

| Method | Relative path | Payload or result |
| --- | --- | --- |
| GET | Root | `{items,total,page,limit,maxBytes}` |
| POST | Root | Multipart `file` and `metadata` JSON string. Creates a document and draft v1. |
| POST | `/import-url` | JSON `{ sourceUrl, metadata }`. Creates a document and draft v1. |
| GET | `/:id` | Document, versions, audit history and processing signal. |
| DELETE | `/:id?expectedRevision=…` | Permanent document and version deletion. Returns 204 on commit or 409 when a different document references a version. Released PDFs are removed after commit and retried by the cleanup job if necessary. |
| GET | `/:id/versions` | Version history. |
| POST | `/:id/versions` | Multipart upload with `expectedDocumentRevision`. |
| POST | `/:id/versions/import-url` | JSON URL import with `expectedDocumentRevision`. |
| GET | `/:id/versions/:versionId/file` | Admin-only PDF attachment with checksum verification, no-store and nosniff headers. |
| PATCH | `/:id/versions/:versionId/metadata` | `{ expectedRevision, metadata }` with the full updated draft metadata. |
| POST | `/:id/versions/:versionId/publish` | `{ expectedRevision, rights?, reason? }`. The Admin UI sends the revision only. Optional rights supplied by API callers are verified against version metadata. |
| POST | `/:id/versions/:versionId/archive` | `{ expectedRevision, reason }` with a nonblank reason. |

Use the latest revision returned by the API. Invalid metadata, PDF or rights can return HTTP 422, oversized files return HTTP 413, and stale revisions or illegal transitions return HTTP 409 with `SOURCE_CONFLICT`. Duplicate responses use the specific codes in the ingestion table.

Example URL import body with minimum metadata. For a local upload, send the same metadata object serialized as the multipart `metadata` field.

```json
{
  "sourceUrl": "https://example.org/fictional-guide.pdf",
  "metadata": {
    "sourceTitle": "Fictional field guide",
    "classification": "TREKKING_SAFETY",
    "locale": "vi"
  }
}
```

Example API publication with optional verified rights for a fictional non-medical source. Direct Admin publication sends only the latest `expectedRevision`.

```json
{
  "expectedRevision": 2,
  "rights": {
    "rightsReviewStatus": "PERMITTED",
    "sourceReviewConfirmed": true,
    "internalRagUseAllowed": true,
    "offlineRedistributionAllowed": false,
    "translationAllowed": false,
    "medicalContentReviewStatus": "NOT_REVIEWED",
    "evidence": "Owner permission covers private storage and automated processing of this edition."
  }
}
```

## Deployment and verification

Apply the migrations with `pnpm --filter @ctms/api migration:run` before rolling out the API and web changes. Back up the database and private storage together, and use shared private storage across API replicas.

| Migration | Data effect |
| --- | --- |
| [1793600000000](../../services/api/src/migrations/1793600000000-RefactorSurvivalDocumentLifecycle.ts) | Reopens legacy `IN_REVIEW`, `APPROVED` and `REJECTED` versions as drafts and records the previous state in audit history. Preserves prior approved rights for reevaluation and locks use flags for previously rejected versions. Existing publications stay in place. |
| [1793700000000](../../services/api/src/migrations/1793700000000-IndexSurvivalDocumentChecksum.ts) | Adds a checksum lookup index and preserves historical records. |
| [1793800000000](../../services/api/src/migrations/1793800000000-IndexSurvivalDocumentFilename.ts) | Adds a normalized filename lookup index. Existing filenames remain as stored, including names historically decoded with a different character encoding. |
| [1793900000000](../../services/api/src/migrations/1793900000000-SeparateSurvivalPublicationFromUseRights.ts) | Separates publication from recorded use rights. Publication audit fields and validation of permitted rights remain enforced. |
| [1794000000000](../../services/api/src/migrations/1794000000000-AllowSurvivalDocumentDeletion.ts) | Enables document-level cascaded deletion, protects individual versions and keeps audit and outbox history. Restoring the former foreign keys requires resolving historical references to deleted documents first. |

- PostgreSQL integration tests cover the three duplicate outcomes, shared checks across upload and import, Vietnamese filename normalization, concurrent name and checksum conflicts, and migrations with legacy rows. [Integration tests](../../services/api/test/survival-documents.integration-spec.ts)
- HTTP and Chrome tests cover Admin access, the duplicate response, opening the existing version, and creating and publishing an eligible replacement. [HTTP tests](../../services/api/test/survival-documents.e2e-spec.ts) · [Browser tests](../../apps/web/tests/e2e/ctms-50-survival-documents.spec.ts)
- Acquisition unit tests cover request identity, source HTTP failures, compressed PDFs, redirect checks, private network targets, invalid PDF content, timeouts, size limits and filename selection. Structure tests verify unchanged bytes/checksums, CR line endings and rejection of actions hidden inside compressed objects. The integration tests use deterministic PDF bytes for remote acquisition. [PDF acquisition tests](../../services/api/src/modules/survival-documents/pdf-source.service.spec.ts), [PDF structure tests](../../services/api/src/modules/survival-documents/pdf-file-validator.spec.ts).

Manual verification on 2026-11-05 used an authenticated Admin session and an isolated test database. Both [Weather.gov Lightning Brochure](https://www.weather.gov/media/owlie/Lightning-Brochure18.pdf) (2,147,532 bytes) and [NPS Trip Planning Guide](https://www.nps.gov/subjects/healthandsafety/upload/Trip-Planning-Guide-Package-508c.pdf) (2,572,164 bytes) returned HTTP 201 from the import endpoint. Downloading each stored PDF returned HTTP 200 and the same SHA-256 as its stored version. These external URLs are manual smoke checks; automated tests do not depend on their availability.

## Historical source references

The earlier discovery catalog contained the nine supplied entries and five Vietnamese additions. The additions covered the Ministry of Health workplace first-aid training (636/QĐ-BYT, 2025) and disaster disease prevention guidance (237/QĐ-BYT, 2026), HCDC advice on health after flooding, a flash-flood leaflet from the disaster prevention portal, and Ninh Binh Police advice for getting lost in a forest. These files remain historical research material. Each grant for downstream use requires evidence for the exact version. [Supplied references](ctms-50-official-sources.example.json) · [Expanded historical references](../../services/api/src/modules/survival-documents/official-sources.json)

Original policy references include WHO copyright, IFRC's publication copyright page, USGS permissions, the NPS and NWS disclaimers, and CDC agency materials policy. [WHO](https://www.who.int/about/policies/publishing/copyright) · [IFRC](https://www.ifrc.org/sites/default/files/2026-03/IFRC%20International%20First%20Aid%2C%20Resuscitation%20and%20Education%20Guidelines%202025.pdf) · [USGS](https://www.usgs.gov/faqs/are-usgs-reportspublications-copyrighted) · [NPS](https://www.nps.gov/aboutus/disclaimer.htm) · [NWS](https://www.weather.gov/disclaimer) · [CDC](https://www.cdc.gov/other/agencymaterials.html)
