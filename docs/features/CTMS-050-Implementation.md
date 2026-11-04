# CTMS-050 implementation and provisional data dictionary

These technical decisions fill gaps in the source specification and require project review; they are not claimed as previously approved product enums. Source rights are manually verified for the exact uploaded work. No remote content is fetched.

| Acceptance criterion | Implementation | Verification |
| --- | --- | --- |
| AC1 authorized upload | Admin controller, private filesystem, durable upload reservations | HTTP authorization/upload/failure tests |
| AC2 classification/review | Validated provenance, draft metadata edit, evidence-based review | DTO, lifecycle and UI tests |
| AC3 downstream eligibility | Published-only service contract, independent AI/offline/translation gates | Integration negative-state/rights tests |
| AC4 immutable history | Stable document, monotonic versions, checksums, DB immutability trigger | Concurrent allocation/publication and SQL mutation tests |
| AC5 validation/failure | JWT/roles, revision tokens, file validation and compensating cleanup | Unit, HTTP and browser tests |

## Data dictionary / decisions

- PDF only, MIME `application/pdf`, `%PDF-1.x` or `%PDF-2.0` header and EOF marker; no encrypted PDFs, active scripts, launch actions, embedded attachments or XFA. This conservative byte screening is not an antivirus/content-parser guarantee. No OCR or parsing. Configurable `SURVIVAL_DOCUMENT_MAX_BYTES`, default 10485760, maximum 52428800.
- Storage: `SURVIVAL_DOCUMENT_STORAGE_ROOT`, default `.private-survival-documents` under API working directory; must be outside the public upload root. Persist this private volume in deployments; never mount it as public static content.
- `survival_documents`: stable UUID, integer revision, monotonically increasing version count, nullable current published UUID, creator/timestamps. `expectedDocumentRevision` required when allocating another version.
- `survival_document_versions`: UUID, parent document, unique positive version number, immutable file reference/SHA-256/size/name, provenance JSON, rights JSON, status/revision, review actor/time, publication actor/time, rejection/archive reason. No hard-delete endpoint. File identity is immutable from creation; provenance and rights freeze on approval and on rejection. Lifecycle status can advance without rewriting provenance.
- Lifecycle: `DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED -> SUPERSEDED`; review may instead end in `REJECTED`. Stop-use: `PUBLISHED -> ARCHIVED` with reason. Rejected and archived versions remain readable by Admin. A new draft preserves the current publication. `expectedRevision` required for edits and lifecycle actions; stale/illegal operations return 409.
- Classification: `NATURAL_HAZARDS | TREKKING_SAFETY | WEATHER_SAFETY | WATER_SAFETY | MEDICAL_REFERENCE | FIRST_AID`. Locale uses a lowercase two/three-letter language code with optional uppercase two-letter region, for example `vi`, `en`, `vi-VN`. Catalog language `multi` is discovery metadata and cannot be saved as a document locale.
- Rights: `NOT_REVIEWED | REVIEW_REQUIRED | PERMITTED | RESTRICTED`; separate `internalRagUseAllowed`, `offlineRedistributionAllowed`, `translationAllowed`, `sourceReviewConfirmed`, medical status `NOT_REVIEWED | APPROVED | REJECTED`. All permissions default false. Approval requires source confirmation, PERMITTED, exact-work evidence and AI/storage permission. FIRST_AID/MEDICAL_REFERENCE also require medical APPROVED. Translation requires an existing original-version ID, original locale, disclaimer and translation permission. Academic context alone never grants rights. Admin can be uploader and reviewer.
- Provenance: sourceTitle, publisher, optional HTTPS sourceUrl/licenseUrl, locale, originalLocale, classification, optional sourcePublishedAt, retrievedAt, licenseType, permissionEvidence, changeSummary, attribution, optional originalVersionId and adaptationDisclaimer. Credentials and local/private host URLs are rejected; URLs are never fetched.
- Date-only provenance uses Vietnam calendar days (`Asia/Ho_Chi_Minh`), including the hours before UTC midnight. ISO timestamps retain their explicit timezone/instant. Invalid calendar dates, future retrieval dates and publication after retrieval are rejected.
- `survival_document_outbox`: durable version publication/stop-use event, previous/new version identity and checksum, created in the same transaction as publication. This means regeneration is required, never READY. Consumer delivery/ack and chunk/package generation belong to CTMS-051/052.
- Event types are `published_version_changed | source_unavailable`; derived processing signals are `REGENERATION_NEEDED | NOT_PROCESSED`. Neither means chunks, embeddings or packages exist.
- `survival_document_uploads`: reservation allocated before filesystem I/O and linked on commit. Compensation removes failed uploads; hourly cleanup retries unlinked reservations older than 24 hours under database row locks. Retained files are never removed. A failed write/DB commit cannot publish a version.
- Existing `audit_logs`: action `survival_document.*`, actor, entity ID, version ID, before/after status/revision, reason. Do not log file bytes, storage keys or permission evidence text.
- Audit suffixes: `upload`, `metadata`, `submit`, `review`, `publish`, `supersede`, `archive`. Detailed permission evidence remains in the immutable reviewed version, not the general audit log.

## Integration contract

All HTTP routes are under `/api/admin/survival-documents`, use existing JWT + Admin role guards and active-account verification. GET list accepts `search`, `classification`, `locale`, `status`, `page`, `limit`. GET `/:id` includes all versions and document audit history; GET `/:id/versions` returns history. POST root and `/:id/versions` are multipart `file` plus `metadata` (JSON string); replacement also requires `expectedDocumentRevision`. PATCH `/:id/versions/:versionId/metadata` takes `{ expectedRevision, metadata }`. POST suffixes `submit`, `review`, `publish`, `archive` take a revision token; review adds `decision`, `reason`, `rights`; archive requires reason. GET suffix `file` returns authenticated attachment bytes with no-store/nosniff headers. Errors use `{ code, message }` where domain-specific; normal Nest validation/authorization response conventions remain.

`SurvivalSourceReader.readPublished(versionId, use)` is an exported in-process downstream boundary, with use `AI | OFFLINE | TRANSLATION`. It revalidates current publication + rights and verifies checksum, returning an exact-version manifest and private bytes. It has no public/internal unauthenticated HTTP route and exposes no storage key. `resolvePublishedProvenance(versionId)` resolves citations for previously published versions, including superseded/archived ones, with `historicalOnly: true`, current publication status and no file bytes/storage reference. Never-published drafts/approved/rejected submissions cannot use this historical contract. Archived/superseded versions remain resolvable in Admin history, but are ineligible for new processing. Consumers must revalidate before committing generated outputs and record version ID/hash/locale. No downstream freshness is changed automatically.

The reference catalog is copied from the supplied JSON as link-only data: all entries NOT_REVIEWED with false permission flags. Safe external links and form prefill only; no remote download or automatic clearance.

Original content/policy links are maintained in the [supplied reference catalog](ctms-50-official-sources.example.json), including [WHO copyright](https://www.who.int/about/policies/publishing/copyright), [IFRC's specific publication and copyright page 2](https://www.ifrc.org/sites/default/files/2026-03/IFRC%20International%20First%20Aid%2C%20Resuscitation%20and%20Education%20Guidelines%202025.pdf), [USGS permissions](https://www.usgs.gov/faqs/are-usgs-reportspublications-copyrighted), [NPS disclaimer](https://home.nps.gov/aboutus/disclaimer.htm), [NWS disclaimer](https://www.weather.gov/disclaimer) and [CDC agency materials policy](https://www.cdc.gov/other/agencymaterials.html). The two Vietnamese discovery entries have no blanket rights-policy URL and require document-specific evidence.

## Run and deployment

Run `pnpm --filter @ctms/api migration:run`, then restart API/web. Startup also follows existing `migrationsRun: true`. Back up database and private storage together. Run migrations once before starting multiple API replicas; use a shared private volume across replicas. No destructive seeds are needed. Keep user-provided briefing/catalog inputs intact.

Test results and exact commands are recorded in `CTMS-050-Validation.md` after execution.

## Admin walkthrough

Open `/admin/survival-documents` using an active Admin account. Add a PDF and provenance, or choose a reference to prefill title/publisher/URL/classification. Reference selection has no ingestion or legal effect. The upload creates a private draft. Open its details to inspect the original, edit draft metadata and submit for review. Record the exact-work evidence and separate permissions, including medical review for first-aid/medical categories. Approve, then explicitly publish. A replacement is another upload with fresh unreviewed permissions; the prior publication stays current until the replacement is published. Inspect either version through history. Stop-use requires a reason and retains the original file/provenance.

## Exact request examples

The endpoints return typed direct objects, following the existing Admin modules rather than introducing a new response envelope. Every document response includes `revision`, `versionCount`, and `currentPublishedVersionId`; every version includes its own `revision`, immutable identity/hash and rights/reviewer metadata. List status/locale/category filters apply to the latest version, while the published version number is supplied independently.

POST `/api/admin/survival-documents`: multipart `file` (Admin-supplied PDF) and `metadata` containing this JSON string:

```json
{
  "sourceTitle": "Fictional academic source",
  "publisher": "Fictional education publisher",
  "sourceUrl": "https://example.org/source",
  "classification": "TREKKING_SAFETY",
  "locale": "vi",
  "originalLocale": "vi",
  "retrievedAt": "2026-11-04",
  "licenseType": "Written permission",
  "licenseUrl": "https://example.org/permission",
  "permissionEvidence": "Exact-work permission record supplied by the owner",
  "attribution": "Fictional author, title and year",
  "changeSummary": "First academic edition"
}
```

Replacement upload uses the same multipart fields plus `expectedDocumentRevision`. Draft metadata PATCH uses `{ "expectedRevision": 1, "metadata": { ...complete metadata... } }`. Submit and publish use `{ "expectedRevision": 1 }` with the latest version revision, not a hardcoded value.

Review request:

```json
{
  "expectedRevision": 2,
  "decision": "approve",
  "reason": "Reviewed this exact edition",
  "rights": {
    "rightsReviewStatus": "PERMITTED",
    "sourceReviewConfirmed": true,
    "internalRagUseAllowed": true,
    "offlineRedistributionAllowed": false,
    "translationAllowed": false,
    "medicalContentReviewStatus": "NOT_REVIEWED",
    "evidence": "Owner permission covers copying, private storage and internal automated processing"
  }
}
```

This example concerns a fictional non-medical source. Actual source rights must be reviewed; the server does not infer them from these notes, source domains or academic purpose. A rejection uses `decision: "reject"`, a nonblank reason and review evidence. Archive uses the current revision and a nonblank reason. Rights/source metadata cannot be edited after approval; start another version instead.

| Method | Relative endpoint | Payload / result |
| --- | --- | --- |
| GET | `/references` | Nine unreviewed link-only candidates + configured size limit |
| GET | root | Paginated `{items,total,page,limit}` with published version number |
| POST | root | Multipart upload; document and draft v1 |
| GET | `/:id` | Document, complete versions, audit history and regeneration signal |
| GET | `/:id/versions` | Ordered exact-version history |
| POST | `/:id/versions` | Multipart replacement + document revision |
| GET | `/:id/versions/:versionId/file` | Admin-only no-store attachment; checksum verified |
| PATCH | `/:id/versions/:versionId/metadata` | Complete draft provenance + version revision |
| POST | `/:id/versions/:versionId/submit` | Version revision |
| POST | `/:id/versions/:versionId/review` | Evidence, decision, independent permissions, version revision |
| POST | `/:id/versions/:versionId/publish` | Version revision; atomic pointer, audit and durable event |
| POST | `/:id/versions/:versionId/archive` | Version revision + reason; stop-use event |

## Limitations requiring project review

The provisional formats, size limit, lifecycle, classification and mandatory medical review need product acceptance. Rights checks record evidence-based human decisions; they do not offer a legal opinion or automatic publisher verification. The PDF gate conservatively rejects object streams, encryption and active-content markers (including escaped PDF names), but is not a general PDF security parser or malware scanner. Production environments requiring broader PDF compatibility or stronger scanning should add a separately reviewed scanner. Private storage must be backed up and shared across API replicas. Downstream event consumption, completion acknowledgements and generated artifacts remain CTMS-051/052 responsibilities.
