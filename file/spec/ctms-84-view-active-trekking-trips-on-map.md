# CTMS-084 — View Active Trekking Trips on Map

## 1. Overview

Story: CTMS-084

Epic: EPIC 14. Host Operations and Monitoring

Use Case: View Active Trekking Trips on Map

Priority: Must Have

Goal: Allow Host to monitor authorized active Trips on an operational map using route/checkpoint context and the latest server-synced participant locations.

Backlog story: As a Host, I want to view active trekking Trips on a map so I can monitor ongoing Trip operations.

Acceptance Criteria:

| Source  | Criterion                                                                    |
| ------- | ---------------------------------------------------------------------------- |
| PB AC-1 | Host map displays active Trips within Host authorization scope.              |
| PB AC-2 | Map displays applicable Route/checkpoint operational context.                |
| PB AC-3 | Map displays applicable Trip members.                                        |
| PB AC-4 | Map displays assigned Porters.                                               |
| PB AC-5 | Map uses the latest synchronized location the Host is authorized to view.    |
| PB AC-6 | Location timestamp/state is visible.                                         |
| PB AC-7 | Stale/offline data is visually distinguished and not presented as real-time. |

## 2. Scope

### In Scope

- Active Trip operational map.
- Route/checkpoints.
- Members.
- Assigned Porters.
- Latest synced locations.
- Location freshness/state.

### Out of Scope

- Unsynced device-local locations.
- Historical breadcrumb analysis.
- Route editing.

## 3. Actors & Authorization

Primary actor:

- Host.

Host may view only Trips and participant information within authorized operational scope.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-066.
- Active Trip and applicable Route context exist.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-266 | The Host map must display active Trips together with the operational Route/Checkpoint context, members, assigned Porters, and the latest synchronized locations the Host is authorized to view.                                                                                             |
| BR-267 | Location data must clearly display timestamp and state. Stale/offline data must be visually distinguishable and must not be presented as real-time.                                                                                                                                         |
| BR-246 | For each eligible Trip member, the Host view must show the latest synchronized location, last_seen_at, and synchronized safety flags such as OFF_ROUTE, Checkpoint, or behind-schedule. Data still unsynced on the device must not be presented as though the server knows it in real time. |

## 6. State & Lifecycle

Map query
→ authorization
→ active Trips resolved
→ route/checkpoint context loaded
→ latest synced positions loaded
→ freshness/state classified
→ rendered.

## 7. Business Flow

1. Host opens operational map.
2. Resolve authorized active Trips.
3. Load Route/checkpoint context.
4. Load eligible members and assigned Porters.
5. Load latest synchronized location.
6. Determine timestamp/freshness/state.
7. Render entities on map.
8. Visually distinguish stale/offline information.

## 8. Data & Invariants

Location display includes applicable:

- latitude/longitude;
- last synchronized timestamp;
- synchronization/freshness state.

Unsynced local device location must not be represented as server-known current position.

## 9. API / Integration Contract

Implemented by **CTMS-369 — Preparation + Logic** (backend only).

- `GET /api/host/monitoring/active-trips?page=1&limit=20`
- `GET /api/host/monitoring/active-trips/:tripId/participants/:role/:participantId`

Both endpoints require an active authenticated Host and return `Cache-Control: private, no-store`.
Authorization uses the server-granted role and `trips.host_id`. Only `ONGOING` Trips are eligible.
Detail reads return the same 404 for missing participants, inactive Trips and out-of-scope Trips.
Invalid pagination, UUIDs or participant roles return 422. No authenticated session returns 401;
an authenticated non-Host returns 403.

List pagination applies to Trips, with deterministic `starts_at, id` ordering. `page` defaults to 1
(maximum 1,000,000), and `limit` defaults to 20 (maximum 100). `total` remains the full authorized
Trip count, including when the selected page is empty. Each Trip includes its current persisted
Route geometry, ordered Route checkpoints, and the applicable participants. No Route/Trip write,
lifecycle change, package generation or GPS/safety ingest change is performed by this projection.

Participants follow the existing GPS eligibility sources: booking members with `JOINED` or `LEFT`
status on `CONFIRMED`/`COMPLETED` bookings, plus Porters with `ASSIGNED` status in `trip_porters`.
Registered, removed, no-show and cancelled-booking members are excluded. Members without a linked
user remain visible with an unavailable location; no other member's location is substituted.
`participantId` is the booking-member ID for role `camper`, or the assigned user's ID for role
`porter`. Names and identifiers are included; contact details, health profiles and credentials
are excluded.

Response metadata includes `generatedAt`, `locationSource: "server_confirmed"`, and
`freshnessMaxAgeSeconds`. Each participant contains:

- `location`: nullable accepted GPS sample (`id`, latitude/longitude, `accuracyMeters`,
  `eventTime`, `receivedAt`). Latest means descending capture `event_time`, then `received_at`
  and ID for deterministic ties, scoped by Trip, user and participant role. A delayed upload
  of an older capture cannot replace the latest position.
- `lastSeenAt`: capture time of that latest accepted position, not upload time. This is the
  API's camelCase representation of `last_seen_at`; it is not a connection heartbeat.
- `locationAgeSeconds`: elapsed capture age at response generation, floored to seconds and
  clamped to zero for future captures; null when no position exists.
- `freshness`: `fresh` when capture age is between zero and the configured threshold inclusive;
  `stale` for older or future-dated captures; `unavailable` when no accepted location exists.
- `safety.route` and `safety.gps`: latest accepted transition in each independent event family,
  with its capture and receipt timestamps. Recovery transitions supersede earlier warnings.
- `safety.lastCheckpoint`: latest server-persisted checkpoint visit for that booking member,
  including arrival time and receipt (`created_at`) time.
- `safety.behindSchedule`: null because no authoritative behind-schedule source exists yet.
  Null safety context means unknown/unavailable, never an assertion that the member is safe.

`HOST_TRIP_MAP_FRESHNESS_MAX_AGE_SECONDS` defaults to **120 seconds** and must be a positive safe
integer. This is a configurable display threshold, not a change to GPS collection or Trip rules.
Fresh means a recent server-confirmed capture; neither endpoint claims real-time location or
infers online/offline connectivity. Unsynced local samples/events are absent from this projection.
Consumers must distinguish stale/unavailable state and recompute freshness or refetch as time
passes using the returned timestamps and threshold.

The read model uses one PostgreSQL statement snapshot for authorization, count, Route/checkpoints,
participants and synchronized context. Source/database errors fail the request rather than
fabricating an empty list or a safe state. OpenAPI response schemas are registered with both endpoints.

## 10. Error & Edge Cases

| Case                   | Expected Behavior                  |
| ---------------------- | ---------------------------------- |
| Active authorized Trip | Display                            |
| Unauthorized Trip      | Hide/reject                        |
| Latest location recent | Display with timestamp/state       |
| Location stale         | Visually mark stale                |
| Participant offline    | Do not claim real-time             |
| No synced location     | Show appropriate unavailable state |

## 11. Acceptance & Test Matrix

| Source | Scenario                 | Expected Result              | Test Type |
| ------ | ------------------------ | ---------------------------- | --------- |
| BR-266 | Active Trip              | Map context displayed        | E2E       |
| BR-266 | Assigned Porter          | Displayed                    | UI        |
| BR-267 | Stale position           | Marked stale                 | UI        |
| BR-267 | Offline participant      | Not represented as real-time | Safety    |
| BR-246 | Unsynced device location | Not shown as server-known    | Integrity |

## 12. Open Decisions

Exact visual freshness categories belong to UI/Technical Design unless defined elsewhere.

CTMS-369 supplies `fresh/stale/unavailable` as the backend contract above; visual treatment remains
outside this backend task. `trip_porters` is the existing assignment source (also used by GPS
participation); migrate this read source when an authoritative `porter_assignments` implementation
becomes available. Behind-schedule detection is a separate dependency and is not implemented here.

## 13. CTMS-369 Backend Verification

Verified locally on 2026-10-29:

- [x] Read-only map aggregation and participant detail implemented.
- [x] Host scope, active Trip filtering, synchronized data selection and freshness invariants covered.
- [x] Task-specific unit tests: 18 passed.
- [x] Task-specific PostgreSQL/HTTP integration tests: 9 passed on `ctms_test`, with database-name
  safety checks before fixture creation and cleanup.
- [x] Related GPS/safety/overview/map regression: 98 unit tests across 6 suites and 54 integration
  tests across 4 suites passed.
- [x] Complete backend unit suite: 1,558 tests across 137 suites passed.
- [x] Backend ESLint, TypeScript no-emit check, Nest build and Biome check for changed TypeScript passed.

Commands used from `services/api` (existing local dependencies):

```text
node node_modules/jest/bin/jest.js --config jest.config.js --runInBand --silent
node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand host-trip-map gps-tracking safety-events host-overview
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

Backend scripts `pnpm --filter @ctms/api lint` and `pnpm --filter @ctms/api build` passed from the
repository root. Initial sandboxed pnpm attempts could not reach the registry to verify its pinned
version; the authorized retries succeeded. No dependency/package-manager settings were changed.

Frontend/mobile, repository-wide `lint:all`/`build:all`/`test:all`, the full integration suite and
remote CI were not run for this backend-only task. Visual acceptance remains in the UI task.
No development seed/reset, migration, commit, push or PR creation was performed.


## 14. CTMS-370 Host Web Implementation

The Host sidebar entry and page heading are **Giám sát chuyến đi**, at
`/host/trip-map`. This naming was requested during UI review. The existing dashboard
keeps its Route/checkpoint overview. The monitoring page adds server-confirmed
participant markers, participant selection and permitted safety details.

- Selection belongs to `HostOperationalOverview` and uses `{ tripId, role, participantId }`.
  CTMS-374 can call the same selection callback from an alert list.
- Active map pages and participant detail use the CTMS-369 APIs, scoped by the current Host.
  Requests refresh every 30 seconds. The header refresh action updates Trips, locations
  and the selected participant detail. Participants missing from the refreshed list are deselected.
- Freshness uses `lastSeenAt` and the API's `freshnessMaxAgeSeconds`. A presentation clock
  updates every 15 seconds, including when the device loses connectivity. Labels, icons
  and timestamps distinguish fresh, stale and unavailable data.
- Initial bounds and **Xem toàn tuyến** include the Route/checkpoint area. Distant GPS
  never expands the initial viewport. Selecting a participant does not move the map.
  The explicit **Đến vị trí thành viên đã chọn** action navigates to that stored location.
- A location outside the padded Route bounds is labeled **Vị trí nằm ngoài khu vực tuyến**.
  This describes the viewport and does not create an authoritative OFF_ROUTE state.
  OFF_ROUTE and ON_ROUTE_RECOVERED details use the latest synchronized transition and
  original event time. Stale data carries a warning about its historical context.
- Missing/forbidden participant detail returns a Vietnamese unavailable/access message.
  HTTP 409 identifies a Trip that is no longer ongoing. Network failures offer retry.
- The list includes the Trip departure date to distinguish repeated titles. Participant
  numbers match the map markers even when another participant has no GPS location.

### Local GPS data and provenance

Read-only inspection of the development database found the existing monitoring Trip's
Camper GPS at `37.4219983, -122.084` and Porter GPS at `11.545, 108.445`, while its Route
starts near Hai Van at `16.185, 108.13`. These are existing local records. Their exact
capture source cannot be established from coordinates alone.

`apps/mobile/lib/features/gps_tracking/application/gps_location_source.dart` reads native
positions from Geolocator. Its Web path also supports explicitly assigned simulated
coordinates. The GPS ingest API validates coordinate ranges, timestamps and participation,
and stores accepted coordinates without verifying the physical origin of the device fix.
Therefore this task does not claim that emulator/mock GPS is confined to seed data or
that production ingest detects it. GPS provenance validation requires a separately agreed
mobile/API contract and is recorded here for specification-owner review.

The targeted `--host-monitoring-only` option in `services/api/src/seeds/main.seed.ts`
reuses the existing Host Trip and participants, adds/upserts dedicated GPS samples on
that Trip's Route, and records the Camper's recovery. The Trip display title becomes
**Chinh phục đèo Hải Vân**. Existing GPS and safety history is retained. Financial values,
account identifiers and Trip/Booking states are preserved. The automated mocked regression does not modify the database. A separate opt-in live
scenario uses `--host-monitoring-only --host-monitoring-far-location` to place only the
dedicated seed GPS rows at the remote coordinates and record a corresponding OFF_ROUTE
event. Running `--host-monitoring-only` restores the dedicated GPS rows to the Route and
records recovery. Original GPS/safety records and financial data are retained.

### Verification scope

Validation uses base commit `8daf79b0` plus the uncommitted CTMS-370 changes.

- Playwright with mocked API responses covers fresh/stale/missing locations, Porter
  detail without route events, selection changes, empty Trips, distant GPS, unchanged
  default Route bounds, explicit location focus and returning to the Route.
- An opt-in live Playwright test logs in as the existing local seed Host and verifies the
  seeded Hai Van Trip and Porter detail against the running API/database. Set
  `CTMS_370_LIVE_PASSWORD` from the configured local seed account before running that test.
- Screenshots and logs are stored in Git-ignored `test-results` directories.


### CTMS-370 validation results, 2026-11-16

All results below apply to the working changes based on `8daf79b0`.

| Command | Result |
| --- | --- |
| `pnpm --filter @ctms/web exec vitest run src/features/role-landing src/features/trekking-routes/components/RouteCheckpointMap.test.tsx src/features/trekking-routes/hooks/useMapViewport.test.tsx --reporter=dot` | 84/84 tests, 14/14 files |
| `pnpm --filter @ctms/web exec playwright test --config playwright.host-map.config.ts --grep-invert 'live API'` | 2/2 mocked API tests, 1 file |
| `pnpm --filter @ctms/web exec playwright test --config playwright.host-map.config.ts --grep 'live API'` | 1/1 live API/database test, 1 file, using the existing local seed Host credentials supplied through the environment |
| `pnpm --filter @ctms/web exec tsc -b` | Passed |
| `pnpm lint:all` | Passed, 0 errors and 10 warnings in existing web files |
| `pnpm build:all` | Passed |
| `pnpm test:all` | API 2,766/2,766 tests and 227/227 suites; web 1,911/1,911 tests and 285/285 files; AI 34/34 tests across 2 files |
| `git diff --check` | Passed |

The first targeted Vitest run passed 81/84 tests. Three existing Trip selection tests
still expected button names containing only the title after the UI added departure dates.
Their expectations were updated to include the exact displayed dates, and the same command
then passed 84/84. This was an expectation change caused by this UI update.

Five new unit tests cover route viewport classification, server-controlled freshness
boundaries, absent/future positions, expiry of cached positions, and date/relative formatting.
Four new Playwright tests cover the two mocked UI scenarios and two opt-in live API scenarios.
Native satellite-map evidence was captured during the live test, including selecting the
Porter and showing historical-location context without inventing a route event.

Generated logs and evidence are in Git-ignored `test-results/ctms-370`. Remote CI remains
pending until a task commit is pushed. Repository paths in future PR/Jira references should
be relative to the repository, or links to the corresponding GitHub revision.


### Live far-location evidence supplement

The far-location screenshot was initially captured with mocked API responses and an
intentionally disabled basemap in the isolated Playwright configuration. Following review,
the same scenario was also run against the actual local API/database and satellite basemap.

- `main.seed.ts --host-monitoring-only --host-monitoring-far-location` prepares the opt-in
  fixture using the existing accounts and Trip. The live Playwright test requires
  `CTMS_370_LIVE_FAR=1` and the existing local Host password in `CTMS_370_LIVE_PASSWORD`.
- `pnpm --filter @ctms/web exec playwright test --config playwright.host-map.config.ts --grep 'live API retains'`
  passed 1/1. It verifies that the Route's checkpoint remains within the native map viewport
  after selecting the distant participant, that the explicit focus action brings that marker
  into view, and that **Xem toàn tuyến** returns to the Route. Screenshots wait for the map's
  idle/tile-readiness signal.
- The selected-location control and legend were raised above the native canvas so they remain
  visible and operable with the satellite basemap. This refinement was checked with the live test.
- The fixture was restored by `main.seed.ts --host-monitoring-only` in a cleanup step after the
  live far-location run. The standard live test was rerun to capture restored Camper and Porter
  details. Images are in the ignored `test-results/ctms-370/evidence` directory.

The previously recorded full-repository gate results precede this live far-location seed option
and the native-map overlay stacking refinement. Targeted map regression and API TypeScript
checks were rerun for these additions. CI remains pending.

Supplement results confirm 1/1 standard live API test after restoration, 11/11 targeted
map/freshness tests in 2 files, and a passing API TypeScript no-emit check. Four live
satellite-map screenshots were retained for PR evidence.


### Large-group UI refinement, 2026-11-16

The uncommitted working tree remains based on `8daf79b0`.

- Participant markers use rectangular C/P labels, distinct from circular numbered
  checkpoints. Historical positions have a dashed border. The selected participant
  is rendered separately above other participant markers.
- Nearby participant markers are grouped by rendered area in the native map. Opening
  a group displays its participants without changing their stored coordinates.
  The fallback schematic also groups overlapping participant positions.
- The roster uses ten participants per page. Selection from a map group opens the
  corresponding roster page; polling preserves the page for an unchanged selection.
- An explicit **Quay lại tuyến** action restores the Route viewport after location focus.
- The roster uses larger, left-aligned status text and status icons. The outside-area
  warning has a dark foreground on a light amber background.

| Command | Result after the large-group refinement |
| --- | --- |
| `pnpm --filter @ctms/web exec vitest run src/features/role-landing/components/HostMonitoringParticipants.test.tsx src/features/role-landing/utils/participant-position.test.ts src/features/trekking-routes/utils/monitoring-marker-groups.test.ts --reporter=dot` | 11/11 tests, 3/3 files |
| `pnpm --filter @ctms/web exec vitest run src/features/role-landing src/features/trekking-routes/components/RouteCheckpointMap.test.tsx src/features/trekking-routes/hooks/useMapViewport.test.tsx src/features/trekking-routes/utils/monitoring-marker-groups.test.ts --reporter=dot` | 90/90 tests, 16/16 files |
| `pnpm --filter @ctms/web exec playwright test --config playwright.host-map.config.ts --grep-invert 'live API'` | 3/3 mocked API tests including a 25-participant Trip, before the final fallback-group interaction assertion |
| `pnpm --filter @ctms/web exec playwright test --config playwright.host-map.config.ts --grep 'live API renders'` | 1/1 live API/database test; refreshed Camper and Porter satellite-map screenshots |
| `pnpm --filter @ctms/web exec playwright test --config playwright.host-map.config.ts --grep 'live API retains'` | 1/1 live API/database distant-GPS test; main seed restored in finally |

The 25-participant and missing-position screenshots use mocked API responses and the
fallback schematic. They do not claim real-account load coverage. Native satellite-map
screenshots use the running API and existing seed accounts. No new accounts were created.


Final fallback interaction checks:

- The first fallback-group interaction run passed 2/3 scenarios. The 25-person scenario
  timed out because SVG pointer capture intercepted the marker click. Participant marker
  buttons now stop pointer-down propagation to the map drag handler. The same three
  scenarios then passed 3/3, including opening the group and selecting C25.
- One overlapping Playwright launch could not start because the previous run still owned
  port 5190. It did not execute a test; the sequential rerun above completed successfully.
- `pnpm --filter @ctms/web exec tsc -b` passed after the final fallback interaction fix.
- `pnpm --filter @ctms/web exec vitest run src/features/trekking-routes/components/RouteCheckpointMap.test.tsx src/features/role-landing/components/HostMonitoringParticipants.test.tsx --reporter=dot`
  passed 9/9 tests in 2/2 files after that fix.
- `pnpm --filter @ctms/web lint` passed after that fix.


Final build/lint results:

| Command | Result |
| --- | --- |
| `pnpm lint:all` | Passed, 0 errors and 10 warnings in existing web files |
| `pnpm build:all` | Passed |
| `pnpm --filter @ctms/web build` | Passed after the final fallback pointer-event fix |
| `git diff --check` | Passed |
| `git check-ignore test-results/ctms-370/evidence/host-map-live-porter.png` | Confirmed evidence is ignored |

Logs are retained as `lint-all-final.log`, `build-all-final.log`,
`lint-web-last.log`, `build-web-last.log`, and `test-all-final.log` under the ignored
`test-results/ctms-370` directory. No commit, push, remote CI run or PR creation is
claimed by these local results.


Final repository test gate completed successfully on the uncommitted CTMS-370 working
changes based on `8daf79b0`:

| Command | Final result |
| --- | --- |
| `pnpm test:all` | Exit 0. API 2,766/2,766 tests, 227/227 suites; web 1,917/1,917 tests, 287/287 files; AI 34/34 tests across 2 files, with 3 warnings |

The gate was running while the final fallback interaction refinement was applied.
The final map component was additionally checked after that refinement with the passing
TypeScript, 9/9 targeted unit tests, 3/3 mocked browser scenarios, web lint and web build
results recorded above. No further source edits followed those checks.


### Live large-group evidence and Vietnamese role labels

The roster, detail heading, marker accessible labels and map legend now use
**Người tham gia** and **Người hỗ trợ**. Legacy Camper/Porter prefixes are omitted from
participant display names. Internal API role values remain unchanged.

`main.seed.ts --host-monitoring-only --host-monitoring-group` adds the opt-in free
community Trip **Hành trình xanh Hải Vân**, with 24 existing Camper accounts and the
existing assigned Porter. It creates no user accounts. Only legacy generated account
names matching `Camper Demo [0-9]+` are replaced with natural Vietnamese names. The
primary Host and Camper accounts are reused. Existing booking/payment history is
preserved; the dedicated free Trip has its own zero-price, payment-not-required booking.
One participant has no GPS sample, and the others form nearby native-map groups.
Existing technical Trip titles shown in this view are updated by exact match to natural
Trip titles, preserving their IDs, statuses and financial records.

The first group seed attempt rolled back because a UUID parameter used in a text hash
required an explicit UUID cast in the inserted column. After correcting that cast, the
seed ran successfully and a repeated invocation also succeeded.

The first native group browser check exposed a popup closing immediately when the
click propagated to the underlying map. Marker clicks now stop propagation and the
popup does not close on that same map click. The live group test then passed.

| Command | Result on this refinement |
| --- | --- |
| `pnpm --filter @ctms/api exec ts-node --transpile-only src/seeds/main.seed.ts --host-monitoring-only --host-monitoring-group` | Passed, including repeated invocation, using existing accounts |
| `pnpm --filter @ctms/web exec playwright test --config playwright.host-map.config.ts --grep 'live API renders\|live API shows'` | 2/2 live API/database tests in 1 file; satellite basemap required for the group scenario, group selection and no-GPS participant verified |
| `pnpm --filter @ctms/web exec vitest run src/features/role-landing/components/HostMonitoringParticipants.test.tsx src/features/role-landing/utils/participant-position.test.ts --reporter=dot` | 8/8 tests in 2/2 files |
| `pnpm --filter @ctms/web exec vitest run src/features/trekking-routes/components/RouteCheckpointMap.test.tsx --reporter=dot` | 6/6 tests in 1/1 file |
| `pnpm --filter @ctms/web exec tsc -b` | Passed |
| `pnpm --filter @ctms/api exec tsc --noEmit` | Passed |
| `pnpm --filter @ctms/web lint` | Passed |

New real-API screenshots replace the earlier mocked screenshots for PR evidence:
`host-map-live-many-participants.png` and `host-map-live-no-position.png`. Updated
`host-map-live-camper.png` and `host-map-live-porter.png` show Vietnamese role labels.
They are retained under the ignored evidence directory. The full-repository test gate
reported above precedes this role-label, native popup and seed supplement; these changes
are covered by the targeted checks and live browser tests listed here.

Supplement completion: `pnpm --filter @ctms/web build` passed. `pnpm --filter @ctms/web exec playwright test --config playwright.host-map.config.ts --grep-invert 'live API'` passed 3/3 mocked regression scenarios in 1 file after the Vietnamese role-label and native-popup update. `git diff --check` passed.


### Dense roster review refinement

This section supersedes the earlier cluster-popup interaction description. Cluster
buttons now zoom into their area without selecting a participant. Numeric circular
badges use a shared configuration (52-pixel cells, minimum three unselected participants,
maximum zoom 18). The selected participant remains separate. Badge screen offsets reserve
space for checkpoint labels and other badges; connector lines/dots retain the GPS anchor.
Coincident locations can remain grouped at maximum zoom; individual selection remains
available through the searchable roster. No stored GPS coordinate is changed.

The roster has ten compact rows per page and no internal scrolling. It sorts absent
positions before stale positions, then fresh positions, followed by Vietnamese name.
Global C/P labels retain their source index across sorting and filtering. Search supports
Vietnamese names without accents; role and location-freshness filters are client-side.
The summary counts use the complete Trip roster, independently of filters and pagination.
The API paginates Trips, not participants; no backend pagination contract was changed.

Selected detail is before the roster and sticky during page scrolling. An off-page or
filtered selection has a pinned "Đang chọn" row. Selecting a marker opens its roster page,
clears filters if required, and scrolls to the selected row. Refresh preserves selection;
a participant removed from the current projection produces a notice before selection is
cleared. Alert severity filtering remains outside CTMS-370.

| Command | Result on the dense-roster refinement |
| --- | --- |
| `pnpm --filter @ctms/web exec tsc -b` | Passed |
| `pnpm --filter @ctms/web exec vitest run src/features/role-landing/components/HostMonitoringParticipants.test.tsx src/features/trekking-routes/components/RouteCheckpointMap.test.tsx src/features/trekking-routes/utils/monitoring-marker-groups.test.ts --reporter=dot` | 17/17 tests, 3/3 files |
| `pnpm --filter @ctms/web exec playwright test --config playwright.host-map.config.ts --grep-invert 'live API'` | 3/3 mocked API tests, 1 file; includes refresh preservation and participant removal |
| `pnpm --filter @ctms/web exec playwright test --config playwright.host-map.config.ts --grep 'live API renders\|live API shows'` | 2/2 live API tests, 1 file; includes native badge collision assertions, search, role filtering and no-GPS detail |

The first live rerun failed 0/2 because both tests assumed the first positioned roster
entry was a Camper. After prioritizing stale positions, that entry was the Porter. Test
selection was changed to explicit participant name/role; the same two scenarios passed.
No assertion was removed to bypass the new ordering.

Results apply to the uncommitted worktree based on `8daf79b0`. Full-repository gate results
above precede this UI refinement. UI review is pending before rerunning those gates.
Screenshots remain Git-ignored under `test-results/ctms-370/evidence`.

The final `--grep 'live API shows'` rerun passed 1/1, including `toBeInViewport()` for selected detail after scrolling to pagination. `host-map-live-sticky-detail.png` records that viewport. `git diff --check` passed.


### Coordinate anchoring and balanced desktop layout

This refinement supersedes the displaced-badge layout described above. Monitoring marker
containers now have zero geographic offset, with their visible GPS dot centered at the
projected coordinate. C/P labels stay immediately beside the point; nonselected labels
are hidden at distant zoom levels to reduce clutter. A group uses the mean coordinate
of its members. The fallback schematic also draws an explicit dot at the actual position.
No GPS data was modified. The old long connector lines and label displacement algorithm
were removed because they made low-zoom labels look geographically incorrect.

The participant roster is rendered in the left column below the Trip selector, sharing
the existing selection state with the map/detail column. It uses six rows per page,
without internal scrolling. The compact Trip selector shows the selected Trip and an
**Đổi chuyến** action. The left column is sticky on wide desktop screens; below the
wide breakpoint the layout becomes one column. Grid/flex children allow shrinking,
participant names wrap, and the search/filter controls stay within the column.

| Command | Result on this refinement |
| --- | --- |
| `pnpm --filter @ctms/web exec tsc -b` | Passed |
| `pnpm --filter @ctms/web exec vitest run src/features/role-landing/components/HostMonitoringParticipants.test.tsx src/features/role-landing/components/HostOperationalOverview.test.tsx src/features/trekking-routes/components/RouteCheckpointMap.test.tsx src/features/trekking-routes/utils/monitoring-marker-groups.test.ts --reporter=dot` | 19/19 tests, 4/4 files |
| `pnpm --filter @ctms/web exec playwright test --config playwright.host-map.config.ts --grep-invert 'live API'` | 3/3 mocked UI scenarios, 1 file, before the final fallback-dot JSX update |
| `pnpm --filter @ctms/web exec playwright test --config playwright.host-map.config.ts --grep 'live API keeps desktop\|live API shows'` | 2/2 live API scenarios, 1 file; 1440x900, 1280x900 and 1024x768 layouts, no document horizontal overflow, native map within viewport, centered GPS pin after zooming out |

During the fallback-dot edit an unmatched JSX wrapper caused TypeScript parsing to fail
and one of four Vitest files to fail compilation (13 executed tests passed in the other
three files). The wrapper was corrected. The same TypeScript and four-file command then
passed with 19/19 tests. This was a local edit error, not a baseline failure.

Evidence includes `host-map-live-many-participants.png`, `host-map-live-zoomed-out.png`
and desktop-width screenshots in the ignored evidence directory. These results apply
to the uncommitted worktree based on `8daf79b0`; full-repository gates await UI approval.

The mocked Playwright command was rerun after the final fallback-dot edit and passed 3/3 scenarios. The final live API pair also passed 2/2 after that edit. `git diff --check` passed. No commit or push was performed.


### Trip switch affordance and contextual map help

Both Trip-switch states now use a visible outlined button, light green background,
bold label and chevron, with `aria-expanded` reflecting the expanded list.

Map help is below the map/detail area. Fixed illustrative cluster numbers were removed.
The widget reports its rendered group sizes on initial render, selection and map movement;
the help displays those current values. Trips without a group instead describe selecting
individual positions, and Trips without positions show the corresponding empty guidance.
The helper text distinguishes dark participant clusters from numbered orange checkpoints.

Validation on the uncommitted working tree based on `8daf79b0`:
- `pnpm --filter @ctms/web exec tsc -b`: passed.
- `pnpm --filter @ctms/web exec vitest run src/features/trekking-routes/components/RouteCheckpointMap.test.tsx --reporter=dot`: 6/6 tests, 1/1 file.
- `pnpm --filter @ctms/web exec playwright test --config playwright.host-map.config.ts --grep 'live API renders\|live API shows'`: 2/2 live API tests, 1 file. Verified expanded button state, guidance below the map, text matching rendered group counts, and individual guidance on the two-person Trip.
- `git diff --check`: passed.

Updated screenshots, including `host-map-live-trip-selector-expanded.png`, are retained
in the ignored evidence directory. No full-repository gate was rerun in this UI review.
No commit or push was performed.


### Approved UI repository gates, 2026-11-16

User approved running the gates after the final contextual map help and Trip-switch
button review. Tested state: uncommitted CTMS-370 changes on `8daf79b0`. SHA-256 records
for 28 changed code/config files are retained in the ignored
`approved-ui-code-snapshot.json`; no file changed during the gates.

| Command | Result |
| --- | --- |
| `pnpm lint:all` | PASS, exit 0; 0 errors, 10 warnings in unchanged web files |
| `pnpm build:all` | PASS, exit 0 |
| `pnpm test:all` | FAIL, exit 1. API 2,766/2,766 tests in 227/227 suites; AI 34/34 tests in 2 files; web 1,920/1,921 tests in 286/287 passing files, 1 failed file |
| `pnpm validate-branch` | PASS |
| `git diff --check` | PASS |

Full logs are retained under the ignored `test-results/ctms-370` directory as
`lint-all-approved-ui.log`, `build-all-approved-ui.log` and `test-all-approved-ui.log`.
The full test gate is not marked as passing merely because its failed file passed alone.

#### Weather fixture failure investigation

Failure: `WeatherDecisionComponents.test.tsx:190`, case "locks the form once an Admin
acted, shows the pause and the decision log". It could not find the Admin-lock message.
The fixture calls `log()` separately to obtain the Admin decision's `tripStartsAt` and
the log's `startsAt`. Both use `Date.now() + 40 * HOUR`. A millisecond boundary makes
the values unequal, while the unchanged component intentionally compares exact strings.

- `pnpm --filter @ctms/web exec vitest run src/features/weather-decisions/components/WeatherDecisionComponents.test.tsx --reporter=dot`: 11/11 passed in 1/1 file on the current worktree.
- The web source/config was extracted with `git archive` at `8daf79b0` into the ignored `test-results/ctms-370/weather-baseline` directory. Existing dependencies were reused through a directory junction; no checkout, branch or tracked source was changed.
- `pnpm --filter @ctms/web exec vitest run --root C:/Users/win/.codex/worktrees/ctms-373/CTMS/test-results/ctms-370/weather-baseline/apps/web --config C:/Users/win/.codex/worktrees/ctms-373/CTMS/test-results/ctms-370/weather-baseline/apps/web/vitest.config.ts src/features/weather-decisions/components/WeatherDecisionComponents.test.tsx --reporter=dot`: 11/11 passed on the unmodified baseline.
- An isolated `vitest.clock-probe.config.ts` adds a setup that increments `Date.now()` by one millisecond per call. This is diagnostic instrumentation, not an uninstrumented baseline failure.
- `pnpm --filter @ctms/web exec vitest run --root C:/Users/win/.codex/worktrees/ctms-373/CTMS/test-results/ctms-370/weather-baseline/apps/web --config C:/Users/win/.codex/worktrees/ctms-373/CTMS/test-results/ctms-370/weather-baseline/apps/web/vitest.clock-probe.config.ts src/features/weather-decisions/components/WeatherDecisionComponents.test.tsx --testNamePattern 'locks the form once an Admin acted' --reporter=dot`: reproduced the same failure at line 190 on baseline source; 1 failed, 10 skipped.
- The baseline test file was confirmed byte-identical to the current tracked source before the experiment. Adding `startsAt` to the fixture's `log({...})` override only in the ignored extracted copy made the same clock-probe command pass: 1 passed, 10 skipped. Assertions were unchanged.

Logs: `weather-decisions-rerun.log`, `weather-baseline-natural.log`,
`weather-baseline-clock-probe.log`, `weather-baseline-clock-probe-fixed.log`.
The production weather component and tracked weather test remain unchanged because
this is outside CTMS-370. Proposed repair is to reuse the already captured `startsAt`
in that test's log fixture. No commit or push was performed. Remote CI is pending.

User review decision: retain the out-of-scope weather test unchanged, disclose the failed full-test gate and diagnostic evidence in the PR, and proceed with committing/pushing CTMS-370. The user will review the prepared PR form and create the PR themselves.
