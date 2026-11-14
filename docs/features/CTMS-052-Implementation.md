# CTMS-052 — Offline Safety Package

Update, 2026-11-08: the CTMS-053 regression checkpoint fixed the optional-feed P1 described in the historical assessment below. Expired/invalid optional source evidence now remains UNKNOWN, with policy version `ctms052-v2` preventing future regeneration from reusing the old policy's identity. The focused generator/download/auth run passes **87/87 tests**; current/invalid/future feed cases and legacy generation-identity separation are covered. No stored READY artifact was rewritten. Real database/network/native release evidence remains outstanding; see [CTMS-053 verification](CTMS-053-Implementation.md). The 2026-11-06 assessment below is retained as historical evidence.

Latest assessment, 2026-11-06: **NOT COMPLETE** — see [Final Technical Review](sandbox:/D:/Capstone/CTMS/docs/features/CTMS-052-Final-Technical-Review.md). The user's earlier **14/14 integration PASS** and the 40 unit tests remain valid historical evidence. A final source review added two previously uncovered optional-feed freshness cases; both fail (`UNKNOWN` expected, `NO_ACTIVE_ALERT` actual). Current focused results are **188 passed / 2 failed / 190 total**. PostgreSQL rerun and the new worker E2E both stop at `EACCES 127.0.0.1:55451`; they are not marked PASS. A complete local fixture ZIP and its independent actual-file SHA-256 do pass. Under the user's independent-scope acceptance criteria, missing real upstream/downstream implementations can remain separate tasks; the present blocker is the generator's P1 freshness defect plus outstanding execution evidence.

## Gap analysis and ownership

| Business requirement | Existing implementation | Missing | Owner story | Change needed | Test required |
| --- | --- | --- | --- | --- | --- |
| Published Trip automatically requests v1 | `trips/services/trips.service.ts` reviews and publishes transactionally | Durable package request | 052 integrating 023 | Transactional publication trigger/backfill and worker | Rollback, duplicate event, non-published Trip |
| Exact route, checkpoints, waypoints | PostGIS route/checkpoint/Trip waypoint tables; GPS geometry fingerprint | Consistent immutable package snapshot | 052 | Explicit projection, fingerprints, source revalidation | Sparse data, cross-route reference, concurrent edit |
| Official hazards with source validity | Route Safety preview collects NCHMF/VNDMS live; imports store features | Durable normalized snapshot with complete provider-run availability, version and validity evidence | 010 / upstream safety feed | Implement source adapter after upstream contract exists | EMPTY vs unavailable/partial/stale; spatial matching |
| Verified field hazards | Incidents have operational statuses; Route Safety emits FIELD_OBSERVATION/UNVERIFIED | Independent Host verification and promoted source | Proposed Host Verify Field Hazard Report + Promote Verified Field Report to Safety Source | Separate tasks; **no upstream code in 052** | Resolved is not verified; reject/revoke/expiry |
| Reporter scope | 049 assigned Porter; 086 existing Host management | Camper reporting permission, if desired | Proposed extension of 049 | Approved permission task; no permissions added | Existing reporting authorization regression |
| Approved complete guidance | 050 current eligible source and 051 active READY chunks with PDF locations | Admin-approved complete GuidanceUnit, applicability, taxonomy and coverage policy | Proposed Approve Safety Guidance Applicability (050/051 integration) | Expose versioned approved read contract | Source eligibility, active pointer, applicability, UNKNOWN, coverage |
| Immutable, idempotent artifact | No package generator or client package decoder | Module, ZIP, private storage, metadata, queue | 052 | Implement here | Hash, retries, concurrent workers, rollback, recovery |
| Source-change impact and vN+1 | 119 spec | Watcher and publication policy | 119 | Consume generator internal impact request | No weather polling churn; immutable prior version |
| Download/verify/render/warnings | Mobile GPS/sync references packageVersion; no package archive dependency | Client package implementation | 053/054/055/057 | Consume schema 1 and SHA-256; keep ongoing lock | Airplane mode, failed integrity, freshness |
| Hotspot analytics | 116/117/118 specify GPS candidate review | Separate pipeline | 116/117/118 | Clarify no incident verification shortcut | CONFIRMED hotspot cannot verify a report |
| Medical consent | Existing mobile medical store and sync invalidation | No medical data needed in shared artifact | 052 + existing consent consumers | Explicit field allowlist; retain BR-230 | Personal fields excluded/rejected |

## Upstream blockers

The production `OfflineSafetySources` binding deliberately reports `HAZARD_FEED_UNAVAILABLE`, `GUIDANCE_APPROVAL_UNAVAILABLE`, and `GUIDANCE_POLICY_UNAVAILABLE`. Route Safety's interactive preview is not a durable source version: stored feature absence cannot establish a successfully checked empty official feed. Its 500-feature bound/partial coverage also cannot silently become complete package coverage. Existing PDF publication/READY embeddings do not approve guidance applicability. There is no authoritative field-verification decision. None is inferred or fabricated.

Consequently production jobs can demonstrate publication, claiming, gates and visible `BLOCKED` reasons, but cannot produce real `READY` packages until the upstream owners implement the port. Tests replace the port with clearly fictional versioned sources. Test success is not end-to-end business readiness.

## Spec changes

052 retains BR-229/230/365/428/212/213 and their history. The 2026-11-06 amendment replaces the ambiguous interpretation of `route_hazard_areas` as every Host zone with an eligible normalized source snapshot, and replaces optional personal-medical inclusion with a shared artifact that excludes personal medical data. BR-230 continues to govern other existing copies and access paths.

Cross-story amendments add dependencies only: 010/Route Safety normalized source boundary; 049 permission gap; 086 proposed independent verification task; 050/051 proposed guidance approval task; 116–118 distinction from report verification; 119 impact triggers; 053/054/055/057 archive/integrity/freshness. Existing write permissions and incident lifecycle are retained. See `file/spec/ctms-52-upstream-safety-contracts.md` for proposed tasks and their acceptance criteria.

## Architecture and handoff

Implementation details, commands and verified results are recorded below as the module is completed. The generator is internal; 052 does not introduce a public/manual-create/download endpoint. The exported service exposes metadata/manifest reads for authorized downstream services (053 owns participant authorization and transport) and an idempotent impact-request entry point for trusted 119 code. Neither `routeVersion` nor GPS algorithms change.

## Implementation delivered in this workspace

| File | Responsibility |
| --- | --- |
| [offline-packages.module.ts](../../services/api/src/modules/offline-packages/offline-packages.module.ts) | Nest bindings, production unavailable-source adapter and exported service; registered in AppModule |
| [offline-packages.types.ts](../../services/api/src/modules/offline-packages/offline-packages.types.ts) | Versioned source contracts, policy, context, state and reason codes, manifest and transport metadata |
| [package-core.reader.ts](../../services/api/src/modules/offline-packages/package-core.reader.ts) | Three explicit PostGIS projections; all Route checkpoints and Trip waypoints; bounded lists; no personal/itinerary JSON |
| [package-policy.ts](../../services/api/src/modules/offline-packages/package-policy.ts) | Context evidence, eligible hazard policy, approved complete guidance selection, gates, canonical SHA-256 identities |
| [package-artifact.builder.ts](../../services/api/src/modules/offline-packages/package-artifact.builder.ts) | Explicit privacy projections, deterministic six-entry ZIP and per-payload digest verification |
| [package-artifact.storage.ts](../../services/api/src/modules/offline-packages/package-artifact.storage.ts) | Private local storage, exclusive no-replace copies, size/hash checks, bounded collision wait, staging cleanup |
| [offline-packages.repository.ts](../../services/api/src/modules/offline-packages/offline-packages.repository.ts) | Idempotent requests, SKIP LOCKED claiming, fenced renewable leases, bounded backoff, audit, trusted reads |
| [offline-packages.service.ts](../../services/api/src/modules/offline-packages/offline-packages.service.ts) | Consistent snapshot, artifact build, final locked revalidation, version allocation, atomic metadata/job READY commit and orphan cleanup |
| [offline-packages.worker.ts](../../services/api/src/modules/offline-packages/offline-packages.worker.ts) | One active job per process, heartbeat, non-overlapping polling, graceful draining and structured operational logs |
| [1794200000000-CreateOfflinePackages.ts](../../services/api/src/migrations/1794200000000-CreateOfflinePackages.ts) | Four tables, immutable-package guard, transactional Trip publication trigger and published-Trip backfill |
| `.env.example`, `docker-compose.yml`, `.dockerignore`, `.gitignore` | Private storage config, durable Compose volume and exclusion of artifacts from Git/Docker build context |

`fflate@0.8.3` is now a direct API dependency, already present transitively in the lockfile. It supplies a bounded synchronous ZIP builder/decoder without a new scheduler or native binary. Archives use stored entries (compression level 0), fixed ZIP timestamps and a 20 MiB total limit. Flutter currently has no implemented package decoder: CTMS-053/054 must choose one compatible with this ordinary ZIP schema before activating packages. No mobile dependency was added here.

### Database and publication contract

| Table | Stored data / invariants |
| --- | --- |
| `offline_packages` | READY-only immutable rows; Trip FK; unique `(trip_id,package_version)` and `(trip_id,generation_key)`; schema 1 manifest; private complete source provenance; external SHA-256/size/key; generation time. A trigger rejects UPDATE/DELETE; a referenced Trip cannot be deleted in place. |
| `offline_package_jobs` | Unique `(trip_id,request_key)`; state, attempts, lease token/expiry, next attempt, reason codes and exact result package; first generation time is retained for reproducible retries. |
| `offline_package_audit` | Claim, READY and failure transitions, reason codes and database timestamps, linked to durable requests. Initial request time/state is on the job row. |
| `offline_package_artifact_cleanup` | Provisional content-addressed keys and producing job; due cleanup receipts retained for repeated removal of late stale writes. READY-referenced objects are excluded. |

The migration queues `initial` when a Trip is inserted/updated to `published`, in the **same transaction** as publication. Unique request identity prevents duplicate initial requests, including repeated status updates. Existing published Trips are backfilled. A database trigger avoids coupling the generator into TripsService and covers alternate transactional publishers. Migration up/down, reapply and backfill have passed in the isolated integration schema. This migration must be deployed before enabling application workers; deployment to the application database is not established by the test run.

Workers claim at most one job per process using `FOR UPDATE SKIP LOCKED`. Leases last 120 seconds and renew every 40 seconds; expiry or a new token fences an old worker from commit. Technical failures retry at most three attempts with 10/20/40 second backoff; the third failure is terminal. Expired third-attempt workers are also finalized FAILED. Business gaps are BLOCKED without polling the same request indefinitely. An approved upstream revision can be re-evaluated using a new stable impact ID; the original blocked request remains auditable. Integrity corruption is FAILED. There is no new public retry/create endpoint.

### Snapshot and concurrency design

1. Read core and database-only upstream sources in a REPEATABLE READ snapshot. Build context/selection and validate all gates.
2. Build ZIP outside a database transaction. Reserve an orphan-cleanup receipt under the current lease, then persist private provisional bytes with no replacement of an existing key.
3. In a short final transaction, fence core writers, serialize allocation per Trip with a transaction advisory lock, re-check the live lease, and obtain the upstream locking read.
4. Reject changes in core/source fingerprints, the insert/delete-covering upstream revision, or time-dependent eligible selection. Re-run gates at the current time. Reuse an existing generation key when appropriate; differing concurrent inputs retry version allocation instead of mixing snapshots.
5. Lock the provisional receipt, reread and verify stored ZIP bytes, insert immutable metadata/provenance, and mark the request READY atomically. A failed commit leaves a cleanup receipt and no visible package.

Existing core writers have no common revision-row protocol. The final transaction therefore takes `SHARE` table locks on `trips`, `trekking_routes`, `checkpoints` and `trip_waypoints`, covering inserts/deletes and updates. These locks briefly block writes across those tables; this is the explicit correctness/performance tradeoff for the current schema. Lock waits are bounded at 5 seconds and SQL statements at 15 seconds. Future upstream revision fencing could narrow this scope. Source writers must obey the revision-row protocol documented in [upstream contracts](../../file/spec/ctms-52-upstream-safety-contracts.md); the current unavailable adapter never fabricates that protocol or a successful source run.

No external source calls run inside transactions. The final transaction performs a bounded local-file integrity read before READY. Live-job receipts prevent cleanup racing active generation; the receipt lock fences final publication against orphan removal. Unreferenced ZIPs are revisited hourly; crash-left staging files older than 24 hours are removed. READY files are not automatically rewritten or deleted.

### Schema 1 and privacy

ZIP `application/zip` contains exactly `manifest.json`, `route.geojson`, `checkpoints.json`, `waypoints.json`, `hazards.geojson`, `guidance.json`. `PackageManifest` in the types file is the exact schema:

- `tripId`, positive `packageVersion`, `schemaVersion: 1`, persisted `generatedAt`.
- Route ID/geometry fingerprint; full core and source fingerprints; generator/approved coverage-policy versions and approval ID.
- Evidence-based context; source identities, references, status, checkedAt and provider validity. A successfully checked empty feed is `NO_ACTIVE_ALERT`, never `SAFE`; optional unavailable feeds remain `UNKNOWN`.
- Guidance unit/document/chunk-set/chunk IDs and approval version. `guidance.json` also retains PDF checksum, page/item references, complete content, attribution and licensing references.
- Each payload's SHA-256 and exact byte size. The ZIP's SHA-256 and total size are only in database/transport metadata, avoiding recursive self-hashing.

The generation key includes semantic source/core/policy identity, not request IDs, collection `checkedAt` or mutable revision counters. Unordered upstream row sets are normalized for stable hashing. Final revalidation separately checks the full scope revision. Internal provenance retains field verification actors/evidence and PDF rights/approval records. The shared artifact contains opaque field decision ID/version/time and an evidence fingerprint, without raw reporter/verifier/Admin IDs or private evidence/PDF file locations. Arbitrary Trip/waypoint/geometry/source metadata is not serialized. Explicit personal-content flags fail G05; upstream still owns validation of the source content itself. BR-230 obligations elsewhere remain intact.

### Trusted handoff to 053/054/055/057/119

| Service method | Result / caller responsibility |
| --- | --- |
| `requestInitial(tripId)` | Idempotent published-Trip request; publication normally invokes the database trigger automatically. |
| `requestImpact(tripId,impactId)` | Trusted 119 entry point; stable approved-impact identity is hashed, duplicate requests return the same job. This does not implement impact detection. |
| `getJobStatus(tripId,jobId)` | Durable internal job state and reason codes, scoped to Trip. |
| `getReadyMetadata(tripId,version?)` | Latest/exact `ReadyPackageMetadata`: `id`, `tripId`, `packageVersion`, `generationKey`, `schemaVersion`, `sha256`, `sizeBytes`, `generatedAt`, `contentType`. No private file key or source audit payload. |
| `getManifest(tripId,version?)` | Exact persisted `PackageManifest`, or null. |
| `readArtifact(tripId,version)` | Size/hash/manifest-verified Buffer, or null if absent. 053 must first authorize the participant and own private transport/resume. |

053/054 own download, ZIP handling, SHA-256 verification and activation. 055 owns offline presentation. 057/119 own freshness/outdated/revocation metadata, source impact and required-version publication. An ongoing Trip keeps its activated version. Checksum success does not establish current weather freshness or source correctness. No GPS geometry `routeVersion` algorithm changed.

### Deployment and operational evidence

Set `OFFLINE_PACKAGE_WORKER_ENABLED=true` outside tests and configure `OFFLINE_PACKAGE_STORAGE_ROOT` outside public uploads. Compose now mounts `offline-package-data:/var/lib/ctms/offline-packages`. Back up this volume and PostgreSQL together. Multiple API processes must see the same private filesystem; separate hosts require a shared-volume or object-storage adapter before deployment. Local storage is the implemented adapter; Cloudinary is not used for ZIPs.

`offline_package_ready` / `offline_package_attempt_failed` logs include job identity, attempt, reason codes and elapsed milliseconds without raw source/personal content. Queue health and terminal blockers can be counted from `offline_package_jobs GROUP BY status`; `offline_package_audit` provides durable transitions. No public operational dashboard was added.

## Spec diff summary and BR evidence

| Change group | Scope / BR / AC |
| --- | --- |
| `ctms-52-create-offline-package-for-each-trip.md` | 2026-11-06 operational amendment: BR-229/365/428 sources, content, immutability and gates; BR-230 shared-data minimization; BR-212/213 acceptance matrix. Original wording retained below the explicit superseding amendment. |
| `ctms-10`, `docs/business-rules/route-safety-v2.md` | Normalized official/verified-field upstream contract; existing preview sources retained. |
| `ctms-49`, `ctms-86`, `ctms-116/117/118` | Reporter permission gap and independent Host verification; GPS hotspot review remains a separate workflow. Documentation only. |
| `ctms-50/51` and `ctms-52-upstream-safety-contracts.md` | Proposed guidance approval/coverage policy and verified-report promotion tasks; no fake approvals or upstream implementation. |
| `ctms-119` | Approved source-impact triggers and stable identities, avoiding weather-poll version churn. |
| `ctms-53/54/55/57` | Archive/digest/metadata handoff, privacy, integrity vs freshness, ongoing activated-version lock. No client code changed. |

Unit evidence: [package-policy.spec.ts](../../services/api/src/modules/offline-packages/package-policy.spec.ts), [package-artifact.spec.ts](../../services/api/src/modules/offline-packages/package-artifact.spec.ts), [offline-packages.worker.spec.ts](../../services/api/src/modules/offline-packages/offline-packages.worker.spec.ts). PostgreSQL transaction/concurrency evidence is provided by [offline-packages.integration-spec.ts](../../services/api/test/offline-packages.integration-spec.ts), using the real migration/PostGIS/filesystem in an isolated test schema. All 14 integration cases passed in the user's terminal, as shown in the supplied screenshot. Only upstream source decisions are fictional, test-only fixtures. The agent runtime still cannot connect directly; the integration result is user-provided execution evidence, not an independent agent rerun. These passing tests do not verify the eventual real upstream adapter.

## Verification report — 2026-11-06

| Check | Command / evidence | Result |
| --- | --- | --- |
| Formatting/lint | `node_modules/.bin/biome.cmd check` on the module, migration, AppModule and new tests/fixture | PASS: 17 files, no fixes required in the final check |
| API typecheck | `node services/api/node_modules/typescript/bin/tsc --project services/api/tsconfig.json --noEmit` | PASS |
| Compile including emit | `node services/api/node_modules/typescript/bin/tsc --project services/api/tsconfig.json --outDir services/api/test-results/ctms52-build --declarationDir services/api/test-results/ctms52-build` | PASS: JS, declarations and source maps emitted to an ignored isolated output directory; existing running-app dist was not replaced |
| Source + new test typecheck | TypeScript program using API compiler options, explicit Jest/Node types, new integration/unit/fixture roots and `noEmit` | PASS; includes all 14 new PostgreSQL integration cases, but does not execute them |
| CTMS-052 + focused regression | `node services/api/node_modules/jest/bin/jest.js --config services/api/jest.config.js --runInBand --cacheDirectory D:/Capstone/CTMS/services/api/test-results/ctms52-jest-cache --testPathPattern 'offline-packages\|source-policy.spec\|knowledge-chunks.policy.spec\|trips.di.spec\|trips.service.spec\|route-safety.service.spec'` (the pattern uses ordinary pipe alternation) | PASS: **8 suites, 187 tests**. Covers new policies/storage/worker plus existing Trip publication service/DI, Route Safety, PDF rights and chunk eligibility. |
| PostgreSQL integration | Set `TEST_DATABASE_URL` to `postgresql://ctms:ctms@127.0.0.1:55451/ctms_test`, then run `node services/api/node_modules/jest/bin/jest.js --config services/api/test/jest-integration.json --runInBand --cacheDirectory D:/Capstone/CTMS/services/api/test-results/ctms52-jest-cache --testPathPattern offline-packages.integration-spec` | PASS from user-provided terminal evidence: **1 suite, 14 tests, 3.784 seconds**, after explicit `$3::varchar` casts. Covers migration, transaction/concurrency, retry, integrity and orphan recovery with fictional upstream inputs. |
| Final review: unit/regression + added edge cases | Same focused command, including `package-readiness.spec.ts` | FAIL: **188 passed, 2 failed, 190 total**. Two optional expired-feed cases reveal a P1 manifest freshness defect. |
| Final review: integration rerun and new worker E2E | Dedicated `ctms_test` on port 55451; commands in the final review | BLOCKED before setup: `connect EACCES 127.0.0.1:55451`. No fresh PASS claimed. |
| Final review: actual local fixture ZIP | Stored ZIP read back; Node crypto plus PowerShell SHA-256; per-payload verification | PASS: 5908 bytes, SHA-256 `3e92dd83cada6a53b80ee98340e2c052ebc5316dcfcfd355a2331ea010dd09c8`. Filesystem evidence, not database E2E. |
| Compose configuration | `docker compose config --quiet` | PASS; no containers restarted or deployed |
| Patch whitespace | `git diff --check` | PASS |

The normal `pnpm --version` launcher attempted a Corepack download and failed DNS resolution (`ENOTFOUND registry.npmjs.org`). The existing local CLIs were used directly. The locked fflate version was already available in the local dependency store; no version was fetched or substituted. Jest's default sandbox temp cache rejected renames, so the final checkpoint uses the ignored workspace cache shown above. An actual concurrent-storage test exposed a race after an exclusive copy collision; bounded integrity rereads now wait for the competing writer, while existing corrupt objects still fail. The corrected focused regression checkpoint passed; the full repository regression suite was not repeatedly run.

User-run verification subsequently reached PostgreSQL on the application's port 5432, but all 14 cases reported `could not open critical system index 2662`. Index 2662 is PostgreSQL's `pg_class_oid_index`, a system catalog index. This result does not establish 14 independent generator defects, nor does it establish migration/concurrency correctness. Container readiness alone does not verify catalog integrity. The earlier instruction to use the application's PostgreSQL instance was incorrect for isolation: the repository already provides `docker-compose.test.yml`.

The successful verification used the existing disposable **test instance on port 55451**, which mounts tmpfs and does not attach the application's recovered PostgreSQL volume. Reproduction commands from the repository root in PowerShell:

```powershell
docker compose -f docker-compose.test.yml up -d --wait postgres
docker compose -f docker-compose.test.yml exec -T postgres psql -U ctms -d ctms_test -v ON_ERROR_STOP=1 -c "SELECT current_database(), oid, relname FROM pg_catalog.pg_class WHERE oid=2662;"
$env:TEST_DATABASE_URL = "postgresql://ctms:ctms@127.0.0.1:55451/ctms_test"
node services/api/node_modules/jest/bin/jest.js --config services/api/test/jest-integration.json --runInBand --cacheDirectory D:/Capstone/CTMS/services/api/test-results/ctms52-jest-cache --testPathPattern offline-packages.integration-spec
```

The smoke query should return `ctms_test`, `2662`, `pg_class_oid_index`; the target integration result is 14 passing cases. The test instance's Compose configuration validates, but this session cannot start it or inspect server logs because the Docker API rejects access (`permission denied` on the Docker Desktop engine pipe). No repair, reindex, recreation or deletion of the existing application database/volume has been attempted.

The subsequent user-run check on port 55451 returned the expected catalog row and **11 passed / 3 failed**. The three failures all reached `OfflinePackagesRepository.fail()` and reported `inconsistent types deduced for parameter $3`, used in the varchar status assignment and CASE comparison. Both uses now explicitly cast `$3::varchar`, preserving the existing states, retry policy and schema. The existing integration cases for business BLOCKED, technical retry/backoff and completion rollback/orphan collection exercise this defect; no mock-only SQL assertion was substituted for them.

After this correction, API typecheck, Biome on the changed repository file, and **all 40 CTMS-052 unit tests (3 suites)** pass. Re-running the real integration command from the agent runtime still stops before setup at `connect EACCES 127.0.0.1:55451`. The user then supplied the corrected terminal result: **14 passed / 14 total, 1 suite passed, 3.784 seconds**. This closes the previously pending isolated PostgreSQL verification. The unavailable-production-source case also passes, confirming that missing authoritative inputs retain BLOCKED rather than producing a fabricated READY package.

These cases check publication rollback/backfill and migration reapply, claims/concurrent deduplication, v1 immutability/v2, source/core races, stale leases, bounded retries, storage/integrity failure, commit rollback and orphan recovery. Test isolation does not replace testing the eventual real upstream adapter against source publication/withdrawal writers.

Upstream business blockers remain: normalized complete official feed runs (010/safety ingestion), Host verification plus field promotion (proposed tasks), and Admin-approved complete guidance plus coverage/applicability policy (050/051 extension/proposed task). The field path is optional until available; lack of approved guidance and authoritative required-source runs currently blocks real packages. Next action is for those owners to implement `OfflineSafetySources` against versioned persisted publication/revision records, then run real source-contract and PostgreSQL integration tests before enabling production READY. This work does not create Jira tasks or claim business completion.
