# CTMS-049 — Report Incident During Trip

## 1. Overview

Story: CTMS-049

Epic: EPIC 7. Porter Management

Use Case: Report Incident During Trip

Priority: Must Have

Goal: Allow an authorized Porter to report an operational incident for an assigned Trip with traceable time/location/severity information.

Acceptance Criteria:

| Source  | Criterion                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| PB AC-1 | Porter can report an incident only for an assigned Trip within applicable operational scope.               |
| PB AC-2 | Incident records required type/description/severity and authoritative context.                             |
| PB AC-3 | Location/time information is stored according to available authoritative device/server context.            |
| PB AC-4 | Incident is traceable and available to authorized Host operational handling.                               |
| PB AC-5 | Offline submission, where supported, preserves original event identity/time and syncs without duplication. |

## 2. Scope

### In Scope

- Incident creation.
- Trip relationship.
- Severity/type.
- Description.
- Location/time context.
- Offline-safe event identity where applicable.
- Host visibility.

### Out of Scope

- SOS itself.
- Host incident-management workflow; CTMS-086.
- Medical diagnosis.

## 3. Actors & Authorization

- Porter assigned to Trip.
- System.
- Host as downstream authorized viewer/handler.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-048.

Porter has valid applicable Trip Assignment.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-161 | A Trip incident report must include trip_id, a valid reporter, category, description, and location. Media is optional; any attached media must pass upload verification.                                            |
| BR-162 | When offline, incident, GPS, and safety events must be stored locally with a client-generated ID and idempotency metadata and later synchronized through sync_batches. Device-to-device relay is not supported.     |
| BR-221 | Incident and safety events created offline must preserve their original event time, location, client-generated identifier, and local sync state. Once connectivity returns, they must be synchronized idempotently. |
| BR-224 | Media attached to operational or safety records is optional. When present, it must comply with media type, size, and upload-verification rules. A media failure must not invalidate the parent business record.     |

## 6. State & Lifecycle

No incident
→ report
→ incident created/open according to authoritative incident state.

Further handling belongs to CTMS-086.

## 7. Business Flow

1. Porter selects assigned Trip.
2. Backend/client validates assignment context.
3. Porter enters incident information.
4. Capture applicable event time/location.
5. If online, submit.
6. If offline-supported, store stable local event for later sync.
7. Backend verifies Trip/Porter relationship.
8. Persist incident.
9. Notify/expose to authorized Host.
10. Duplicate sync is ignored/reconciled.

## 8. Data & Invariants

- Incident belongs to valid Trip.
- Reporter must have applicable assignment.
- Original event time preserved.
- Stale/offline location is identified appropriately.
- Stable event identity prevents duplicate sync.
- Incident does not become SOS unless explicit SOS rule says so.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                    | Expected Behavior                           |
| --------------------------------------- | ------------------------------------------- |
| Porter not assigned                     | Reject.                                     |
| Trip no longer operationally applicable | Apply authoritative policy.                 |
| Location unavailable                    | Do not fabricate coordinates.               |
| Offline incident sync repeated          | One authoritative incident.                 |
| Network fails after local capture       | Preserve event for supported sync workflow. |

## 11. Acceptance & Test Matrix

| Source | Scenario                    | Expected Result      | Test Type   |
| ------ | --------------------------- | -------------------- | ----------- |
| BR-161 | Assigned Porter reports     | Incident accepted    | E2E         |
| BR-161 | Unassigned Porter           | Rejected             | Security    |
| BR-162 | Required incident data      | Persisted            | Integration |
| BR-221 | Offline/stale location      | Correctly identified | Safety      |
| BR-224 | Same offline event resynced | No duplicate         | Idempotency |

## 12. Open Decisions

Exact incident type/severity enums must follow the authoritative incident Data Dictionary.
