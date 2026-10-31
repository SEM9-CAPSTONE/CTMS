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

TBD — Technical Design.

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
