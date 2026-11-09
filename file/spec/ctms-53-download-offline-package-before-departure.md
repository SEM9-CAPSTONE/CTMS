# CTMS-053 — Download Offline Package Before Departure

## CTMS-052 archive handoff — 2026-11-06

Consume READY metadata (`tripId`, `packageVersion`, `schemaVersion: 1`, `sizeBytes`, `sha256`, `generatedAt`) and the manifest through an authorized downstream server boundary. The artifact is ZIP (`application/zip`) with manifest.json, route.geojson, checkpoints.json, waypoints.json, hazards.geojson and guidance.json. SHA-256 of the whole artifact is external metadata; each payload has an internal digest. 053 owns participant authorization and private byte transport/resume; mobile ZIP decoding is part of the CTMS-054 verification boundary; 052 exposes no public download or manual-create API. Shared schema 1 contains no personal medical section, without weakening BR-230 elsewhere. Activate a verified replacement before removing the old version; an ongoing Trip keeps its locked version. Acceptance: BLOCKED/FAILED cannot download as complete, wrong Trip/schema rejected, size/digest used for verification, existing consent invalidation preserved.

## 1. Overview

Story: CTMS-053

Epic: EPIC 8. Offline Package

Use Case: Download Offline Package Before Departure

Priority: Must Have

Goal: Allow an eligible Trip participant to reliably download the required Offline Safety Package before departure.

## 2. Scope

### In Scope

- Package download.
- Package size.
- Download progress.
- Storage check.
- Resume interrupted download.
- Package/version context.
- Sensitive-data invalidation.

### Out of Scope

- Package generation.
- Checksum validation logic — CTMS-054.
- Offline rendering.

## 3. Actors & Authorization

- Camper with valid Trip participation.
- Porter with valid Assignment where applicable.
- System.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-052.

Package exists for the Trip.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-231     | When downloading an offline package, the UI must show package size and download progress, support resume after interruption, and verify that the device has sufficient storage before completion.                                                                                                                                                                                   |
| BR-230     | When sharing_consent is withdrawn, the server must immediately terminate access to medical data. Any downloaded Offline Safety Package containing medical data must be marked invalid/outdated for the sensitive portion; at the next sync/connectivity opportunity, the client must purge or lock that medical data and must no longer treat the local copy as authorized for use. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                               |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                        |

## 6. State & Lifecycle

Not downloaded
→ downloading
→ downloaded
→ integrity validation handled by CTMS-054.

Interrupted:
downloading → interrupted → resumed.

Insufficient storage must not become completed.

## 7. Business Flow

1. User opens Offline Package action.
2. Verify Trip/package access.
3. Fetch package metadata and size.
4. Check available device storage.
5. Begin download.
6. Display progress.
7. Persist resumable download state.
8. Resume after recoverable interruption.
9. Complete byte transfer.
10. Pass package to integrity verification.

## 8. Data & Invariants

- UI shows package size.
- UI shows progress.
- Download supports resume.
- Storage sufficiency checked.
- Download completion alone does not prove package integrity.
- Package remains associated with correct Trip/version.

## 9. API / Integration Contract

### CTMS-222 implementation contract - 2026-11-08

CTMS-222 implements business story CTMS-053. It consumes the immutable READY artifact from CTMS-052; it neither requests generation nor verifies or activates a local safety dataset. The client transports an opaque ZIP. A ZIP decoder belongs with the CTMS-054 archive verification boundary and is not required for byte transfer.

All endpoints are under `/api`, require the existing JWT guard and Camper/Porter role guard, and independently query current participation. Host/Admin roles alone grant no download bypass. A missing Trip or denied participation returns the same 404.

| Method/path | Result |
| --- | --- |
| `GET /trips/:tripId/offline-packages/latest` | Latest committed READY metadata |
| `GET /trips/:tripId/offline-packages/:version` | Exact immutable version metadata for resume |
| `GET /trips/:tripId/offline-packages/:version/download` | Private ZIP bytes, with optional single `Range` and strong `If-Range` |

Authorization uses a published or ongoing Trip and either (1) a `booking_members.user_id` linked to the caller on a `confirmed` Booking, with member status `registered`/`joined` and no `left_at`, or (2) an `assigned` row in the current `trip_porters` source. Booking ownership alone, anonymous members, removed/left/no-show members, pending/cancelled/expired/completed Bookings and pending/unassigned Porters do not grant access. Completed/cancelled/unpublished Trips cannot download. Ongoing access supports transfer recovery only; no activation or change to an ongoing Trip's locked version occurs here. The legacy Porter source must be replaced by the authoritative Assignment source when CTMS-047 provides it.

Metadata contains `id`, `tripId`, positive integer `packageVersion`, `schemaVersion: 1`, `sizeBytes`, lowercase whole-ZIP `sha256`, `generatedAt`, `contentType: application/zip`, and strong `etag: "<sha256>"`. CTMS-223 adds `activationAllowed`, true for a published Trip and false for an ongoing Trip at the time of the authorized metadata read. This field does not change artifact identity or byte access. Storage paths, generation keys, job data and internal provenance are excluded. Only committed rows from the READY artifact store are exposed; BLOCKED/FAILED jobs do not constitute an artifact. Missing READY metadata returns `409 PACKAGE_NOT_READY`; unsupported metadata returns `409 PACKAGE_UNSUPPORTED`; invalid/missing storage bytes return `503 PACKAGE_ARTIFACT_UNAVAILABLE`.

| Byte response | Contract |
| --- | --- |
| 200 | Full ZIP, exact `Content-Length`, strong `ETag` |
| 206 | One satisfiable open/closed/suffix byte range, exact `Content-Range` and `Content-Length` |
| 416 | Unsupported/malformed/multiple/unsatisfiable range, `Content-Range: bytes */<size>`, empty body |
| If-Range mismatch/weak tag/date | Restart as full 200; never concatenate a different representation |

Byte responses use `Cache-Control: private, no-store, no-transform`, `Accept-Ranges: bytes`, attachment disposition, and `X-Content-Type-Options: nosniff`. Metadata responses are private/no-store. Every byte/resume request is authorized, including a 416; access is checked again after reading/verifying private bytes and before returning the body. Current CTMS-052 storage reads/verifies a bounded buffer (maximum 20 MiB) on the server. This is not an unbounded artifact streaming implementation.

### Device data dictionary and lifecycle

Files live under the app's private application-support directory, scoped by authenticated user ID. An immutable identity key includes `tripId`, `packageVersion`, package `id` and `sha256`; metadata also pins `sizeBytes`. A JSON journal stores that metadata, `status` and `downloadedBytes`; `.part` stores partial bytes; `.zip` denotes a finished transfer. No medical section is introduced and the existing separate consent invalidation behavior remains in force (BR-230).

| Local field/status | Meaning |
| --- | --- |
| No record | Not downloaded |
| `downloading` | Transfer in progress; journal checkpoint after each 256 KiB of flushed data |
| `interrupted` | Retriable/paused transfer; resume offset is actual `.part` length, never the stored counter |
| `downloaded` | Byte count matches metadata and `.part` was renamed to `.zip`; not verified/active/usable |
| `package` | Exact Trip/version/ID/digest/size/schema/type/generation timestamp |
| `downloadedBytes` | Persisted progress hint; actual filesystem length is authoritative after restart |

Before starting/resuming, re-fetch metadata for the exact version and reject identity/size changes. Check free storage for remaining bytes plus a 4 MiB reserve using the Android/iOS platform channel `ctms/offline_package_storage`; unavailable capacity information fails closed. Check capacity again before completion. Disk/write failures preserve available partial bytes and cannot yield completion.

Send `Range: bytes=<actual offset>-` and `If-Range` on resume. Validate ETag, content type, response length and Content-Range before writing. If the server returns 200 to a resume, check space for a full replacement and truncate/restart. Reject short/overlong/wrong-identity responses. A full `.part` recovered from a crash is re-authorized at the byte endpoint (416 is accepted only at the exact known total) before completion. A crash after rename is recovered from the exact-size `.zip`. This proves transfer completion only; CTMS-054 must still independently validate SHA-256, archive identity, schema and contents before use.

Repeated starts are serialized by account/artifact identity within the app process. Pause/navigation/logout cancels the current transfer; after restart the UI offers Continue. A connectivity restoration event can retry a transfer interrupted by a network failure. Manual pause does not auto-resume. Older downloads remain separate while a newer version is transferred; CTMS-053 never deletes or activates them.

The Camper Trip detail overview and Trip sync screen expose size, version, transferred bytes, percentage, pause/continue/retry and errors. The Porter schedule links to the same flow when the existing schedule supplies a Trip ID. The completion label explicitly says the download is not yet verified. Offline basemap tiles and offline rendering remain outside this task.

## 10. Error & Edge Cases

| Case                   | Expected                                     |
| ---------------------- | -------------------------------------------- |
| Insufficient storage   | Warn/fail before valid completion            |
| Connection interrupted | Preserve resumable state                     |
| App restarted          | Resume where supported                       |
| Access revoked         | Reject further authorized download           |
| Consent revoked        | Sensitive content must not remain authorized |

## 11. Acceptance & Test Matrix

| Scenario             | Expected                                            |
| -------------------- | --------------------------------------------------- |
| Normal download      | Progress displayed                                  |
| Large package        | Size displayed                                      |
| Insufficient storage | Completion prevented                                |
| Network interruption | Resume supported                                    |
| Retry                | No unrelated duplicate package state                |
| Consent revoked      | Sensitive content purged/locked according to BR-230 |

## 12. Open Decisions

The partial-download protocol and storage margin are fixed by section 9. Free-space checks are advisory; filesystem errors remain authoritative, and OS-level byte reservation/background download services are not implemented. Android/iOS are the capacity-check targets. Native platform smoke tests, HTTP E2E and real PostgreSQL authorization tests remain required release evidence; a simulated READY artifact does not make the upstream safety pipeline production-ready.

## 13. Implementation test mapping (BR-212/213)

| Rule/acceptance | Valid and violation evidence |
| --- | --- |
| BR-231 / AC1-2 | Mobile panel tests: size/version/progress; completed transfer remains explicitly unverified |
| BR-231 / AC3 | Transfer tests: interruption/restart, actual offset, pause, 206 resume, full-200 fallback, malformed headers and concurrent retry rejection |
| BR-231 / AC4 | Transfer tests: capacity before transfer and completion, full-200 replacement capacity, no ZIP completion on short/overlong responses |
| AC5 / exact identity | Transfer tests: changed digest rejection, account/Trip separation, v2 retains v1; server policy tests reject wrong Trip/schema/version/size/digest |
| Current access | HTTP tests use production JWT/role guards; PostgreSQL tests cover actual membership/assignment statuses, Trip scope and revocation on resume |
| BR-230 | Shared schema 1 has no medical content; existing offline-medical consent tests remain applicable and no medical-store behavior is changed |
| BR-212 | Section 9 defines endpoint, status, local data and downstream handoff contracts |

Test sources: `apps/mobile/test/features/offline_packages/`, `services/api/src/modules/offline-package-download/offline-package-download.service.spec.ts`, `services/api/test/offline-package-download.e2e-spec.ts`, and `services/api/test/offline-package-access.integration-spec.ts`. Tests with fake transport/upstream data establish isolated behavior only; record runtime/environment blockers separately from passing tests.

User local verification on 2026-11-08: HTTP transport/JWT suite **38/38 PASS**, Flutter transfer/retry/widget suite **29/29 PASS**, and PostgreSQL authorization suite **19/19 PASS** on a fresh, separate test container. PostgreSQL tests use fixture tables and the production access repository; the HTTP suite mocks participation and upstream artifacts. Native Android/iOS storage and lifecycle acceptance and the complete upstream package pipeline still require verification. The original PostgreSQL server's catalog/index error remains unresolved; see `docs/features/CTMS-053-Implementation.md` for the evidence and environment boundaries.
