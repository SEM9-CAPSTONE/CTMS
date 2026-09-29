# CTMS-064 — Offline Buffer for GPS and Safety Events

## 1. Overview

Story: CTMS-064

Epic: EPIC 10. Offline Buffer and Synchronization

Use Case: Offline Buffer for GPS and Safety Events

Priority: Must Have

Goal: Preserve GPS logs and safety events durably while offline so safety behavior continues and pending data survives app/device restart.

Backlog story: As the System, I want to buffer GPS and safety events offline so connectivity loss does not destroy operational safety data.

Acceptance Criteria:

| Source  | Criterion                                                                            |
| ------- | ------------------------------------------------------------------------------------ |
| PB AC-1 | GPS logs are persisted locally while offline.                                        |
| PB AC-2 | Safety events are persisted locally while offline.                                   |
| PB AC-3 | Pending data survives app close/reopen and device restart.                           |
| PB AC-4 | OFF_ROUTE/checkpoint/safety detection continues locally from Offline Safety Package. |
| PB AC-5 | Local pending data is distinguishable from server-confirmed data.                    |

## 2. Scope

### In Scope

- Durable local database.
- Pending GPS logs.
- Pending safety events.
- App restart survival.
- Device restart survival.
- Local safety processing.

### Out of Scope

- Reconnection synchronization — CTMS-065.
- Sync status UI — CTMS-067.

## 3. Actors & Authorization

- Mobile client.
- Local persistence/safety subsystem.

## 4. Preconditions & Dependencies

Dependencies include applicable GPS/safety stories and Offline Safety Package.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-242     | When connectivity is lost, GPS logs and safety events must be stored in a local database so they survive app restarts or device restarts. OFF_ROUTE, Checkpoint, and other safety warnings must continue to operate locally from the Offline Safety Package. |
| BR-226     | Offline-capable features must clearly distinguish local pending data from server-confirmed synchronized data and must not present unsynced local data as authoritative server state.                                                                         |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                        |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                 |

## 6. State & Lifecycle

Generated locally
→ `pending`
→ remains durable while offline.

Synchronization transition belongs to CTMS-065.

## 7. Business Flow

1. GPS/safety subsystem generates record/event.
2. Detect network unavailable or use local-first persistence.
3. Assign stable identity/context.
4. Persist in local database.
5. Mark local synchronization state pending.
6. Continue local safety processing.
7. App closes/restarts.
8. Reload pending data.
9. Await synchronization workflow.

## 8. Data & Invariants

- Pending records survive restart.
- Unsynced ≠ server-confirmed.
- Original event identity/time/context preserved.
- Safety detection does not depend on server connectivity.

## 9. API / Integration Contract

Local database contract: TBD — Technical Design.

## 10. Error & Edge Cases

| Case                         | Expected Behavior                        |
| ---------------------------- | ---------------------------------------- |
| Internet lost                | Local persistence continues              |
| App killed                   | Pending data survives                    |
| Device restarted             | Pending data survives                    |
| OFF_ROUTE offline            | Local warning still operates             |
| Local pending item displayed | Clearly not represented as server-synced |

## 11. Acceptance & Test Matrix

| Source | Scenario             | Expected Result               | Test Type   |
| ------ | -------------------- | ----------------------------- | ----------- |
| BR-242 | Offline GPS log      | Persisted                     | Offline     |
| BR-242 | Offline safety event | Persisted                     | Offline     |
| BR-242 | Restart app          | Data remains                  | Persistence |
| BR-242 | Restart device       | Data remains                  | E2E         |
| BR-226 | Pending item         | Not shown as server-confirmed | UI/Data     |

## 12. Open Decisions

Local database technology and retention/storage limits belong to Technical Design unless separately fixed.
