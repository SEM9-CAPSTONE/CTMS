# CTMS-077 — Cancel Accidental SOS Alert

## 1. Overview

Story: CTMS-077

Epic: EPIC 12. SOS and Emergency Communication

Use Case: Cancel Accidental SOS Alert

Priority: Must Have

Goal: Allow an accidentally created SOS to be cancelled only when the configured cancellation policy permits, while preserving complete emergency history.

Backlog story: As a Camper, I want to cancel an accidental SOS when allowed so responders know that the alert was sent by mistake.

Acceptance Criteria:

| Source  | Criterion                                                                     |
| ------- | ----------------------------------------------------------------------------- |
| PB AC-1 | SOS cancellation is allowed only when configured cancellation policy permits. |
| PB AC-2 | Cancellation records `cancelled_by`.                                          |
| PB AC-3 | Cancellation records `cancelled_at`.                                          |
| PB AC-4 | Cancellation records reason.                                                  |
| PB AC-5 | Original SOS history is preserved.                                            |
| PB AC-6 | Cancellation must not delete the SOS record.                                  |

## 2. Scope

### In Scope

- Accidental SOS cancellation.
- Cancellation-policy validation.
- Cancellation actor/time/reason.
- History preservation.

### Out of Scope

- SOS acknowledgement.
- SOS closure after handling.
- Physical emergency-response cancellation outside CTMS.

## 3. Actors & Authorization

- Authorized SOS sender/user according to configured cancellation policy.
- System.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-074 or CTMS-076.

SOS exists and cancellation policy permits cancellation.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-258     | An SOS sent by mistake may be cancelled only when the configured cancellation policy permits it. Cancellation must store cancelled_by, cancelled_at, and reason, and must preserve SOS history. |
| BR-191     | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                            |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.           |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                    |

## 6. State & Lifecycle

Active SOS
→ cancellation requested
→ validate policy
→ cancelled.

SOS record/history remains retained.

If policy disallows:
→ state unchanged.

## 7. Business Flow

1. User selects Cancel SOS.
2. Verify SOS identity and authorization.
3. Evaluate configured cancellation policy.
4. If not permitted, reject.
5. Require/capture cancellation reason according to source rule.
6. Store cancelled_by.
7. Store cancelled_at.
8. Transition SOS to cancelled.
9. Preserve original SOS/history.
10. Trigger applicable downstream status update/notification.

## 8. Data & Invariants

Cancellation stores:

- cancelled_by;
- cancelled_at;
- reason.

Invariant:

`cancel SOS != delete SOS`

Emergency history remains auditable.

## 9. API / Integration Contract

### Cancel Accidental SOS Alert
- **Endpoint**: `PATCH /trips/:tripId/sos/:sosId/cancel`
- **Authentication**: Bearer JWT (`Roles: camper`)
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`

#### Request Body
```json
{
  "reason": "Accidentally clicked SOS while checking map, false alarm"
}
```

#### Response Body (HTTP 200 OK)
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "tripId": "123e4567-e89b-12d3-a456-426614174001",
  "senderId": "123e4567-e89b-12d3-a456-426614174002",
  "emergencyType": "medical",
  "location": {
    "latitude": 16.0544,
    "longitude": 108.2022
  },
  "batteryLevel": 85,
  "eventTime": "2026-10-27T10:00:00.000Z",
  "status": "cancelled",
  "cancelledBy": "123e4567-e89b-12d3-a456-426614174002",
  "cancelledAt": "2026-10-27T10:02:00.000Z",
  "cancellationReason": "Accidentally clicked SOS while checking map, false alarm",
  "acknowledgedBy": null,
  "acknowledgedAt": null,
  "closedBy": null,
  "closedAt": null,
  "resolutionNote": null,
  "receivedAt": "2026-10-27T10:00:01.000Z",
  "createdAt": "2026-10-27T10:00:01.000Z",
  "updatedAt": "2026-10-27T10:02:00.000Z"
}
```

#### Status Codes & Error Responses
- `200 OK`: SOS alert successfully cancelled.
- `401 Unauthorized`: Authentication required.
- `403 Forbidden`: `NOT_SOS_SENDER` or `NOT_TRIP_PARTICIPANT`.
- `404 Not Found`: `TRIP_NOT_FOUND` or `SOS_NOT_FOUND`.
- `409 Conflict`:
  - `SOS_ALREADY_CANCELLED`: Alert was already cancelled.
  - `SOS_ALREADY_ACKNOWLEDGED`: Alert has already been acknowledged by Host for emergency handling.
  - `SOS_ALREADY_CLOSED`: Alert has already been closed.
  - `SOS_NOT_ACTIVE`: Alert is in an invalid state for cancellation.
- `422 Unprocessable Entity`: Validation failed (e.g. empty reason, reason > 500 characters, invalid UUID).

#### Real-Time Broadcast (WebSocket)
- Event: `sos.state_changed`
- Payload:
  ```json
  {
    "sosId": "uuid",
    "tripId": "uuid",
    "senderId": "uuid",
    "status": "cancelled",
    "cancelledBy": "uuid",
    "cancelledAt": "iso-date-string",
    "cancellationReason": "string"
  }
  ```

## 10. Error & Edge Cases

| Case                     | Expected Behavior                                   |
| ------------------------ | --------------------------------------------------- |
| Policy permits           | Cancel                                              |
| Policy rejects           | SOS remains active                                  |
| Unauthorized user        | Reject                                              |
| Cancellation succeeds    | History retained                                    |
| User tries delete        | Not equivalent to cancellation                      |
| Concurrent Host handling | Resolve using authoritative state/concurrency rules |

## 11. Acceptance & Test Matrix

| Source | Scenario                | Expected Result          | Test Type  |
| ------ | ----------------------- | ------------------------ | ---------- |
| BR-258 | Policy permits          | SOS cancelled            | Functional |
| BR-258 | Policy denies           | Rejected                 | Policy     |
| BR-258 | Successful cancellation | Actor/time/reason stored | Data       |
| BR-258 | Cancelled SOS queried   | History retained         | Audit      |
| BR-258 | Delete attempted        | No history deletion      | Integrity  |

## 12. Open Decisions

Cancellation is permitted while the SOS is in `active` state (before Host acknowledgement/closure) by the original sender.
