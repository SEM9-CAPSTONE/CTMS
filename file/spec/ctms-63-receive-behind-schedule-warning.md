# CTMS-063 — Receive Behind-Schedule Warning

## 1. Overview

Story: CTMS-063

Epic: EPIC 9. GPS Navigation and Route Deviation

Use Case: Receive Behind-Schedule Warning

Priority: Should Have

Goal: Detect meaningful delay against available planned/estimated Trip progress and provide actionable safety guidance.

Backlog story: As a Camper, I want to know when I am behind schedule so I can take the appropriate safety action.

Acceptance Criteria:

| Source  | Criterion                                                                  |
| ------- | -------------------------------------------------------------------------- |
| PB AC-1 | System compares planned/estimated progress with actual available progress. |
| PB AC-2 | When user is behind schedule, system issues an applicable warning.         |
| PB AC-3 | Warning provides nearest safe checkpoint.                                  |
| PB AC-4 | Guidance states the action required by operational policy.                 |

## 2. Scope

### In Scope

- Planned/estimated progress.
- Actual progress.
- Behind-schedule evaluation.
- Safe checkpoint.
- Operational guidance.

### Out of Scope

- OFF_ROUTE detection.
- Route modification.
- Inventing a new Trip schedule.

## 3. Actors & Authorization

- Camper.
- Safety subsystem.

## 4. Preconditions & Dependencies

Applicable Trip itinerary/progress data is available.

Approved V3 approach (see §13): "behind" means **lagging behind the Porter/group**, not behind a planned timetable. Dependencies:

- CTMS-056 — Porter checkpoint arrival confirmation (`checkpoint_visits`) provides the baseline time.
- CTMS-059 — Camper GPS breadcrumbs (`gps_logs`) provide the Camper's actual progress.
- CTMS-060 — VALID sample rule (accuracy ≤ 20 m) and GPS-degraded rule are reused.
- CTMS-061 (optional) — once implemented, an auto-detected Camper arrival also counts as "passed".

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-241     | The system must compare planned/estimated progress with actual progress using available data. When the user is behind schedule, the system must provide the nearest safe Checkpoint and guidance that clearly states the action required under operational policy. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                              |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                       |

## 6. State & Lifecycle

On schedule
→ progress comparison indicates applicable delay
→ behind-schedule warning.

Recovery behavior follows the authoritative operational policy.

## 7. Business Flow

1. Load planned/estimated progress.
2. Read actual progress.
3. Compare according to approved calculation.
4. Determine whether behind-schedule condition exists.
5. Find nearest applicable safe checkpoint.
6. Resolve operational action from policy.
7. Warn Camper.
8. Preserve event/context where required.

## 8. Data & Invariants

- Actual progress must come from available authoritative/local operational data.
- Warning must not fabricate a safe checkpoint.
- Action guidance comes from policy.
- LLM must not invent or override hard safety policy.

## 9. API / Integration Contract

Defined by CTMS-063-T01 (Jira CTMS-319); see §14 for the contract.

## 10. Error & Edge Cases

| Case                              | Expected Behavior                                        |
| --------------------------------- | -------------------------------------------------------- |
| Progress insufficient to evaluate | Do not fabricate behind-schedule result                  |
| User behind schedule              | Warning shown                                            |
| No safe checkpoint resolvable     | Do not invent one; apply approved fallback policy        |
| Offline                           | Use locally available authoritative data where supported |

## 11. Acceptance & Test Matrix

| Source | Scenario             | Expected Result          | Test Type |
| ------ | -------------------- | ------------------------ | --------- |
| BR-241 | Progress on schedule | No false warning         | Detection |
| BR-241 | Progress behind      | Warning                  | Detection |
| BR-241 | Warning generated    | Safe checkpoint included | Safety    |
| BR-241 | Warning generated    | Policy action included   | Safety    |

## 12. Open Decisions

The retrieved source does not define a numeric behind-schedule threshold in BR-241. Do not invent one; the threshold/calculation must come from authoritative PB/configuration if separately defined.

**Resolved 2026-10-31:** the team (leader-approved) chose the "lagging behind the Porter" calculation and the 30/60-minute thresholds described in §13. §13 is authoritative for V3 and supersedes the generic wording in §6, §7, §10 and §11 where they differ. Items still open are listed in §13.10.

## 13. Approved V3 Approach — Lagging Behind the Porter (decided 2026-10-31)

### 13.1 Why not a planned timetable

- Route/Trip waypoints currently store only locations, not times: the web Route form always sends `checkpoints.expected_arrival_offset = 0`, and `trip_waypoints.planned_at` is normally empty. A timetable comparison would therefore have no data.
- Decision: use the moment the **Porter confirms arrival at a Checkpoint** as the reference time, and check whether each Camper has reached that Checkpoint using the **Camper's own GPS**.
- (For reference only: if a planned time is ever used, `expected_arrival_offset` is in **minutes** from Trip start.)

### 13.2 Definitions

| Term | Definition |
| ---- | ---------- |
| Porter baseline `T(X)` | Earliest `checkpoint_visits.arrived_at` for `(trip_id, checkpoint_id = X)` recorded by a Porter confirmation (CTMS-056). |
| Camper passed `X` | The Camper has a VALID GPS sample (`gps_logs.accuracy_meters ≤ 20`) within **20 m** of `X` (same fixed V3 distance as BR-239), **or** a VALID sample within the on-route corridor (≤ 50 m from the Route line) whose position along the Route is beyond `X`, **or** (once CTMS-061 exists) an auto-detected Camper arrival at `X`. Samples taken before `T(X)` also count, because a Camper may be ahead of the Porter. |
| Lag | `now − T(X)` for the **earliest** (lowest `route_position`) Porter-confirmed Checkpoint that the Camper has not passed. |
| Location unknown | The Camper has not passed `X` and has no VALID sample in the last 120 s (the CTMS-060 GPS_DEGRADED rule), or has no samples at all. |

**Important:** a Porter confirmation currently writes `checkpoint_visits` rows for **all** joined members with the same `arrived_at`, because mobile never sends `memberIds`. These rows prove only where the **Porter** was. They must **not** be used as evidence that a Camper passed a Checkpoint.

### 13.3 Warning levels (per Camper, per Checkpoint)

| Level | Condition | Meaning | Guidance (fixed V3 text, Vietnamese UI) |
| ----- | --------- | ------- | --------------------------------------- |
| `BEHIND` | Lag ≥ 30 min, Camper not passed `X`, location known | Reminder: Camper is falling behind the group | "Bạn đang chậm hơn đoàn khoảng {n} phút (Porter đã tới {X}). Hãy tiếp tục theo tuyến tới {safe checkpoint} và liên hệ Porter." |
| `SEVERELY_BEHIND` | Lag ≥ 60 min, Camper not passed `X`, location known | Equivalent to "past turnaround time" | "Bạn đã tụt lại sau đoàn hơn 60 phút. Dừng tại {safe checkpoint} và chờ Porter hướng dẫn. Porter sẽ quyết định đi tiếp hay quay về; Host đã được thông báo." |
| `LOCATION_UNKNOWN` | Camper not passed `X`, location unknown (§13.2) | Cannot evaluate | "Không xác định được vị trí của bạn." **Never** reported as behind. |
| none | Camper passed `X`, no Porter baseline yet, or lag < 30 min | On track | No warning |

- 30 and 60 minutes are V3 constants, not user-configurable, consistent with the fixed CTMS-060 thresholds.
- Each level is raised **at most once** per `(trip, camper, checkpoint, level)`. When the Camper later passes `X`, the warning clears, and evaluation moves to the next Porter-confirmed Checkpoint.

### 13.4 Safe checkpoint (PB AC-3)

- A safe Checkpoint is one with type `rest`, `water`, `emergency_shelter` or `finish`, **or** with `nearby_water_or_shelter = true`.
- `BEHIND`: the nearest safe Checkpoint **ahead** of the Camper along the Route. This is often `X` itself, where the Porter is.
- `SEVERELY_BEHIND`: the nearest safe Checkpoint in **either direction**, measured from the Camper's last VALID position.
- None found: do **not** invent one. Use the fallback text: "Không có checkpoint an toàn gần đây. Dừng ở nơi an toàn, giữ liên lạc với Porter."

### 13.5 Who sees it and who decides (PB AC-4)

- **Camper:** sees their own warning and guidance.
- **Porter (on site):** sees which members are `BEHIND` / `SEVERELY_BEHIND` / `LOCATION_UNKNOWN`. At `SEVERELY_BEHIND` the **Porter decides on site** whether the group continues or turns back.
- **Host:** sees the same statuses on the member-monitoring view (CTMS-084/085) and contacts the Porter if needed.
- Recording the continue/turn-back decision in the system is **out of scope**; it would need a separate story. Push notifications are out of scope for CTMS-319.

### 13.6 Known limitations (accepted by the team)

- If the whole group, Porter included, is late against any plan, **no** warning is raised; this feature detects stragglers only.
- No Porter confirmation at `X` means no baseline, so there is no evaluation for `X`.
- The feature depends on the Camper enabling GPS tracking. Without GPS the status is `LOCATION_UNKNOWN`, never "behind".

### 13.7 Data and storage

- Read-only inputs:
  - `checkpoint_visits`, for the Porter baseline only;
  - `gps_logs`, for Camper samples, `participant_role = 'camper'`;
  - `checkpoints`: `location`, `type`, `nearby_water_or_shelter`, `route_position`;
  - the Trip's Route geometry.
- Raised `BEHIND` / `SEVERELY_BEHIND` warnings are stored as a new `BEHIND_SCHEDULE` type in `safety_events` (CTMS-060), keyed uniquely by `(trip, member, checkpoint, level)` for idempotency.
- The leader asked to avoid changing the trips/route modules. Implement this in a **new read-only module**; do not modify `checkpoint_visits` or the Porter confirmation flow.

### 13.8 API (proposed)

`GET /api/trips/:tripId/schedule-progress`

- A Camper receives their own status.
- A Porter or Host of the Trip receives every member's status.
- Each status contains:
  - `status`: `ON_TRACK` | `BEHIND` | `SEVERELY_BEHIND` | `LOCATION_UNKNOWN`;
  - the reference Checkpoint and `T(X)`;
  - `lagMinutes`;
  - the safe Checkpoint, or `null` together with the fallback text;
  - the guidance text;
  - `lastValidSampleAt`.

### 13.9 Test scenarios

| Scenario | Expected |
| -------- | -------- |
| Porter confirms `X`; Camper has a VALID sample ≤ 20 m from `X` | `ON_TRACK` |
| Camper passed `X` before the Porter did | `ON_TRACK` |
| 29 min after `T(X)`, Camper not passed, GPS fresh | `ON_TRACK` (boundary) |
| 30 min after `T(X)`, Camper not passed, GPS fresh | `BEHIND`, safe checkpoint ahead |
| 60 min after `T(X)`, Camper not passed, GPS fresh | `SEVERELY_BEHIND`, nearest safe checkpoint either direction |
| 60 min, Camper's last VALID sample older than 120 s | `LOCATION_UNKNOWN`, no behind warning |
| Only INVALID samples (accuracy > 20 m) near `X` | Not passed |
| Porter-created `checkpoint_visits` row exists for the Camper, but no Camper GPS near `X` | Not passed (rows are not Camper evidence) |
| No Porter confirmation yet | No evaluation, `ON_TRACK` |
| No safe Checkpoint on the Route | Fallback text, no fabricated checkpoint |
| Same level evaluated twice | One `safety_events` row |
| Camper passes `X` after a warning | Warning cleared; next Checkpoint evaluated |

### 13.10 Still open (confirm during the CTMS-319 plan)

1. Whether the 30-minute `BEHIND` reminder is kept; the team said it is optional. Default: keep it.
2. Exact guidance wording in §13.3 and §13.4.
3. Server-side "location unknown" window: GPS breadcrumbs are uploaded in batches, so 120 s may be too strict when evaluated on the server. Confirm the window against the actual upload interval.
4. Which Checkpoint types count as safe (§13.4).

### 13.11 Resolutions of §13.10 (approved with the CTMS-319 plan, 2026-11-06)

1. The 30-minute `BEHIND` reminder is kept.
2. The guidance text is used verbatim from §13.3 and §13.4.
3. The server-side "location unknown" window is **5 minutes**, a fixed V3 constant. Breadcrumbs are logged every 30 s (`GPS_LOGGING_INTERVAL_SECONDS`) and uploaded in batches, so the on-device 120 s rule would flag Campers who are walking normally.
4. The safe Checkpoint types are as in §13.4: `rest`, `water`, `emergency_shelter`, `finish`, or `nearby_water_or_shelter = true`.
5. The device-sync counts (CTMS-067) exclude `BEHIND_SCHEDULE` rows, because a server-raised warning is not a device upload.
6. The `behindSchedule: null` placeholder in the Host Trip map is left for the UI subtask (CTMS-063-T02) or CTMS-084/085.

## 14. Implementation Record — CTMS-063-T01 (Jira CTMS-319), Preparation + Logic

Backend only (`services/api`), in the new read-only module `schedule-progress`. Neither the trips/route modules nor the Porter confirmation flow (CTMS-056) changed.

**API:** `GET /api/trips/:tripId/schedule-progress` (Bearer; roles Camper, Porter, Host)

- **Access:**
  - Trip Host or assigned Porter: `viewer: "team"`, every joined Camper.
  - Trip Camper: `viewer: "camper"`, only their own entry.
  - Anyone else: 403. Unknown Trip: 404. Malformed id: 422. No token: 401.
- **Response:** `tripId`, `tripStatus`, `evaluatedAt`, `viewer`, `configVersion: "v3"`, `thresholds { behindLagMinutes: 30, severelyBehindLagMinutes: 60, locationUnknownAfterMinutes: 5 }`, and `members[]`. Each member has `userId`, `fullName`, `status` (`ON_TRACK | BEHIND | SEVERELY_BEHIND | LOCATION_UNKNOWN`), `reference { checkpointId, checkpointName, porterArrivedAt }`, `lagMinutes`, `safeCheckpoint { id, name, type } | null`, `guidance`, `lastValidSampleAt` and `levelsReached`.
- When the Trip is not `ongoing`, `members` is empty and nothing is evaluated or stored.

**Calculation** (`schedule-progress.evaluator.ts`, a pure function; database facts come from `schedule-progress.repository.ts`)

- **Porter baseline:** `T(X) = MIN(checkpoint_visits.arrived_at)` per Checkpoint of the Trip.
- **"Camper passed X"** uses only the Camper's own VALID `gps_logs` (`participant_role = 'camper'`, `accuracy_meters ≤ 20`). A sample counts when it is either:
  - within 20 m of `X` (`ST_DWithin`), or
  - within the 50 m on-route corridor and further along the Route than `X` (`ST_LineLocatePoint`).

  Samples taken before `T(X)` also count. `checkpoint_visits` rows are never used as Camper evidence.
- **Reference:** the earliest Porter-confirmed Checkpoint along the Route that the Camper has not passed. Lag = whole minutes of `now − T(X)`.
- **Status:**
  - No fresh VALID sample (older than 5 minutes, or none) → `LOCATION_UNKNOWN`, never "behind".
  - Lag of 30 minutes or more → `BEHIND`.
  - Lag of 60 minutes or more → `SEVERELY_BEHIND`.
  - Otherwise → `ON_TRACK`.
- **Safe Checkpoint:**
  - `BEHIND`: the first safe Checkpoint ahead of the Camper's position along the Route. If the Camper is outside the corridor, "ahead" starts at `X`.
  - `SEVERELY_BEHIND`: the nearest safe Checkpoint in either direction from the last VALID position (haversine).
  - None found: `safeCheckpoint: null` and the §13.4 fallback text. A Checkpoint is never invented.

**Storage** (migration `1794300000000-AddBehindScheduleSafetyEvents`)

- Adds `BEHIND_SCHEDULE` to `safety_event_type`, a new enum `behind_schedule_level (BEHIND, SEVERELY_BEHIND)`, and the columns `safety_events.checkpoint_id` (FK `checkpoints`) and `warning_level`.
- `CHK_safety_events_behind_schedule`: a row is `BEHIND_SCHEDULE` exactly when both new columns are set.
- Unique partial index `UQ_safety_events_behind_schedule (trip_id, user_id, checkpoint_id, warning_level) WHERE checkpoint_id IS NOT NULL`. The predicate is on `checkpoint_id` because index predicates must be IMMUTABLE; the CHECK makes the two conditions equivalent.
- On each evaluation, every level reached is written once with `INSERT … ON CONFLICT DO NOTHING`:
  - `event_time = T(X) + 30/60 min`, so a re-evaluation describes the same warning;
  - location and accuracy come from the last VALID sample;
  - `route_id` / `route_version` come from the Trip's Route, with `config_version 'v3'`.
- A warning "clears" because the status is derived on every read. History rows are kept.
- `BEHIND_SCHEDULE` is deliberately **not** added to the TypeScript `SafetyEventType`, so `POST /safety-events` cannot accept client-forged warnings.
- `device-sync.repository.ts`: both safety-count queries exclude `BEHIND_SCHEDULE` (§13.11-5).

## 15. Test Evidence — CTMS-063-T01

- **Unit:**
  - `schedule-progress.evaluator.spec.ts` (13):
    - passed via own GPS; no Porter baseline;
    - 29 / 30 / 60-minute boundaries with safe-Checkpoint selection and verbatim guidance;
    - stale sample (more than 5 minutes) and missing sample → `LOCATION_UNKNOWN`; exactly 5 minutes is still known;
    - no safe Checkpoint → fallback;
    - earliest unpassed Checkpoint; moving on after passing;
    - off-corridor "ahead"; safe types.
  - `schedule-progress.service.spec.ts` (9): Host, Porter and Camper scoping; unassigned Porter and stranger refused; 404; non-ongoing Trip; each level recorded once with its timestamp; only Porter-confirmed Checkpoints are queried.
  - Full `pnpm test`: 2037/2039 passed. The 2 failures are in `offline-packages/package-readiness.spec.ts` (CTMS-221, merged in #819) and fail identically on `develop` with this task stashed.
- **Integration** (`test/schedule-progress.integration-spec.ts`, real Postgres + PostGIS, every §13.9 scenario): 16/16 passed.
  - Within 20 m → `ON_TRACK`.
  - Passed before the Porter → `ON_TRACK`.
  - 29 minutes → `ON_TRACK`; 30 minutes → `BEHIND` with the safe Checkpoint ahead and the policy text.
  - 60 minutes → `SEVERELY_BEHIND` with the nearest safe Checkpoint behind the Camper.
  - Stale GPS → `LOCATION_UNKNOWN` and no row.
  - INVALID sample at `X` → not passed. Porter-written `checkpoint_visits` → not passed.
  - No baseline → `ON_TRACK`. No safe Checkpoint → fallback.
  - 5 concurrent evaluations plus 1 more → exactly 2 rows.
  - Recovery moves on to the next Checkpoint.
  - Server rows are not counted as device events.
  - Authorization (Camper only self; Host and Porter all; other Host and stranger 403; 404; 401); non-ongoing Trip.
  - The DB CHECK rejects an incomplete `BEHIND_SCHEDULE` row.
  - Mutation check: relaxing the VALID-sample accuracy to 1000 m made the INVALID-sample test fail. The code was then restored.
  - Full `pnpm test:integration` (8 shards): 652/680 passed. All 28 failures are pre-existing on `develop`, with identical counts when this task is stashed:
    - `sync-evaluation` ×4, `overbooking-evaluation` ×4, `trekking-route-checkpoints` ×2, `incidents.report` ×1 (the known list);
    - `trip-reviews` ×1 (CTMS-387) and `review-analysis` ×16 (CTMS-411): 17/17 identical on `develop`.
    - Shard 1 crashed Jest once (a known issue on this machine) and passed 53/53 on rerun.
- `pnpm build` and `pnpm lint` pass; biome is clean on all new files.
- Backend-only task: no UI, so no screenshots.

### Logic Subtask DoD

- [x] Logic implementation completed.
- [x] Applicable business rules and invariants implemented (BR-241 per §13; BR-212 spec updated; BR-213 valid and violation paths, with integration tests for idempotency and concurrency).
- [x] Task-specific unit tests added or updated.
- [x] Task-specific unit tests passed.
- [x] Applicable backend or integration tests passed.

## 16. Implementation Record — CTMS-063-T02 (Jira CTMS-320), Camper/Porter mobile + Host web UI

The clients consume `GET /api/trips/:tripId/schedule-progress` (§14). Every status, lag, reference Checkpoint, safe Checkpoint and guidance text comes from the server evaluation. The clients never compute or invent a warning.

**Mobile (`apps/mobile/lib/features/schedule_progress`)**

- `ScheduleProgressController`:
  - loads on open and refreshes every 60 s (approved cadence);
  - on a failed refresh it keeps the last successful evaluation and marks it stale ("Không cập nhật được — đang hiển thị dữ liệu lúc HH:mm"), so offline never produces a new or fabricated warning.
- **Camper:** `CamperScheduleProgressPanel` ("Tiến độ so với đoàn") sits under the route-deviation panel on the Camper Trip screen. States:
  - **loading**;
  - **normal** (`ON_TRACK` badge and the last Porter-confirmed Checkpoint);
  - **warning** (`BEHIND` → warning banner, `SEVERELY_BEHIND` → danger banner, with the server guidance verbatim, the Porter reference and "Điểm an toàn: …", or "không có checkpoint an toàn gần đây");
  - **unavailable** (`LOCATION_UNKNOWN` → info banner "Chưa đánh giá được tiến độ", never presented as behind; Trip not running; not checked in);
  - **error** (retry).
- **Porter:** `PorterTeamProgressPanel` ("Tiến độ thành viên") sits in `PorterGpsTrackingSection` for the selected Trip. It lists every joined Camper most urgent first (SEVERELY_BEHIND, BEHIND, LOCATION_UNKNOWN, ON_TRACK), with a status badge, the reference Checkpoint, the lag and the safe Checkpoint, so the Porter can decide on site (§13.5).
- Reuses `CtmsSectionCard`, `CtmsAlertBanner`, `CtmsStatusBadge` and `CtmsButton`. `CtmsSectionCard` is always white, so text inside it uses `AppColors.text*` like the card title. This was found and fixed while capturing dark-theme evidence.

**Web Host (`apps/web/src/features/schedule-progress`)**

- `TeamScheduleProgressCard` ("Tiến độ thành viên so với Porter") is shown at the top of the "Điểm danh & Hoàn tất" tab of the Trip detail page while the Trip is `ongoing`.
- It uses the same ordering and fields as the Porter view, the shared `StatusBadge`, a refresh every 60 s through React Query, and a manual "Làm mới" button.
- States: loading, list, Trip not running, no checked-in Camper, first-load error, and failed refresh (keeps the last data with "Đang hiển thị dữ liệu lúc HH:mm").
- E2E harness: `tests/e2e/ctms-63-t02-behind-schedule-warning.spec.ts` was added to `playwright.sos-realtime.config.ts` and excluded from the default config.

**Judgment calls** (approved with the plan): the Host card sits in the roster tab; the Porter view is mobile only; refresh every 60 s.

## 17. Test Evidence — CTMS-063-T02

- **Flutter widget tests** (`test/features/schedule_progress/schedule_progress_panels_test.dart`, 10):
  - Camper: loading; on track; BEHIND verbatim guidance and safe Checkpoint; SEVERELY_BEHIND fallback; LOCATION_UNKNOWN never "behind"; Trip not running; error then retry; a failed refresh keeps the last evaluation as stale.
  - Porter: urgency ordering with lag and safe Checkpoint; empty state.
  - `flutter analyze` reports no issue in the changed files. The 7 remaining infos/warnings are pre-existing in other files.
  - Full `flutter test`: the only failure is `widget_test.dart › porter overview renders dashboard UI` ("CA HÔM NAY" not found), which fails identically on `develop` with this task stashed.
- **Vitest** (`TeamScheduleProgressCard.test.tsx`, 7): loading; ordering and server texts; on-track Campers show no lag or safe Checkpoint; no-safe-Checkpoint wording; Trip not running and no members; first-load error and retry; failed refresh keeps stale data. Full web `vitest run`: 1575/1575 passed.
- **E2E (real API + PostGIS)**, `pnpm --filter @ctms/web test:e2e:sos-realtime`: 7/7 passed, including the new CTMS-063 test.
  - The Host sees 4 seeded Campers in order:
    - SEVERELY_BEHIND, 65 min after the Porter reached "Đèo Gió", safe Checkpoint "Trạm nghỉ suối", verbatim guidance;
    - BEHIND, 35 min after "Trạm nghỉ suối";
    - LOCATION_UNKNOWN, with no lag shown;
    - ON_TRACK.
  - After a manual refresh, the database holds exactly BEHIND + SEVERELY_BEHIND for the first Camper and BEHIND for the second.
- **Screenshots:**
  - `host-team-schedule-progress.png` (Playwright, running app);
  - widget-rendered with the app dark theme and Roboto at 412 dp wide: `camper-behind.png`, `camper-severely-behind.png`, `camper-location-unknown.png`, `camper-on-track.png`, `porter-team.png`.

  No Android emulator is available on this machine, so the mobile images come from the real widgets, captured by a temporary test that was deleted afterwards. The black boxes on the "Làm mới" button exist only in that capture, because the button font is not available to the test renderer.
- **Gates**
  - `pnpm lint:all`: 0 errors (12 pre-existing warnings, none in changed files).
  - `pnpm build:all`: passed.
  - `pnpm test:all`:
    - API 2037/2039; the 2 `offline-packages` (CTMS-221) failures are pre-existing on `develop`;
    - web 1575/1575.
  - Default Playwright regression: 41 passed, 36 failed, 32 did not run — identical counts to the `develop` baseline (pre-existing failures in route-safety, refresh-session, view-audit-logs, mentor-ui-refinements, etc.; none touch Trip detail or schedule progress).

### UI Subtask DoD

- [x] UI implementation completed.
- [x] Applicable client-side behavior implemented.
- [x] Task-specific unit/component tests passed.
- [x] Backend integration completed.
- [x] Task-specific E2E tests passed.
- [x] All Story Acceptance Criteria verified (BR-241: no false warning, warning, safe Checkpoint included, policy action included).
- [x] Unit regression tests passed (except the pre-existing `develop` failures listed above).
- [x] E2E regression tests passed (see the regression result above).
- [x] lint:all passed.
- [x] build:all passed.
- [x] test:all passed (except the pre-existing `develop` failures listed above).
- [ ] Required CI checks passed — runs on the PR.
