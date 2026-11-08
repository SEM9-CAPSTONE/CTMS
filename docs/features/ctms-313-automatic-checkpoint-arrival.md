# CTMS-313 / CTMS-061-T01 — Backend checkpoint arrival contract

Scope: backend preparation and synchronization logic for CTMS-061. No Web/Mobile
changes, on-device detector, offline buffer, general sync engine, or Porter manual
confirmation changes are included. BR-239 and the active CTMS-061 spec remain the
business authority.

## Active package dependency

There is currently no implemented Offline Safety Package publisher/active-session
registry in this repository. GPS and route-deviation uploads previously accepted a
client-supplied package-version label, which is insufficient for CTMS-061.

`CheckpointArrivalsRepository.registerActivePackage(context)` is an internal
integration seam for that publisher. It accepts the trusted package's Trip, Route,
Route version, package ID/version, and checkpoint coordinate snapshot. Registration
checks the Trip's Route and the actual Route checkpoint IDs/coordinates, then pins
the context. Identical registration is idempotent; replacement is refused. No
public HTTP endpoint accepts or activates package manifests. The package publisher
must verify its own provenance/version and invoke this method before its manifest
is distributed for detection. Registration does not generate a full safety package.

Until this dependency supplies a context, synchronization returns HTTP 409. Neither
API requests nor migrations synthesize an active package. No additional seed script
is introduced. If demo package data is needed later it must be added only to
`services/api/src/seeds/main.seed.ts` and explicitly identified as demo data.

## Synchronization API

`POST /api/trips/:tripId/automatic-checkpoint-arrivals`

Authentication: existing JWT/role guards; Camper or Porter role AND actual Trip
participation. User identity is server-derived; client member/user IDs are refused.
The request is `{ arrivals: [...] }`, with 1–100 records. Each record contains:

- `id`: stable client-generated UUID for CHECKPOINT_REACHED and its automatic visit.
- `checkpointId`, `routeId`, `routeVersion`, `packageId`, `packageVersion`.
- `detectedOffline`: original connectivity flag.
- `samples`: exactly the last three consecutive raw GPS samples, in capture order.
  Each has `eventTime` (ISO timestamp with explicit offset), `latitude`, `longitude`,
  and `accuracyMeters`.

The third sample supplies the original arrival time/location. The API does not
substitute upload time. Each sample must have accuracy <=20m, be <=20m from the
checkpoint snapshot, and have a strictly increasing timestamp with a 1s–180s interval
between consecutive samples and <=600s total sequence span. `radius_m` and
client-claimed distance/count do not influence validation. Distance is calculated
via Haversine Great-Circle (R = 6,371,000m) rounded to millimeters (<=20.000m).
All three sample times must be within the authoritative Trip/participant window and
not in the future (with 60s allowable clock skew). Ongoing Trips accept uploads;
completed Trips accept historical eligible samples within a 7-day grace period.
New events on published/cancelled Trips are rejected. Route membership is by
checkpoint ID, never by waypoint label/type: a Route REST checkpoint is valid,
while a custom Rest/Meal/Activity Trip waypoint is not automatically eligible.

### Idempotency evaluation order (Server First-Write Wins):
1. **Foreign UUID check**: If `id` exists in DB belonging to another user or trip,
   return `rejected` (`id_conflict`, `retryable: false`).
2. **Same-user UUID check**: If `id` exists belonging to this user:
   - If payload fingerprint matches: return `duplicate` (`reason: null`, `retryable: false`,
     returning original `visitId` and `receivedAt`).
   - If payload fingerprint differs: return `rejected` (`id_conflict`, `retryable: false`).
3. **Triple visit check**: If `id` is new, but `(trip_id, user_id, checkpoint_id)` already
   has a confirmed visit in DB: return `duplicate` (`reason: null`, `retryable: false`,
   returning original `visitId` and `receivedAt`).
4. **Clean insert**: Otherwise, insert new visit atomically; on commit return `accepted`
   (`reason: null`, `retryable: false`, `visitId: id`, `receivedAt: now`).

Each response item contains `id`, `clientId` (for client queue clearance), `status`,
`reason` (strictly typed `CheckpointArrivalRejection` enum), `retryable` (boolean flag), `visitId`, and `receivedAt`.

### Rejection Codes & Semantics:
- `context_mismatch`: Route or package ID/version does not match active snapshot.
- `checkpoint_not_in_package`: Target checkpoint ID is not present in the package manifest.
- `checkpoint_not_found`: Checkpoint entity missing or foreign key constraint violation (terminal, `retryable: false`).
- `threshold_not_met`: GPS accuracy > 20m, or distance to checkpoint > 20.000m (Haversine R=6,371,000m).
- `invalid_sample_sequence`: Sample count != 3, interval < 1s or > 180s, total span > 600s, decreasing/equal timestamps, or unparseable/NaN timestamps.
- `id_conflict`: Reused UUID with changed payload, UUID owned by another user/trip, or concurrent race.
- `event_time_in_future`: Timestamp exceeds server receipt time by more than 60s allowable clock skew.
- `trip_completed_window_expired`: Trip is completed and upload occurs past the 7-day grace period from `ends_at`.
- `trip_not_trackable`: Trip is published or cancelled.
- `participation_not_eligible`: Camper not joined or Porter not assigned.
- `event_time_outside_participation`: Sample eventTime occurred before check-in or after trip completion.
- `processing_error`: Transient database or query failure (deadlock, connection timeout); client keeps record in offline queue (`retryable: true`).

### Mobile Retry & Backoff Contract (CTMS-314 Guidelines):
For records rejected with `retryable: true` (`processing_error`):
- Mobile client must NOT retry immediately in a tight loop.
- Client MUST employ exponential backoff with jitter (initial delay 5s, doubling up to max 60s).
- Maximum retry attempts: **5 attempts**.
- If maximum attempts are exhausted, the record must be paused/marked for manual retry or deferred until manual Porter confirmation (CTMS-056) to prevent queue starvation and battery drain.
- Records with `retryable: false` (`checkpoint_not_found`, `threshold_not_met`, `id_conflict`, etc.) are terminal rejections and MUST be pruned from the local synchronization queue immediately.

### Batch Isolation & Database Savepoints:
Each event in a batch is isolated within its own database `SAVEPOINT`. If an individual record encounters an error:
- Foreign key violation (`23503`): Rolled back to savepoint and rejected as terminal `checkpoint_not_found` (`retryable: false`).
- Transient DB or unexpected query failure: Rolled back to savepoint, error logged without GPS coordinates, and rejected as `processing_error` with `retryable: true`, directing Mobile to keep the event in the offline queue for subsequent retry.
- Visit and audit rollback: If the audit log insert fails, the visit row within that record's savepoint is rolled back cleanly.
The outer transaction commits all valid `accepted` and `duplicate` records cleanly, preventing data loss in mobile offline synchronization queues.

### Checkpoint Snapshot Decoupling:
`automatic_checkpoint_visits` does not maintain a direct foreign key to the mutable `checkpoints` table. Instead, it references the immutable package snapshot in `checkpoint_arrival_contexts`. This ensures that subsequent modifications or deletions of live route checkpoints by the Host do not invalidate historical offline checkpoint arrivals.

### Serialization Consistency:
Payload fingerprinting serializes floating-point coordinates verbatim. Mobile clients must retain identical floating-point values without re-rounding or altering precision across retries to prevent spurious `id_conflict` rejections.

### Fallback Context Mechanism (Dev/Test Seam):
In development and test environments, when an authoritative package is not yet published, setting `ALLOW_CHECKPOINT_ARRIVAL_FALLBACK=true` automatically provisions a fallback checkpoint snapshot from existing Route and PostGIS Checkpoint entities with label `context_source='fallback'`. Fallback never overwrites an existing authoritative context (`ON CONFLICT (trip_id) DO NOTHING`). The flag is strictly forbidden and rejected at startup if `NODE_ENV === "production"`.

### Detection Risks & Field Verification
- **Sampling rate & speed**: At standard 10s sampling (`GpsTrackingContext`), a camper
  walking at 1.4 m/s through a 20m circle is within range for ~28s (2 to 3 samples).
  A fast walker or tangential path may capture only 2 samples, missing automatic detection.
- **Canopy degradation**: Dense canopy or canyon terrain frequently causes GPS accuracy
  to degrade beyond 20m, discarding samples.
- **Backup seam**: Porter manual checkpoint confirmation (CTMS-056) remains the official
  operational fallback. Field detection rates should be benchmarked during trials.

## Persistence, identity, and concurrency

Migration `1794600000000-CreateAutomaticCheckpointArrivals.ts` adds:

| Table | Responsibility |
| --- | --- |
| `checkpoint_arrival_contexts` | One immutable active package checkpoint snapshot per Trip; Route/package identity, coordinates, and `context_source` ('authoritative' or 'fallback') retained for historical interpretation. |
| `automatic_checkpoint_visits` | One server-confirmed automatic CHECKPOINT_REACHED event/visit per Trip/user/checkpoint; raw sample evidence, original time/location, Route/package identity, offline flag, payload fingerprint and first receipt. |

The logical unique key follows the existing per-Trip/per-participant/per-checkpoint
visit model; subsequent samples do not create new visits. New event UUIDs cannot
bypass that unique key. A matching retry is a no-op; reusing an ID or logical visit
with changed evidence is rejected as `id_conflict`. Foreign users/Trips do not
receive the stored acknowledgement. Equivalent timestamp offset notation is
normalized for fingerprinting. Stored evidence is never overwritten on retry.

Trip locking serializes registration/ingestion; participant rows remain locked
through validation/commit. Database primary/unique keys also protect concurrent
UUID reuse across Trips. Visit and audit creation occur in one transaction; any
database failure rolls back both. Audit includes identity/version/time metadata,
not precise GPS locations or raw samples. Package snapshots survive live checkpoint
coordinate edits and are never hot-updated.

Automatic visits describe only the authenticated detector. They are stored apart
from CTMS-056 Porter-confirmed member visits, do not fan out to every member, and
do not silently change the existing manual operational-progress API semantics.
This task does not add a progress UI or claim the offline/mobile acceptance tests.

## Validation

- 31 unit tests (`checkpoint-arrival-integrity.spec.ts`):
  - Boundary distance tests: 19.99m and 20.000m pass, 20.001m fails.
  - Time intervals: 1s–180s pass, < 1s or > 180s fail.
  - Sequence duration: <= 600s pass, > 600s fail.
  - Invalid/unparseable timestamps: NaN/garbage strings fail.
  - Fingerprint sensitivity: covers all payload fields (`checkpointId`, `routeId`, `routeVersion`, `packageId`, `packageVersion`, `detectedOffline`, `samples`).
  - DTO validation and sizing (1–100 records batch).
- 20 real PostgreSQL integration tests (`checkpoint-arrivals.integration-spec.ts`):
  - Fails closed without authoritative package context (409 Conflict).
  - Trusted package registration & immutability.
  - Request-level participant authorization (401/403).
  - Partial batch acceptance & per-record rejections.
  - Concurrent replay idempotency & duplicate detection.
  - First-write-wins when a new UUID is uploaded for an already visited checkpoint.
  - Assigned Porter visits without marking camper members reached.
  - Foreign UUID conflicts without leaking acknowledgement.
  - Lifecycle validation on published/cancelled Trips.
  - Frozen package coordinates surviving live Route checkpoint edits.
  - Historical arrival acceptance on completed Trips.
  - 7-day grace period expiration for completed Trips (`trip_completed_window_expired`).
  - Savepoint isolation: individual DB failures rolled back without aborting batch.
  - Error classification: transient errors return `processing_error` (`retryable: true`); FK failures return `checkpoint_not_found` (`retryable: false`).
  - Audit rollback: audit log failure rolls back visit within savepoint without affecting other batch records.
  - Fallback context 409 when disabled.
  - Fallback context provisioning from PostGIS when enabled in non-prod.
  - Fallback context never overwrites authoritative context.
  - Fallback context blocked in production at startup.
  - Master seed script execution (`seedCheckpointArrivalContexts`).
- API TypeScript, ESLint and Biome checks pass with 0 errors.
