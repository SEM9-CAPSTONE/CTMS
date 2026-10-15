# CTMS-046 — Respond to Porter Request

## 1. Overview

Story: CTMS-046

Epic: EPIC 7. Porter Management

Use Case: Respond to Porter Request

Priority: Must Have

Goal: Allow the requested Porter to accept or decline a pending Trip request after authoritative eligibility is revalidated, and automatically create the authoritative Porter Assignment when the request is accepted.

Acceptance Criteria:

| Source  | Criterion                                                                |
| ------- | ------------------------------------------------------------------------ |
| PB AC-1 | Only the requested Porter can respond.                                   |
| PB AC-2 | Only a request whose current state permits response can be changed.      |
| PB AC-3 | Accept revalidates availability, qualification and assignment conflicts. |
| PB AC-4 | Valid accept atomically creates the Porter Assignment and transitions pending request to accepted. |
| PB AC-5 | Valid decline transitions pending request to declined.                   |
| PB AC-6 | Repeated response is idempotent and cannot create contradictory outcome or duplicate Assignment. |

## 2. Scope

### In Scope

- Accept request and automatic Assignment creation.
- Decline request.
- Revalidate eligibility.
- Request state transition.

### Out of Scope

- Creating Request.
- Porter compensation.

## 3. Actors & Authorization

- Porter identified by request `porter_id`.
- System.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-045.

Porter Request exists.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-147 | A Porter may Accept or Decline only a Porter Request whose porter_id matches the authenticated Porter and whose current status still allows a response.                                                                                                                                                                              |
| BR-148 | A valid Accept transitions the Porter Request from PENDING → ACCEPTED only after the backend revalidates availability, qualification, conflicts, Trip assignability, duplicate Assignment guards, and existing Assignment invariants. The same transaction must create the authoritative Porter Assignment; ACCEPTED means the Porter is assigned to the Trip. Repeated requests must be idempotent and must not create duplicate Assignments or notifications. |
| BR-149 | A valid Decline transitions the Porter Request from PENDING → DECLINED. A declined request must not create a Porter Assignment.                                                                                                                                                                                                      |
| BR-150 | A PENDING Porter Request must have expires_at determined by configured policy and may not extend beyond Trip start. The Host may cancel the request, or the System may expire it at expires_at. ACCEPTED, DECLINED, CANCELLED, and EXPIRED must never silently transition back to PENDING.                                           |
| BR-151 | Any Porter Request state change that affects the Host or Porter must emit its notification/event only after commit and must not produce duplicate notifications for the same event.                                                                                                                                                  |

## 6. State & Lifecycle

`PENDING`
→ `ACCEPTED` + authoritative Porter Assignment created in the same transaction.

or:

`PENDING`
→ `DECLINED`

No accepted↔declined flip through this response operation.

## 7. Business Flow

1. Porter opens Request.
2. Backend verifies Porter identity.
3. Reload request.
4. Verify current state.
5. For Accept:
   - revalidate availability;
   - qualification;
   - assignment conflicts;
   - Trip assignability;
   - duplicate Assignment guards.
6. For Accept, create the Porter Assignment using the authoritative assignment table and invariants.
7. Apply Accepted or Declined.
8. Record response metadata.
9. Commit Request transition and Assignment creation atomically.
10. Queue downstream notification.
11. Return authoritative state.

## 8. Data & Invariants

- Only target Porter responds.
- One terminal response.
- Accept is not based on stale availability.
- Accepted Request must have a committed Assignment.
- Failed Assignment creation must not commit ACCEPTED.
- Repeated same response is safe.
- Contradictory retry cannot overwrite committed response.
- Repeated Accept must not duplicate the Assignment.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                      | Expected Behavior                   |
| ------------------------- | ----------------------------------- |
| Another Porter responds   | Reject.                             |
| Request already declined  | Accept cannot overwrite it.         |
| Request already accepted  | Decline cannot overwrite it.        |
| Porter became unavailable | Accept rejected.                    |
| Assignment creation fails | Request remains not accepted.       |
| Duplicate accept retry    | Returns accepted state with existing Assignment. |
| Concurrent responses      | One valid authoritative transition. |

## 11. Acceptance & Test Matrix

| Source | Scenario                | Expected Result          | Test Type     |
| ------ | ----------------------- | ------------------------ | ------------- |
| BR-147 | Target Porter responds  | Allowed                  | Authorization |
| BR-147 | Other Porter            | Rejected                 | Security      |
| BR-148 | Eligible Accept         | Accepted and assigned    | E2E           |
| BR-148 | Conflict now exists     | Accept rejected          | Integration   |
| BR-148 | Assignment failure      | Request not accepted     | Integration   |
| BR-149 | Valid Decline           | Declined                 | E2E           |
| BR-150 | Opposite stale response | Cannot overwrite         | Concurrency   |
| BR-151 | Retry                   | No duplicate side effect | Idempotency   |

## 12. Open Decisions

None beyond the authoritative Request lifecycle.
