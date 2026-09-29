# CTMS-076 — Create SOS Alert While Offline

## 1. Overview

Story: CTMS-076

Epic: EPIC 12. SOS and Emergency Communication

Use Case: Create SOS Alert While Offline

Priority: Must Have

Goal: Allow SOS creation without network connectivity and ensure it is persisted locally, prioritized above ordinary telemetry and delivered idempotently when connectivity returns.

Backlog story: As a Camper, I want to create an SOS while offline so loss of connectivity does not prevent me from recording an emergency.

Acceptance Criteria:

| Source  | Criterion                                               |
| ------- | ------------------------------------------------------- |
| PB AC-1 | SOS can be created while offline.                       |
| PB AC-2 | Offline SOS is stored locally.                          |
| PB AC-3 | Immediate local safety guidance is shown.               |
| PB AC-4 | SOS receives highest synchronization priority.          |
| PB AC-5 | SOS/hazard events synchronize before ordinary GPS logs. |
| PB AC-6 | Repeated synchronization does not create duplicate SOS. |

## 2. Scope

### In Scope

- Offline SOS creation.
- Durable local SOS.
- Immediate safety guidance.
- Highest sync priority.
- Idempotent later delivery.

### Out of Scope

- General GPS buffering.
- Host acknowledgement.
- SOS cancellation.

## 3. Actors & Authorization

- Eligible Trip participant.
- Local emergency subsystem.
- Synchronization subsystem.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-064.
- CTMS-065.
- CTMS-074.

Network is unavailable or server cannot currently be reached.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-256 | An SOS created offline must be stored locally at the highest synchronization priority, show safety guidance immediately, and be sent once connectivity returns without creating duplicates. |
| BR-257 | Synchronization must prioritize SOS and hazard events ahead of ordinary GPS logs, using deterministic priority and idempotent processing.                                                   |
| BR-244 | Every GPS log and safety event must have a client-generated UUID. The server must process repeated uploads with the same UUID idempotently and must not create duplicate records/events.    |

## 6. State & Lifecycle

Offline:

SOS created
→ local `pending`
→ high-priority emergency queue.

Reconnect:

pending
→ high-priority sync
→ server accepted
→ synced.

Repeated same UUID:
→ same authoritative SOS/no duplicate.

## 7. Business Flow

1. Participant initiates SOS offline.
2. Capture available SOS data.
3. Assign stable UUID.
4. Persist SOS locally.
5. Show immediate safety guidance.
6. Mark highest synchronization priority.
7. Connectivity returns.
8. Sync SOS/hazard before normal GPS logs.
9. Server handles UUID idempotently.
10. Mark local SOS synced after confirmed acceptance.

## 8. Data & Invariants

- Offline SOS must survive app/device interruption according to durable local-storage rules.
- SOS priority > ordinary GPS-log priority.
- Original emergency event time preserved.
- Same UUID cannot create multiple SOS records.
- Local pending SOS must not be falsely represented as already received by server.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                             | Expected Behavior                         |
| -------------------------------- | ----------------------------------------- |
| No network                       | SOS stored locally                        |
| App restart                      | Pending SOS remains                       |
| Reconnect with SOS + GPS logs    | SOS sent first                            |
| Server accepts but response lost | Retry same UUID                           |
| Same UUID resent                 | No duplicate                              |
| Still offline                    | Safety guidance remains locally available |

## 11. Acceptance & Test Matrix

| Source     | Scenario          | Expected Result | Test Type   |
| ---------- | ----------------- | --------------- | ----------- |
| BR-256     | SOS offline       | Stored          | Offline     |
| BR-256     | SOS offline       | Guidance shown  | Safety      |
| BR-257     | SOS + GPS pending | SOS prioritized | Integration |
| BR-244/256 | Same UUID retry   | No duplicate    | Idempotency |
| BR-256     | Reconnect         | SOS sent        | E2E         |

## 12. Open Decisions

None regarding relative priority: SOS/hazard precedes ordinary GPS logs.
