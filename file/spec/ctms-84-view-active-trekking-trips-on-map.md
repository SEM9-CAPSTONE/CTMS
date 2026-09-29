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

TBD — Technical Design.

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
