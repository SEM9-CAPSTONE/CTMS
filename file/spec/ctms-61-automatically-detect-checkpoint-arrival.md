# CTMS-061 — Automatically Detect Checkpoint Arrival

## 1. Overview

Story: CTMS-061

Epic: EPIC 9. GPS Navigation and Route Deviation

Use Case: Automatically Detect Checkpoint Arrival

Priority: Must Have

Goal: Automatically detect checkpoint arrival on-device from valid GPS samples, including while offline, using the fixed V3 checkpoint threshold.

Backlog story: As a Camper, I want the system to automatically detect when I reach a checkpoint so Trip progress can be recorded even without Internet.

Acceptance Criteria:

| Source  | Criterion                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------- |
| PB AC-1 | Detection uses GPS samples and Checkpoint location from the active Offline Safety Package.              |
| PB AC-2 | Only VALID GPS samples participate in detection.                                                        |
| PB AC-3 | CHECKPOINT_REACHED is confirmed after 3 consecutive VALID samples with `distance_to_checkpoint <= 20m`. |
| PB AC-4 | Configurable `radius_m` must not replace the fixed V3 20m threshold.                                    |
| PB AC-5 | Detection works offline.                                                                                |
| PB AC-6 | Event/visit preserves event time, location and package/version context.                                 |
| PB AC-7 | Synced arrival is idempotent and must not create duplicate checkpoint visits.                           |

## 2. Scope

### In Scope

- On-device checkpoint-distance calculation.
- Consecutive-sample detection.
- Fixed 20m V3 threshold.
- Offline detection.
- CHECKPOINT_REACHED event.
- Checkpoint visit.
- Idempotent later synchronization.

### Out of Scope

- Manual Porter confirmation — CTMS-056.
- General GPS logging — CTMS-059.
- Route deviation — CTMS-060.
- Synchronization engine implementation — CTMS-065.

## 3. Actors & Authorization

- Eligible Trip participant.
- Mobile safety-detection subsystem.
- Server as synchronization destination.

Detection is valid only within the active Trip/package context.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-052.
- CTMS-058.
- CTMS-059.

Required:

- Trip is ongoing.
- Active Offline Safety Package exists.
- Target Checkpoint belongs to active Route/package.
- Location tracking is permitted.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-239 | When a Route Checkpoint meets the fixed V3 detection threshold of three consecutive VALID GPS samples with distance_to_checkpoint <= 20 m, the client must confirm CHECKPOINT_REACHED immediately, even while offline, and persist the event/visit with event_time, location, and package/version context. A configured radius_m must not replace this fixed 20 m threshold. When connectivity is available, the data must be synchronized to the server idempotently. |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                                                                                                                  |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                                                                                                           |

## 6. State & Lifecycle

Checkpoint detection:

not reached
→ first qualifying VALID sample
→ second consecutive qualifying VALID sample
→ third consecutive qualifying VALID sample
→ CHECKPOINT_REACHED.

After confirmation, repeated qualifying samples must not create another logical arrival for the same applicable checkpoint visit.

## 7. Business Flow

1. Load active package Checkpoint.
2. Receive GPS sample.
3. Determine whether sample is VALID.
4. If invalid, reset applicable consecutive detection counter.
5. If valid, calculate `distance_to_checkpoint`.
6. If distance <=20m, increment counter.
7. If condition fails, reset applicable counter.
8. On third consecutive qualifying sample, confirm CHECKPOINT_REACHED.
9. Persist event/visit locally.
10. Preserve event time, location and package/version.
11. Continue offline if necessary.
12. On connectivity, synchronize idempotently.

## 8. Data & Invariants

Fixed V3 threshold:

`3 consecutive VALID samples AND distance_to_checkpoint <= 20m`

Invariants:

- `radius_m` does not override 20m.
- Event time represents original detection time.
- Package/version context is preserved.
- Same logical arrival cannot become duplicate server visits.
- Offline event remains distinguishable from server-confirmed state until synchronized.

## 9. API / Integration Contract

Detection: local/offline.

Synchronization API: TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                      | Expected Behavior                        |
| ----------------------------------------- | ---------------------------------------- |
| Distances 18m, 19m, 20m                   | CHECKPOINT_REACHED                       |
| Distances 18m, 21m, 18m                   | Not reached                              |
| Invalid sample between qualifying samples | Consecutive counter resets               |
| `radius_m = 50m`                          | Still use fixed 20m threshold            |
| Offline                                   | Detection/event still works              |
| Same event uploaded twice                 | One authoritative visit                  |
| Wrong package checkpoint                  | Do not confirm against unrelated context |

## 11. Acceptance & Test Matrix

| Source          | Scenario                  | Expected Result         | Test Type   |
| --------------- | ------------------------- | ----------------------- | ----------- |
| PB AC-3, BR-239 | 3 VALID samples <=20m     | Reached                 | Detection   |
| PB AC-3         | Only 2 qualifying samples | Not reached             | Boundary    |
| PB AC-4         | radius_m differs          | 20m still authoritative | Rule        |
| PB AC-5         | Airplane mode             | Detection works         | Offline E2E |
| PB AC-6         | Event created             | Context preserved       | Integration |
| PB AC-7         | Event synced twice        | No duplicate visit      | Idempotency |

## 12. Open Decisions

None for V3 checkpoint detection threshold.
