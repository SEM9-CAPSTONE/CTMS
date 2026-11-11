# CTMS-085 — View Members Who Are Off-Route or Behind Schedule

## 1. Overview

Story: CTMS-085

Epic: EPIC 14. Host Operations and Monitoring

Use Case: View Members Who Are Off-Route or Behind Schedule

Priority: Must Have

Goal: Allow Host to identify participants flagged as off-route or behind schedule and inspect the corresponding operational location.

Backlog story: As a Host, I want to see members who are off-route or behind schedule so I can focus on participants who may require attention.

Acceptance Criteria:

| Source  | Criterion                                                  |
| ------- | ---------------------------------------------------------- |
| PB AC-1 | Host can view members flagged off-route.                   |
| PB AC-2 | Host can view members flagged behind schedule.             |
| PB AC-3 | Alerts can be filtered by supported severity/status.       |
| PB AC-4 | Host can open the related location on the operational map. |
| PB AC-5 | Display uses authorized server-known/synchronized state.   |

## 2. Scope

### In Scope

- OFF_ROUTE flags.
- Behind-schedule flags.
- Alert filtering.
- Operational-map navigation.

### Out of Scope

- Calculating OFF_ROUTE — CTMS-060.
- Calculating behind-schedule status — CTMS-063.
- Editing GPS data.

## 3. Actors & Authorization

Primary actor:

- Host.

Host may monitor only eligible members of Trips within Host authorization scope.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-060.
- CTMS-063.
- CTMS-084.

Relevant server-known alert/participant state exists.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-268 | The Host must be able to view members flagged as off-route or behind schedule, filter alerts by severity/status, and open the related location on the operational map. |
| BR-267 | Location data must clearly display timestamp and state. Stale/offline data must be visually distinguishable and must not be presented as real-time.                    |

## 6. State & Lifecycle

Operational event/flag
→ synchronized/server-known
→ Host monitoring list
→ optional filter
→ open member/location on map.

## 7. Business Flow

1. Host opens monitoring view.
2. Resolve authorized Trips.
3. Load members with eligible OFF_ROUTE/behind-schedule flags.
4. Display status and applicable alert context.
5. Host filters by severity/status.
6. Host selects member/alert.
7. Open corresponding location on operational map.

## 8. Data & Invariants

Monitoring data must preserve:

- member;
- Trip;
- alert/status;
- applicable severity;
- location reference;
- timestamp/freshness.

Client must not create an authoritative OFF_ROUTE/behind-schedule state solely for dashboard display.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                     | Expected Behavior     |
| ------------------------ | --------------------- |
| Member OFF_ROUTE         | Included              |
| Member behind schedule   | Included              |
| No active flags          | Empty state           |
| Stale location           | Clearly marked        |
| Unauthorized Trip/member | Not exposed           |
| Filter has no matches    | Empty filtered result |

## 11. Acceptance & Test Matrix

| Source | Scenario               | Expected Result    | Test Type  |
| ------ | ---------------------- | ------------------ | ---------- |
| BR-268 | OFF_ROUTE member       | Visible            | E2E        |
| BR-268 | Behind-schedule member | Visible            | E2E        |
| BR-268 | Filter severity/status | Correct subset     | Functional |
| BR-268 | Select alert           | Map location opens | UI         |
| BR-267 | Stale location         | Not shown as live  | Safety     |

## 12. Open Decisions

Supported severity/status enums must follow authoritative alert-state definitions.
