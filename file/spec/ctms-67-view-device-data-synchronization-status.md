# CTMS-067 — View Device Data Synchronization Status

## 1. Overview

Story: CTMS-067

Epic: EPIC 10. Offline Buffer and Synchronization

Use Case: View Device Data Synchronization Status

Priority: Should Have

Goal: Let the user understand whether locally captured GPS/safety data has reached the server and retry failed synchronization.

Backlog story: As a user, I want to see device synchronization status so I know whether my locally captured safety data has been uploaded.

Acceptance Criteria:

| Source  | Criterion                                                  |
| ------- | ---------------------------------------------------------- |
| PB AC-1 | Display pending GPS-log count.                             |
| PB AC-2 | Display pending safety-event count.                        |
| PB AC-3 | Display last synchronization time.                         |
| PB AC-4 | Display current/last synchronization error when present.   |
| PB AC-5 | Provide retry action for failed data.                      |
| PB AC-6 | Local pending data is not represented as server-confirmed. |

## 2. Scope

### In Scope

- Pending GPS count.
- Pending safety-event count.
- Last sync time.
- Current/last error.
- Retry action.
- Local vs server state distinction.

### Out of Scope

- Actual synchronization engine — CTMS-065.
- Host member monitoring.

## 3. Actors & Authorization

- User of the device.
- Local synchronization subsystem.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-065.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-247 | The device must expose synchronization status including pending GPS-log count, pending safety-event count, last synchronization time, current/last error when present, and a retry action for failed sync data. |
| BR-226 | Offline-capable features must clearly distinguish local pending data from server-confirmed synchronized data and must not present unsynced local data as authoritative server state.                            |

## 6. State & Lifecycle

Display reflects underlying item states:

pending / synced / failed.

Retry:
failed → retry attempt → synced or failed.

## 7. Business Flow

1. Open synchronization status.
2. Count pending GPS logs.
3. Count pending safety events.
4. Read last successful synchronization time.
5. Read current/last error.
6. Display status.
7. User chooses retry if failed items exist.
8. Invoke CTMS-065 retry workflow.
9. Refresh status.

## 8. Data & Invariants

- Pending counts derive from local state.
- Last synchronization time is not current time unless sync occurred.
- Failed ≠ pending ≠ synced.
- UI must not imply server confirmation for pending items.

## 9. API / Integration Contract

Primarily local synchronization-status interface.

TBD — Technical Design.

## 10. Error & Edge Cases

| Case            | Expected Behavior             |
| --------------- | ----------------------------- |
| Nothing pending | Count = 0                     |
| Sync failed     | Error visible                 |
| Retry available | User may trigger retry        |
| Retry succeeds  | Status updates                |
| Device offline  | Pending remains clearly local |

## 11. Acceptance & Test Matrix

| Source | Scenario                    | Expected Result              | Test Type |
| ------ | --------------------------- | ---------------------------- | --------- |
| BR-247 | Pending GPS exists          | Count displayed              | UI        |
| BR-247 | Pending safety event exists | Count displayed              | UI        |
| BR-247 | Successful sync occurred    | Last sync shown              | UI        |
| BR-247 | Failure exists              | Error shown                  | UI        |
| BR-247 | Retry                       | Sync workflow invoked        | E2E       |
| BR-226 | Pending item                | Not labeled server-confirmed | UX/Data   |

## 12. Open Decisions

None.
