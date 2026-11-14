# CTMS-052 — Create Offline Package for Each Trip

## Download-boundary regression correction - 2026-11-08

The CTMS-053 regression checkpoint fixes optional-feed manifest outcomes: expired or invalid validity, future/invalid checked time, missing source provenance, and unavailable/partial/stale status must remain `UNKNOWN`, including when no selected hazards exist. `NO_ACTIVE_ALERT` requires a current successfully checked EMPTY/AVAILABLE run; EMPTY with no provider expiry retains the existing policy. Freshness is evaluated at build time, not an old durable job's creation timestamp. Generator policy version becomes `ctms052-v2`, so an authorized future regeneration cannot reuse the old v1 generation identity. No stored READY artifact is rewritten and no regeneration is triggered here. Required-source blocking policy is unchanged. Existing optional-expiry regressions and additional current/invalid/future-feed tests provide isolated evidence; source freshness remains separate from ZIP checksum validity.

## Operational baseline amendment - 2026-11-06

Authority: user-approved CTMS-52 baseline v2.0. This amendment supersedes the ambiguous source selection, sensitive-data inclusion, lifecycle and TBD technical sections below; their original BR wording is retained for history. It does not replace BR-230 obligations elsewhere. Current spec IDs are authoritative: publication is CTMS-023, not the baseline's mistaken reference to CTMS-034. No Jira changes have been performed.

### Scope and trigger

052 automatically generates v1 only after Trip `published`, using a durable job written atomically with publication. It snapshots Route geometry, all monitored checkpoints, required Trip waypoints, eligible hazards and complete approved guidance; validates gates; writes immutable ZIP/manifest/digests; stores versioned metadata; exposes internal reads and a trusted idempotent impact request for 119. Existing published Trips receive an idempotent migration backfill. No new Host/Admin form or manual-create public API is required.

Out of scope: PDF UI/processing/embedding, RAG/chatbot, government ingestion/crawler, Camper reporting permissions, Host verification UI/API, field promotion, source-change watcher, weather engine/live broadcasts, mobile download/verification/render/GPS and offline basemap. Related specs contain dependency amendments only.

### Source policy and ownership

| Input | Eligibility | Upstream owner |
| --- | --- | --- |
| GOVERNMENT hazard | Normalized source ID/version/reference, original validFrom/validUntil, active lifecycle, source verification, spatial match and a complete available feed run | 010 / safety ingestion |
| FIELD_VERIFIED hazard | Above provenance plus independent authorized Host decision, decision version/evidence/time and valid expiry; rejected/revoked/unverified excluded | Proposed verification + promotion tasks |
| HOST_DEFINED / FIELD_OBSERVATION / RESOURCE / historical | Not eligible as verified package hazard; preview behavior retained | Existing Route Safety |
| Guidance | Current PUBLISHED version (BR-227) that meets source eligibility (BR-484), active READY chunk set with matching checksum, complete steps/warnings and pages, approved applicability/taxonomy and complete coverage | 050/051 + proposed guidance approval task |

Incident `resolved/closed` never implies Host verification. Official successful EMPTY means NO_ACTIVE_ALERT at checkedAt, not SAFE; unavailable/partial/stale is UNKNOWN/STALE and blocks a required source. No fetchedAt-derived renewal of provider expiry. Policy filters run before any optional retrieval/ranking. No AI similarity or PDF classification is approval. UNKNOWN context is explicit; proximity to water cannot establish river crossing. Baseline/condition/hazard coverage topics and mandatory evidence come from a versioned approved upstream policy, never guessed by the generator.

### Gates and state

G01 published + valid associated route; G02 complete internally consistent monitored checkpoints and required waypoints; G03 required hazard feed availability/validity; G04 eligible current source + active READY set + approved applicability + complete guidance coverage; G05 no personal medical/reporting data in shared payload; G06 coherent source versions revalidated before commit; G07 complete artifact, schema and hashes verified in private storage before READY.

Job lifecycle: PENDING → GENERATING → READY or BLOCKED / RETRYABLE_FAILED / FAILED. Retryable technical/source-race failures use bounded attempts/backoff and fenced renewable leases; business blockers retain machine-readable reasons and await an upstream-approved retry/re-evaluation. No automatic source-impact watcher is included. An initial publication request is idempotent; 119 may request re-evaluation with a stable impact ID. Generation identity includes Trip/core/eligible-source/approval/coverage-policy fingerprints, excluding mutable collection times. Concurrent identical inputs yield at most one artifact version; differing inputs never mix. Failure cannot publish READY. READY artifacts cannot be updated/deleted in place.

### Data and internal contract

PostgreSQL stores durable requests, immutable READY package metadata/manifest/internal source provenance, audit and pending orphan cleanup. Version allocation serializes per Trip; stable generation key is unique per Trip. Reads take a consistent snapshot; final locked revalidation must protect source insert/update/delete as well as individual source versions. No external API calls occur inside transactions. Route's existing GPS geometry version keeps its meaning; packageVersion is a separate positive integer.

Schema 1 ZIP (`application/zip`): `manifest.json`, `route.geojson`, `checkpoints.json`, `waypoints.json`, `hazards.geojson`, `guidance.json`. Manifest identifies Trip/package/schema/generatedAt, exact core/source/policy fingerprints, source freshness, guidance document/chunk/page/approval provenance, and per-payload SHA-256. Whole-ZIP SHA-256 and byte size live outside the ZIP in metadata. Stable serialization/entry ordering/timestamps support deterministic retry. Shared payload uses explicit allowlists and contains no personal medical section; internal verification audit retains necessary evidence while shared payload omits verifier/reporter personal IDs. BR-230 remains unchanged for other medical access/copies.

Exported `OfflinePackagesService` methods provide initial/impact request, job status, latest/exact READY metadata and manifest, and integrity-checked internal artifact access. These are trusted service methods, not public transport; 053 owns participant authorization/download. 119 owns impact detection/publication/outdated/revoked metadata; 053/054/055/057 own client verify/activate/view/warn. Ongoing Trip keeps its activated version; no hot swap. Weather freshness and byte integrity are separate. See [implementation contracts](../../docs/features/CTMS-052-Implementation.md) and [upstream tasks](ctms-52-upstream-safety-contracts.md).

Implemented schema: migration `1794200000000-CreateOfflinePackages` creates `offline_packages` (immutable READY metadata/provenance), `offline_package_jobs`, `offline_package_audit`, and `offline_package_artifact_cleanup`. Its publication trigger queues the initial request atomically and backfills existing published Trips. `getReadyMetadata` returns camelCase `ReadyPackageMetadata` without a private storage key; `getManifest` and `readArtifact` are separate trusted reads. Local storage is persisted through the Compose `offline-package-data` volume. Until core writers have a shared revision protocol, short final SHARE table locks fence core inserts/deletes/updates; the upstream port must separately fence scope revisions. The implementation report records this concurrency tradeoff and the verification limitations. On 2026-11-06 the user supplied terminal evidence of all 14 PostgreSQL integration tests passing, including migration up/down/backfill, concurrency and failure recovery, against the isolated test instance with fictional upstream inputs. This verifies the generator's isolated technical behavior; application-database deployment and real-source end-to-end readiness remain separate acceptance steps.

### Acceptance amendment (BR-212/213)

| AC | Valid/violation scenarios | Required evidence |
| --- | --- | --- |
| 01–04 | Published complete Trip generates; draft/pending or missing/cross-route required data blocks | Unit + PostgreSQL integration |
| 05–09 | Official checked EMPTY preserved; unavailable/partial/stale blocks; explicit valid field decision accepted; resolved/unverified/rejected/revoked/Host-defined excluded | Policy + source contracts |
| 10–11 | Approved applicable complete guidance selected. UNKNOWN, missing coverage, ineligible source, wrong version, or inactive/non-READY set blocks. Forest does not imply diving/crossing. | Policy unit |
| 12–14 | Source change during build aborts; hash mismatch fails; vN+1 preserves vN; retries/concurrent publication create no duplicates | PostgreSQL transaction/concurrency + storage |
| 15 | No medical data, raw reporter IDs or arbitrary Trip metadata in shared artifact; existing consent obligations retained | Privacy projection test |
| 16 | Trigger rollback, restart/lease recovery, bounded retry, storage/commit failure, stable archive/manifest | Integration + focused regression checkpoint |

Production is BLOCKED until authoritative normalized feed, approved complete guidance and approved coverage policy are implemented upstream. Test fixtures do not establish production READY. No business-critical dependency is concealed by a mock.

## 1. Overview

Story: CTMS-052

Epic: EPIC 8. Offline Package

Use Case: Create Offline Package for Each Trip

Priority: Must Have

Goal: Build a versioned Offline Safety Package for a published Trip containing the authoritative data required for offline operation.

## 2. Scope

### In Scope
- Package generation.
- Route geometry/version.
- Checkpoints.
- Hazard areas.
- Required Trip waypoints.
- Safety guidance.
- Package metadata/version/checksum.
- Sensitive-data consent handling.

### Out of Scope
- Package download — CTMS-053.
- Integrity verification on device — CTMS-054.
- Offline rendering — CTMS-055.
- GPS tracking.

## 3. Actors & Authorization

- System.
- Authorized Trip context.

## 4. Preconditions & Dependencies

Trip must be `published`.

Required Route/Trip/safety sources must exist.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-229 | An Offline Safety Package may be generated only for a published Trip and must contain, at minimum, Route geometry/version, checkpoints, route_hazard_areas, required Trip waypoints, safety instructions/guidance, and sufficient metadata/checksum/version information for the client to identify the exact safety dataset in use.                                                 |
| BR-230 | When sharing_consent is withdrawn, the server must immediately terminate access to medical data. Any downloaded Offline Safety Package containing medical data must be marked invalid/outdated for the sensitive portion; at the next sync/connectivity opportunity, the client must purge or lock that medical data and must no longer treat the local copy as authorized for use. |
| BR-365 | An Offline Safety Package used for safety must contain all data needed for local detection within the enabled feature scope, including at minimum the applicable Route geometry, monitored Checkpoints, required hazard/safety metadata, and package metadata/version. The client must not depend on the server to read this data while offline.                                    |
| BR-428 | Package generation must accurately snapshot or reference the versions of all required authoritative inputs. Storing only a generic package version is insufficient if it does not allow the exact Route, Checkpoint, and hazard state included in the package to be identified for audit.                                                                                           |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                               |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                        |

## 6. State & Lifecycle

Published Trip
→ package generation
→ package version available.

A later authoritative safety-source change may make a downloaded package outdated.

Important V3 invariant:

- Trip already started continues using the package version activated at Start Trip.
- Trip not started must load/validate/activate the required newer version according to version policy.

## 7. Business Flow

1. Verify Trip is published.
2. Resolve authoritative Route/version.
3. Load checkpoints.
4. Load hazard areas.
5. Load required Trip waypoints.
6. Load approved safety/survival guidance.
7. Include only sensitive data currently permitted.
8. Generate package version and metadata.
9. Generate checksum.
10. Persist/package artifact.
11. Make package available for authorized download.

## 8. Data & Invariants

Package identifies:
- Trip;
- Route/version;
- package version;
- required safety data;
- checksum;
- generation/update metadata.

A package must identify exactly which safety dataset it represents.

Sensitive information cannot remain authorized merely because it was downloaded earlier.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case | Expected |
| --- | --- |
| Trip not published | Do not generate package. |
| Route version missing | Fail generation. |
| Required safety data incomplete | Do not falsely mark complete. |
| Consent revoked | Sensitive section becomes invalid/outdated. |
| New version after Trip started | Do not hot-update active ongoing Trip package. |

## 11. Acceptance & Test Matrix

| Scenario | Expected |
| --- | --- |
| Published Trip | Package can be generated |
| Non-published Trip | Rejected |
| Inspect package | Required safety components present |
| Check metadata | Version/checksum present |
| Consent revoked | Sensitive data invalidated |
| Started Trip on v5, v6 released | Trip remains on activated v5 |
| Not-started Trip requires v6 | Must validate/activate v6 |

## 12. Open Decisions

Physical package format, compression and storage mechanism belong to Technical Design.

## 2026-11-10 — Automatic core and raster preparation (CTMS-307 integration)

Publication already inserts the initial durable job via the database trigger in
`1794200000000-CreateOfflinePackages`; this is atomic with the Trip transaction.
Core READY still requires authoritative approved safety inputs. The current
`UnavailableOfflineSafetySources` adapter blocks production generation; fixture
packages do not prove that this upstream integration is implemented.

Each newly committed immutable core package now enqueues one independent raster
job. The migration backfills existing packages. The dedicated worker derives the
region from the verified package route, renders raw OSM ways into MBTiles and
binds a verified content-addressed artifact to the exact package identity. Core
readiness and raster readiness are separate states. Raster errors do not mutate
the core package; attempts are persisted and capped at three. Existing package
files and ongoing-trip activated versions are not overwritten.

Operational contract and limitations: [CTMS-307 backend integration](../../docs/features/CTMS-307-Offline-Basemap-Backend.md).
