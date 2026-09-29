# CTMS-066 — View Each Member's Last Synced Location

## 1. Overview

Story: CTMS-066

Epic: EPIC 10. Offline Buffer and Synchronization

Use Case: View Each Member's Last Synced Location

Priority: Must Have

Goal: Allow Host to see the latest server-known location and synchronized safety state for eligible Trip members without presenting stale/unsynced device data as real-time information.

Backlog story: As a Host, I want to view each Trip member's last synchronized location so I can understand the latest location the server actually knows.

Acceptance Criteria:

| Source  | Criterion                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------- |
| PB AC-1 | Host view shows latest synchronized member location.                                               |
| PB AC-2 | Host view shows `last_seen_at`.                                                                    |
| PB AC-3 | Synchronized safety flags such as OFF_ROUTE/checkpoint/behind-schedule are shown where applicable. |
| PB AC-4 | Unsynced device data is not represented as server-known real-time state.                           |
| PB AC-5 | Only eligible Trip members are visible to authorized Host.                                         |

## 2. Scope

### In Scope

- Last synchronized location.
- Last seen time.
- Synced safety flags.
- Staleness semantics.
- Host Trip-member authorization.

### Out of Scope

- Device's unsynced live location.
- WebSocket real-time communication.
- GPS generation.

## 3. Actors & Authorization

- Host managing the applicable Trip.
- System.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-065.
- Applicable Trip/member relationship.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-246     | For each eligible Trip member, the Host view must show the latest synchronized location, last_seen_at, and synchronized safety flags such as OFF_ROUTE, Checkpoint, or behind-schedule. Data still unsynced on the device must not be presented as though the server knows it in real time. |
| BR-172     | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                                                                                                        |
| BR-173     | A user may view or modify only data they own unless the user's role and business relationship explicitly authorize access to another user's data.                                                                                                                                           |

## 6. State & Lifecycle

Read projection.

Member device:
local pending data → synchronization → server-known state.

Host sees only server-known synchronized state.

## 7. Business Flow

1. Host opens active Trip monitoring.
2. Verify Host manages Trip.
3. Load eligible Trip members.
4. Resolve latest synchronized location per member.
5. Resolve `last_seen_at`.
6. Resolve synchronized safety flags.
7. Return projection.
8. Clearly represent staleness/server-known semantics.

## 8. Data & Invariants

- Location = latest synchronized server-known location.
- `last_seen_at` accompanies state.
- Unsynced device position is not server-known.
- Host sees only members in authorized Trip scope.
- Stale data must not be labeled live/current without qualification.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                           | Expected Behavior                        |
| ------------------------------ | ---------------------------------------- |
| Member has never synced        | Show no server-known location            |
| Member offline for long period | Preserve last known location + timestamp |
| Device has newer pending GPS   | Host does not see it as server-known     |
| Unrelated Host                 | No access                                |
| Safety event not synced        | Do not show as server-confirmed          |

## 11. Acceptance & Test Matrix

| Source | Scenario                | Expected Result               | Test Type   |
| ------ | ----------------------- | ----------------------------- | ----------- |
| BR-246 | Member synced location  | Displayed                     | E2E         |
| BR-246 | Member has timestamp    | last_seen_at displayed        | UI          |
| BR-246 | Synced OFF_ROUTE        | Flag displayed                | Integration |
| BR-246 | New unsynced GPS exists | Not presented as server-known | Consistency |
| BR-172 | Unrelated Host          | Rejected                      | Security    |

## 12. Open Decisions

None. The view is explicitly last-synchronized rather than guaranteed real-time.
