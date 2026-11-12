# CTMS-305 — Package freshness and departure contract

Story: Jira CTMS-242 / spec CTMS-057. Client implementation belongs to CTMS-306.
This implementation follows the repository's NestJS/TypeORM patterns; the generic
`.agents` rules describe a different E-Hub/Prisma application.

## Scope and existing lifecycle

Trips currently become ongoing by schedule; there is no manual Start Trip API.
An assigned Porter explicitly confirms **one installation/device** as responsible
for departure. This is not a requirement that every Camper or every device reports.
The server does not guarantee that another member's device possesses the package.
Campers can report their own package state but cannot confirm responsible departure.
Device UUIDs are client-supplied installation identifiers, not hardware attestation.
No new manual Trip lifecycle endpoint or package-generation behavior is introduced.

`OFFLINE_PACKAGE_DEPARTURE_GATE_ENABLED=true` opts the schedule worker into the gate.
Default/absent/false preserves the old transition path. Even with the flag enabled,
Trips with no row in `offline_package_requirements` start without activation reports.
Merely having package metadata does **not** make a package mandatory. The flag must
not be enabled for required Trips until 306 and the authoritative 119 integration
are deployed. Old clients cannot provide the new evidence for such Trips.

With enforcement enabled, the Trip repository holds the Trip write lock, calls
`PackageActivationService.assertDepartureReady(manager, tripId)`, then changes
status and writes the existing audit within the same transaction. A successful
check writes `locked_at`; a failed transition rolls it back. Trip code does not
compare versions, hashes, reports or source expiry. Completed-transition, weather
pause and participation-evaluation rules remain as before.

### Not-ready retry and visibility

The existing `TripStatusScheduleWorker` retries each enabled worker tick (default
60 seconds, configurable with `TRIP_STATUS_WORKER_INTERVAL_MS`). A failed gate
leaves the Trip published; there is no grace timeout that silently authorizes an
unsafe departure. Each gate attempt persists the server timestamp and reason in
the requirement row. Context exposes this as `departureCheck` (separate from the
GET's `checkedAt`). The worker writes `offline_package.departure_blocked` to the
existing audit log when the reason changes, not on every repeated failure. Once
readiness is corrected, the next tick can start and atomically record the lock.

This provides persistent diagnostics and a durable server notification inbox for
the owning Host and the Porters assigned at that blocked episode. CTMS-305 owns
notification creation/storage/access/acknowledgement; CTMS-306 owns fetching and
visibly presenting them on app start, resume and periodic polling. Notification
creation commits with the gate/audit; rollback cannot leak an alert. Same-reason
retries create no additional episode; a reason change creates a new episode.
Recipient ownership and current assignment are rechecked on list/read. This is
an authenticated server inbox, not Firebase/APNs/email delivery or proof of viewing.
No FE banner is claimed in this branch. A Trip may stay blocked until its actual
requirement/evidence is resolved; it must not be presented as ready merely because
time has elapsed. The existing end-of-schedule completion behavior is unchanged.
With the gate enabled, blocked candidates do not consume the entire start batch:
the worker scans onward to later due Trips, so a blocked prefix cannot starve them.

### Controlled exit

The existing owning-Host `PATCH /trips/:tripId/cancel` accepts a non-completed,
non-cancelled Trip even after scheduled start. It reuses the existing cancellation
transaction, commitment handling and `trip.cancelled` audit. This is the available
controlled exit when readiness cannot be resolved. Porter acknowledgement of a
notification does not waive the requirement. No new unsafe override is introduced.
The existing reschedule API rejects changes after start time, so it is **not**
advertised as an escape for an already overdue blocked Trip. No new cancellation
rules or additional authority are added by 305.

Before enabling the flag, deploy 119's source/requirement adapter and 306's visible
blocked-state/inbox handling. Until then leave it off. No ticket or Jira comment was
created; server ownership was explicitly assigned to 305 in the implementation review.

## CTMS-119 handoff (not implemented here)

119 owns deciding whether source changes require publication, whether a package
is required, and source freshness/expiry. Publication alone does not imply a new
mandatory requirement. It must call `requirePackage(manager, tripId, packageId)`
within its publication transaction. This method takes the same Trip write lock,
checks package ownership and refuses ongoing/non-published Trips. Direct table
updates bypass this concurrency protocol and are not supported.

The method serializes requirement changes against departure. If publication wins,
an older responsible-device confirmation cannot start. If departure wins, the old
verified required package is locked and later replacement is rejected. Merely
inserting a newer immutable package does not replace the locked version.

`PackageFreshnessSource.read(manager, tripId, packageId)` is the extension port for
119. Its production implementation currently returns `unknown` with
`SOURCE_FRESHNESS_UNAVAILABLE`; fixtures supply current/expired states only in tests.
No expiry is fabricated from weather polling, `checkedAt`, Route geometry changes
or source timestamps. Unknown/expired source evidence blocks a **required** gated
departure. This dependency remains pending, not a claim that 119 is complete.

## HTTP API

All routes require the existing authenticated Camper/Porter role and actual
confirmed booking membership or assigned Porter participation. Missing Trip and
lost participation both return 404 `TRIP_NOT_ACCESSIBLE`. No owner shortcut is added.

Base: `/trips/:tripId/offline-package-policy`.

| Method/path | Input | Behavior |
| --- | --- | --- |
| GET `context` | query `deviceId`, `packageId` (UUIDs) | Read-only repeatable-read snapshot of exact selected package and three independent axes |
| POST `device-report` | UUID `deviceId`, UUID `packageId`, `status`, optional `sha256` | Idempotent per Trip/user/device/package, only before departure |
| POST `departure-ready` | UUID `deviceId`, UUID `packageId` | Assigned Porter confirms its own active device/package for scheduled departure |
| GET `departure-status` | no package/device required | Current participants and owning Host see `blocked`, `state`, `reasonCode`, `lastCheckedAt`, `tripStatus` |

`departure-status.state` is `not_checked`, `blocked`, `ready`, `locked` or `inactive`.
`not_checked` is not proof of readiness. CTMS-306 must show a published/blocked Trip
as unable to depart, not as a normal ready-to-start Trip, including for members who
have not downloaded anything. The owning Host gets only this status route; no new
Host access to client package reports or package bytes is granted.

`GET /offline-package-notifications` returns the newest 50 owned notifications
for authenticated Host/Porter users. Each has `id`, `tripId`, `reasonCode`, server
`createdAt`, nullable `readAt`, and `active` (false after the Trip leaves published
or the current block reason differs). It is a bounded operational inbox, not a
complete audit history. `POST /offline-package-notifications/:id/read` idempotently
sets `readAt`; inaccessible notifications return 404 `NOTIFICATION_NOT_ACCESSIBLE`.
It never overrides departure readiness. Dedupe by notification ID on the client;
refresh `departure-status` when opening an old notification.

Malformed/extra inputs return 422. POSTs return the Nest default 201 on success.
Responses have `Cache-Control: private, no-store`. Exact package UUID identifies
its immutable version; version selection is never silently changed by the API.

Example context (illustrative IDs and UTC timestamps):

```json
{
  "tripId": "11111111-1111-4111-8111-111111111111",
  "tripStatus": "published",
  "checkedAt": "2026-11-12T00:00:00.000Z",
  "selected": { "packageId": "22222222-2222-4222-8222-222222222222", "version": 1, "updatedAt": "2026-11-11T00:00:00.000Z" },
  "integrity": { "serverArtifact": "verified", "state": "client_reported_verified", "serverVerifiedClientBytes": false },
  "publication": { "latestVersion": 2, "newerAvailable": true, "requiredPackageId": "33333333-3333-4333-8333-333333333333", "updateRequired": true },
  "sourceFreshness": { "state": "unknown", "expiresAt": null, "reasonCodes": ["SOURCE_FRESHNESS_UNAVAILABLE"] },
  "replaceAllowed": true,
  "lockedPackageId": null,
  "lockedAt": null
}
```

The axes are independent: checksum success does not make a source current, and a
newer version does not authorize ongoing replacement. During ongoing/completed/
cancelled, `replaceAllowed=false`; `newerAvailable` may remain true. Existing ongoing
Trips are not backfilled, so a null lock means **no server lock evidence**, not a
claim that the latest package is active. `updateRequired` concerns pre-start policy.
CTMS-306 must preserve `unknown` as unknown and visibly distinguish it from current;
it must never render unavailable source evidence as an up-to-date safety package.

`publication.requiredVersion` accompanies `requiredPackageId` so 306 can request
the exact existing versioned download endpoint rather than assume latest is required.
`deviceReport` is null or contains the selected package's client-reported state,
`downloadedAt`, `verifiedAt` and `activatedAt`, all server UTC timestamps. A
download-only acknowledgement is `CLIENT_REPORTED_DOWNLOAD`, not hash verification.

`selected.updatedAt` is immutable artifact generation time, not device download time.
`checkedAt` is the server transaction timestamp in UTC. Offline clients retain this
as `lastCheckedAt` and display last-known state, never a claim of a new server check.
Any client-side display using `expiresAt` must disclose that the device clock is
untrusted; it cannot substitute for authoritative server evaluation.

## Client evidence and lifecycle

Report statuses are `downloaded`, `verified`, `active`. Verified/active require
client SHA-256 exactly matching package metadata. An active report also verifies
the private **server** artifact and manifest. The server cannot read the client's
bytes or prove a physical download; UI must say client-reported hash verification,
not server attestation. The departure gate rechecks the server artifact before lock.

Repeated reports preserve first timestamps and never downgrade state. Only one
package is active per Trip/user/device; pre-start replacement retains the previous
report and verification timestamps. Activation is rejected if it does not match an
explicit requirement. Responsible-device confirmation is idempotent for the same
identity and is invalidated implicitly by a changed requirement or Porter removal.
All mutating report/confirmation paths hold the Trip write lock. All post-start
activation reports are rejected, including retry reports, with stable policy codes.

| Code | Meaning |
| --- | --- |
| `PACKAGE_TRIP_MISMATCH` | Package UUID is not owned by this Trip |
| `PACKAGE_HASH_MISMATCH` | Verified/active report lacks the expected SHA-256 |
| `PACKAGE_ARTIFACT_UNAVAILABLE` | Server bytes/manifest unavailable or invalid |
| `PACKAGE_UPDATE_REQUIRED` | Activation candidate differs from required package |
| `PACKAGE_VERSION_LOCKED` | Ongoing Trip cannot replace/report activation |
| `PACKAGE_TRIP_NOT_PUBLISHED` | Non-published terminal/draft state disallows mutation |
| `DEPARTURE_RESPONSIBLE_PORTER_REQUIRED` | Actor is not an assigned Porter |
| `PACKAGE_ACTIVATION_REQUIRED` | Responsible device has no active report for selected package |
| `PACKAGE_DEPARTURE_NOT_READY` | Required package and responsible-device evidence do not match |
| `SOURCE_FRESHNESS_UNAVAILABLE` | Required source evidence is unknown |
| `PACKAGE_SOURCE_EXPIRED` | Authoritative source reports expired |
| `NO_REQUIRED_PACKAGE` | Legacy/no-requirement departure allowed |
| `PACKAGE_DEPARTURE_READY` | Required responsible-device evidence satisfies gate |

## Migration and sensitive data

Migration `1795100000000` adds four tables only: requirements, device reports,
responsible departures/locks and the durable notification inbox. No existing Trip/package/user is backfilled. Composite
foreign keys prevent cross-Trip identities; the report primary key makes retries
idempotent. `down` drops only these new tables. `synchronize` remains false.

Shared schema 1 has no personal medical section. This API does not grant access to
cached medical data; existing consent revocation remains authoritative. It neither
adds medical data nor implements a fictitious sensitive-section purge mechanism.

## Verification

Use an explicit `TEST_DATABASE_URL` ending in `_test`, never a development seed.
Coverage includes three axes/read-only GET, artifact loss, reports/hash/ownership,
terminal and ongoing rejection, Porter-only confirmation, duplicate timestamps,
new requirement before departure, publication racing with locked departure,
transaction rollback, migration down and the legacy no-requirement scheduled start.
UI/evidence work and real CTMS-119 freshness are outside this Preparation + Logic task.

### Local results — 2026-11-12

- API unit regression: 195 suites, 2,367 tests passed (five new policy unit tests included).
- Related PostgreSQL/HTTP integration: four suites, 72 tests passed after the server
  notification follow-up. Includes real
  JWT and role guards with fixture user lookup, artifact storage fixtures, controlled
  freshness input, migration up/down and concurrent transactions on an isolated test database.
- Existing API E2E regression: four suites, 63 tests passed.
- TypeScript noEmit, API ESLint and Nest build passed.
- No frontend files or seed files changed; no development migration applied.
- Whole-repository gates, full API integration aggregate and remote CI are not
  claimed as passed by this task-specific run. Earlier task baseline failures are
  not silently converted into passing gates.

The full unit regression, related integration, typecheck, lint and build were rerun
after the server notification follow-up. Integration coverage also includes inbox
ownership, retry deduplication, notification rollback, concurrent workers and blocked
batch fairness. The full diff inventory includes newly created files; a plain
unstaged `git diff --stat` excludes them.
