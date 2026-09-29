# CTMS-045 — Request Porter for Trip

## 1. Overview

Story: CTMS-045

Epic: EPIC 7. Porter Management

Use Case: Request Porter for Trip

Priority: Must Have

Goal: Allow Host to invite an eligible Porter to a managed Trip without creating duplicate pending requests.

Acceptance Criteria:

| Source  | Criterion                                                                   |
| ------- | --------------------------------------------------------------------------- |
| PB AC-1 | Host can request an eligible Porter for a Trip they manage.                 |
| PB AC-2 | Request references valid Trip and Porter.                                   |
| PB AC-3 | Only one pending request may exist for the same Trip/Porter pair at a time. |
| PB AC-4 | Request records authenticated Host as requester.                            |
| PB AC-5 | Request may contain approved role/note information.                         |
| PB AC-6 | Porter receives notification after successful commit.                       |
| PB AC-7 | CTMS does not store Porter compensation/day-rate.                           |

## 2. Scope

### In Scope

- Create Porter Request.
- Eligibility revalidation.
- Duplicate pending prevention.
- Requested role/note.
- Notification.

### Out of Scope

- Porter response; CTMS-046.
- Assignment; CTMS-047.
- Compensation.

## 3. Actors & Authorization

- Host.
- Porter as request recipient.
- System.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-021.
- CTMS-043.
- CTMS-044.

Host manages Trip and Porter is currently eligible.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                 |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-143 | A Host may send a Porter Request only for a Trip they manage. The request must reference a valid trip_id and porter_id.                                                                                              |
| BR-144 | At any time, there may be at most one PENDING Porter Request for the same (trip_id, porter_id). Resending must follow the request lifecycle/idempotency policy instead of creating duplicate pending requests.       |
| BR-145 | A Porter Request must derive requested_by from the authenticated Host and store any required business fields such as requested_role and note. CTMS does not store day_rate or process Porter compensation under D02. |
| BR-146 | After the Porter Request transaction commits, the Porter must receive a notification according to notification preferences/policy. Notification failure must not roll back the committed request.                    |

## 6. State & Lifecycle

No request
→ Host requests
→ `PENDING`

Response lifecycle continues in CTMS-046.

## 7. Business Flow

1. Host selects eligible Porter.
2. Backend verifies Host owns/manages Trip.
3. Reload Porter availability/qualification/conflict.
4. Validate no existing pending pair.
5. Create pending request.
6. Record `requested_by`.
7. Store approved role/note.
8. Commit.
9. Queue Porter notification.
10. Return request.

## 8. Data & Invariants

- Trip valid.
- Porter valid.
- Requester = authenticated Host.
- One pending Trip/Porter pair.
- No day-rate/compensation.
- Notification happens after commit.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                         | Expected Behavior                            |
| ---------------------------- | -------------------------------------------- |
| Host does not manage Trip    | Reject.                                      |
| Porter unavailable           | Reject.                                      |
| Qualification invalid        | Reject.                                      |
| Duplicate pending request    | Do not create duplicate.                     |
| Concurrent duplicate request | Unique/concurrency guard prevents duplicate. |
| Notification fails           | Request remains committed.                   |

## 11. Acceptance & Test Matrix

| Source | Scenario               | Expected Result                | Test Type   |
| ------ | ---------------------- | ------------------------------ | ----------- |
| BR-143 | Valid Host/Trip/Porter | Request created                | E2E         |
| BR-143 | Unrelated Host         | Rejected                       | Security    |
| BR-144 | Duplicate pending      | Prevented                      | Constraint  |
| BR-144 | Concurrent duplicates  | One pending request            | Concurrency |
| BR-145 | Request created        | Authenticated requester stored | Integration |
| BR-146 | Notification failure   | Request preserved              | Integration |

## 12. Open Decisions

Exact request expiry policy, if any, must come from an authoritative rule rather than being inferred here.
