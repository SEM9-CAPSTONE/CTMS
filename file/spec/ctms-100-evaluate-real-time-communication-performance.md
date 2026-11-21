# CTMS-100 — Evaluate Real-Time Communication Performance

## 1. Overview

Story: CTMS-100

Epic: EPIC 17. Reports and Evaluation Metrics

Use Case: Evaluate Real-Time Communication Performance

Priority: Must Have

Goal: Evaluate real-time SOS delivery, normal real-time event latency, and missed-event recovery using the approved V3 performance gates.

Backlog story: As the System, I want to evaluate real-time communication performance so critical and normal real-time delivery can be verified against release requirements.

Acceptance Criteria:

| Source  | Criterion                                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| PB AC-1 | SOS delivery latency is evaluated under stable connection conditions.                                                             |
| PB AC-2 | SOS delivery P95 must be <5 seconds.                                                                                              |
| PB AC-3 | Normal real-time event latency P95 must be ≤2 seconds.                                                                            |
| PB AC-4 | Normal real-time event latency P99 must be ≤5 seconds.                                                                            |
| PB AC-5 | Missed-event recovery after reconnection must equal 100%.                                                                         |
| PB AC-6 | Average latency and concurrency observations are reported.                                                                        |
| PB AC-7 | Average latency/concurrency observations are not standalone release gates unless separately defined.                              |
| PB AC-8 | Latency evidence preserves applicable sent/received/acknowledged timing without storing sensitive payload merely for measurement. |

## 2. Scope

### In Scope

- SOS P95 delivery latency.
- Normal realtime P95/P99 latency.
- Missed-event recovery.
- Average latency observation.
- Concurrency observation.
- Performance evidence.

### Out of Scope

- WebSocket implementation — CTMS-078.
- Reconnect implementation — CTMS-082.
- Creating additional unapproved performance gates.

## 3. Actors & Authorization

Actor:

- System/evaluation process.
- Authorized evaluator where applicable.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-078.
- CTMS-079.
- CTMS-082.

Performance test conditions and applicable event set are defined.

Stable connection conditions must be established for the SOS delivery gate.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-281 | Real-time evaluation release gates are: SOS delivery P95 <5 seconds under stable connectivity, normal real-time event latency P95 <=2 seconds and P99 <=5 seconds, and 100% missed-event recovery after reconnect. Average latency and concurrency observations must be reported but are not separate release gates.                                                   |
| BR-265 | WebSocket latency measurement must store sent_at, received_at, acknowledged_at, latency_ms, and event_type and must support aggregate average/P95/P99 reporting. Sensitive payloads must not be retained solely for latency measurement.                                                                                                                               |
| BR-282 | The V3 release gates defined in BR-276 through BR-281 and BR-434 through BR-438 are approved acceptance thresholds. Each evaluation report must store the dataset/version, metric value, threshold, rule/model/config version, and pass/fail conclusion. Metrics explicitly designated as observational are reported only and must not independently fail the release. |

## 6. State & Lifecycle

Performance test configured
→ events emitted
→ timestamps captured
→ disconnect/reconnect scenarios executed
→ metrics aggregated
→ release gates evaluated
→ Pass/Fail report.

## 7. Business Flow

1. Prepare versioned test scenario.
2. Establish applicable stable WebSocket condition.
3. Emit SOS test events.
4. Record server/client timing.
5. Emit normal realtime events.
6. Calculate P95/P99 latency.
7. Execute disconnect/reconnect scenario.
8. Determine eligible missed events.
9. Measure recovery percentage.
10. Record average latency/concurrency observations.
11. Compare gated metrics with approved thresholds.
12. Persist evaluation report.

## 8. Data & Invariants

Measurement data includes applicable:

- sent_at;
- received_at;
- acknowledged_at;
- latency_ms;
- event_type.

Release gates:

- SOS delivery P95 `< 5 seconds`;
- normal event P95 `≤ 2 seconds`;
- normal event P99 `≤ 5 seconds`;
- missed-event recovery `= 100%`.

Average latency and concurrency are observational unless another approved rule defines a gate.

Sensitive payload must not be retained solely to measure latency.

## 9. API / Integration Contract

Admin only (`JwtAuthGuard` + `RolesGuard`, role `admin`), base path `/api/evaluations/realtime` (see §13):

| Method | Path | Result |
| --- | --- | --- |
| POST | `/run` body `{ sosEvents?, normalEvents?, concurrentClients?, missedEvents? }` | 201 report; 400/422 out-of-range parameter; 409 a run is in progress; 503 evaluation clients could not connect |
| GET | `/latest` | Newest report; 404 when none |
| GET | `/reports?limit=` | Reports newest first (default 20, max 100) |
| GET | `/reports/:id` | One report; 422 bad id; 404 unknown |

Socket additions (gateway): `realtime.ack { eventId }` returns `{ ok: true, acknowledgedAt }` for an authenticated socket (server clock; the gateway stores nothing). Probe events `evaluation.probe.sos` / `evaluation.probe.normal` go through the normal store-then-emit path to the evaluation accounts only and are never pushed.

## 10. Error & Edge Cases

| Case                                            | Expected Behavior                                 |
| ----------------------------------------------- | ------------------------------------------------- |
| SOS P95 =4.9s                                   | Pass                                              |
| SOS P95 =5.0s                                   | Fail because gate is strictly `<5s`               |
| Normal P95 =2s                                  | Pass                                              |
| Normal P95 >2s                                  | Fail                                              |
| Normal P99 =5s                                  | Pass                                              |
| Normal P99 >5s                                  | Fail                                              |
| Missed recovery =100%                           | Pass                                              |
| One eligible missed event unrecovered           | Recovery gate fails                               |
| High average latency but gated percentiles pass | Report observation; do not invent additional gate |
| Sensitive event payload                         | Do not store merely for performance measurement   |

## 11. Acceptance & Test Matrix

| Source | Scenario          | Expected Result                           | Test Type     |
| ------ | ----------------- | ----------------------------------------- | ------------- |
| BR-281 | SOS P95 <5s       | Pass                                      | Performance   |
| BR-281 | SOS P95 ≥5s       | Fail                                      | Performance   |
| BR-281 | Normal P95 ≤2s    | Pass                                      | Performance   |
| BR-281 | Normal P99 ≤5s    | Pass                                      | Performance   |
| BR-281 | Recovery =100%    | Pass                                      | Reliability   |
| BR-281 | Recovery <100%    | Fail                                      | Reliability   |
| BR-265 | Latency captured  | Timing evidence retained                  | Observability |
| BR-282 | Evaluation report | Versions/metrics/thresholds/result stored | Traceability  |

## 12. Open Decisions

The controlled definition of a "stable connection" must be specified by the evaluation/Technical Design while preserving the approved `<5 seconds` SOS P95 gate. **Resolved 2026-11-13 (§13):** loopback WebSocket to the API instance, no injected delay or loss, all clients connected and authenticated before measuring, first 5 events of each latency scenario are warm-up.

## 13. Implementation Record — Logic (Jira CTMS-403, [CTMS-100-T01])

Branch `feat/CTMS-403-evaluate-realtime-performance-logic`. Module `services/api/src/modules/realtime-evaluation`, same shape as the other evaluation modules.

**How a run works.** An Admin calls `POST /api/evaluations/realtime/run`. The harness creates temporary active Camper accounts (`realtime-probe-<id>@evaluation.ctms.invalid`, unable to log in), connects real `socket.io-client` sockets to this API over loopback WebSocket with signed access tokens, and publishes probe events through `EventsGateway.publish` (store in `realtime_events`, then emit to the user rooms: the same path SOS uses). In `finally` it disconnects and deletes the probe accounts and their stored events. One run at a time (409). `socket.io-client` moved from devDependencies to dependencies because runtime code now uses it (the Docker image already shipped it).

**Stable connection (§12, approved decision A).** Loopback WebSocket (`transports: ["websocket"]`), no injected delay or loss, every client connected and authenticated before measuring, 5 warm-up events per latency scenario not measured. This measures the server pipeline (store + emit), not a user's mobile network; field latency is outside this evaluation.

**Scenarios (AC5).**

| Scenario | What it does | Feeds |
| --- | --- | --- |
| `STABLE_SOS` | 100 SOS probes (default) to one client, one at a time | SOS P95 gate |
| `CONCURRENT_NORMAL` | 200 normal probes (default) published at once to 10 connected clients | Normal P95/P99 gates; concurrency and throughput observations |
| `RECONNECT_RECOVERY` | Client disconnects after seeing a cursor; 20 events published while offline; a new socket calls `realtime.resume` | Recovery gate |
| `ROOM_RESTORE` | After reconnect, `connected.rooms` has the user and role rooms and a live event arrives | Evidence only |
| `DUPLICATE_HANDLING` | Asking `realtime.resume` again returns copies of handled events with the same `eventId`, so a client filters all of them | Evidence only; copy count is an observation |

Trip rooms are not exercised by the harness (probe accounts belong to no Trip); Trip room re-subscription after reconnect stays covered by the CTMS-078/082 suites (`websocket-reconnect.integration-spec.ts`).

**Timing (AC1, BR-265).** Per event and client: `sent_at` = `meta.emittedAt` (server, before storing), `received_at` = client receive time, `acknowledged_at` = server time answered to `realtime.ack`, `latency_ms` = received minus sent (same machine, same clock), `event_type`, event id and sequence. Stored in `realtime_latency_samples`; **the table has no payload column**. Recovered events also get a sample (received at resume time) but never feed a latency gate.

**Gates (BR-281, §10).** Nearest-rank percentiles; an event not received within 10 s is undelivered and sorts as infinite, so losing more than 5% (P95) or 1% (P99) makes the percentile unavailable and the gate fails.
- SOS P95 strictly `< 5000 ms` (5.0 s fails).
- Normal P95 `<= 2000 ms`, P99 `<= 5000 ms`.
- Recovery: recovered x 100 >= 100 x eligible; nothing eligible also fails (nothing proven).
- Observations only (AC6/AC7): average latencies, concurrent clients, normal events per second, average ack delay, duplicate copies filtered. Scenario checks (room restore, duplicates) are evidence and never become extra gates.

**Report (BR-282).** Tables `realtime_evaluation_reports` and `realtime_latency_samples` (migration `1795500000000`; samples cascade with their report). A report keeps scenario version `v3.0.0-realtime-performance`, config version `v3-realtime-evaluation-1`, rule version `BR-281+BR-265+BR-282`, the test config (parameters, warm-up, timeouts, stable-connection rule, percentile method, gates, reconnect policy in force), gates (threshold, actual, comparator, passed), metrics, scenario results, failure reasons, evaluator, start and end time.

**Limits.** socket.io uses the in-memory adapter (one API instance), so a run measures that instance. A default run takes about one second locally.

## 14. Test Evidence — CTMS-403

- Unit (`realtime-evaluation.metrics.spec.ts`, `realtime-evaluation.service.spec.ts`, `events.gateway.evaluation.spec.ts`): nearest-rank percentiles; undelivered counted as infinite; SOS 4.9 s pass and 5.0 s fail; normal P95 = 2 s and P99 = 5 s pass, just above fail; one unrecovered event fails; nothing eligible fails; high average with passing percentiles passes; a failed scenario check is not a gate; one run at a time; history bounds; probe publish path and `realtime.ack`.
- Integration `test/realtime-evaluation.integration-spec.ts` (3, real Postgres, app listening, real sockets): full run PASSED with all five scenarios; SOS samples have sent/received/acknowledged times; `realtime_latency_samples` has no payload column; probe accounts and probe events removed; latest / reports / by id; a concurrent run gets 409; out-of-range parameters rejected; 422 / 404; Host 403; anonymous 401.
- Default run on a local machine (100 SOS, 200 normal x 10 clients, 20 missed): PASSED. SOS P95 5 ms (avg 4.03 ms); normal P95 253 ms, P99 260 ms (avg 143 ms over 2 000 deliveries, about 7 576 deliveries/s); recovery 20/20; 21 duplicate copies filtered; all scenarios passed; about 1 s.
- Related integration suites (realtime, websocket, SOS, push, evaluations) pass, except `sync-evaluation` (4) and `overbooking-evaluation` (4), which fail identically on develop (`bm.trip_id`, `CHK_trips_duration_by_type`) and are untouched.
- API jest 209 suites, 2 507 tests passed. `lint:all` 0 errors. `build:all` passes. Backend only, no UI.

### DoD — CTMS-403

- [x] Logic implementation completed
- [x] Applicable business rules/invariants implemented (BR-281, BR-265, BR-282)
- [x] Task-specific unit tests added and passed
- [x] Applicable backend/integration tests passed (pre-existing failures noted above)
- [x] Story Acceptance Criteria AC1-AC6 covered by tests
- [x] Unit regression tests passed
- [ ] Applicable E2E: none, backend only
- [x] lint:all passed
- [x] build:all passed
- [ ] Required CI checks: after the PR is opened
