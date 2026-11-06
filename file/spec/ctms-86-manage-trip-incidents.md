# CTMS-086 — Manage Trip Incidents

## CTMS-052 dependency amendment — 2026-11-06

BR-269 and the operational lifecycle below are retained. `resolved`/`closed` describes handling, never Host verification of a hazard. A separate proposed **Host Verify Field Hazard Report** task owns `hazardVerificationDecision`, versioned decision/evidence, authorized verifier, rejection/revocation and audit. A separate **Promote Verified Field Report to Safety Source** task publishes eligible features. See [upstream contracts](ctms-52-upstream-safety-contracts.md). No new verification API/UI is implemented in 052 or implicitly added to this story. Acceptance: lifecycle operations retain their behavior, while resolved/closed without a decision, rejected and revoked reports cannot supply verified package hazards.

## 1. Overview

Story: CTMS-086

Epic: EPIC 14. Host Operations and Monitoring

Use Case: Manage Trip Incidents

Priority: Must Have

Goal: Allow an authorized Host to create or receive Trip incidents, assign handling responsibility, and track incident handling through valid states with auditable history.

Backlog story: As a Host, I want to manage Trip incidents so operational problems can be assigned, tracked, and resolved.

Acceptance Criteria:

| Source  | Criterion                                                                 |
| ------- | ------------------------------------------------------------------------- |
| PB AC-1 | Authorized Host may create or receive an incident for an applicable Trip. |
| PB AC-2 | Handling responsibility can be assigned.                                  |
| PB AC-3 | Incident may be updated only through valid state transitions.             |
| PB AC-4 | Incident action history is auditable.                                     |
| PB AC-5 | Unauthorized users cannot mutate incident state.                          |

## 2. Scope

### In Scope

- Incident creation/reception by authorized Host or Lead Porter.
- Assigning handling responsibility (`assigned_to`).
- State updates through authoritative transition graph.
- Chronological action history and audit log (`incident_actions`).
- Real-time notification and optimistic sync updates.

### Out of Scope

- SOS-specific lifecycle — CTMS-074–080.
- Automatic incident classification unless separately specified.

## 3. Actors & Authorization

Primary actors:

- **Authorized Host**: Owning Host of the Trip or Administrator. Has full management access: report, assign, update status, and view audit history.
- **Lead Porter**: Assigned to the Trip. Can report incidents and update assigned status.
- **Unauthorized users**: Forbidden (403 Forbidden) from mutating incident state or viewing unassigned Trip operational incidents.

## 4. Preconditions & Dependencies

- Applicable Trip exists and is not draft.
- Host owns the Trip (or has Admin privileges), or Porter is assigned to the Trip.
- User assigned as handler must exist and be active.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-269     | The system must allow an authorized Host to create/receive incidents, assign handling responsibility, and update incidents through valid state transitions. The complete action history must be auditable. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                      |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                               |

## 6. State & Lifecycle

### Incident Status Enum (`incident_status`)

- `OPEN` (`open`): Incident has been created/reported and awaits investigation or assignment.
- `INVESTIGATING` (`investigating`): Incident is being handled/investigated by assigned personnel.
- `RESOLVED` (`resolved`): Root cause or immediate danger has been mitigated; pending final closure or verification.
- `CLOSED` (`closed`): Incident handling completed. Terminal state.

### Allowed Status Transitions

```
 [OPEN] <--------------> [INVESTIGATING]
    │                          │
    ▼                          ▼
 [RESOLVED] <------------------+
    │   ▲
    │   │ (re-investigate)
    ▼   │
 [CLOSED] (Terminal: No further transitions allowed)
```

- `open` -> `investigating`, `resolved`, `closed`
- `investigating` -> `open`, `resolved`, `closed`
- `resolved` -> `investigating`, `closed`
- `closed` -> (terminal; no transitions permitted. Rejects with 400 Bad Request `INVALID_STATUS_TRANSITION`)
- Transitioning to the exact same status returns 409 Conflict.

### Incident Action Types (`incident_action_type`)

- `REPORTED` (`reported`): Incident initially reported.
- `ASSIGNED` (`assigned`): Responsibility assigned to a user.
- `STATUS_CHANGED` (`status_changed`): Status transitioned.
- `NOTE_ADDED` (`note_added`): Operational note or resolution remark appended.

## 7. Business Flow

1. **Incident Creation/Reporting**:
   - Host or Porter submits incident details (`title`, `description`, `severity`, `occurredAt`).
   - Incident is persisted with status `OPEN` and an initial audit action (`REPORTED`) is recorded.
2. **Assignment (PB AC-2)**:
   - Host assigns incident to an active user (`assignedTo`).
   - System records an `ASSIGNED` action in `incident_actions`.
3. **State Transition & Resolution (PB AC-3)**:
   - Handler/Host transitions status (e.g. `OPEN` -> `INVESTIGATING` -> `RESOLVED` -> `CLOSED`).
   - Validated against transition matrix.
   - Database row is locked (`FOR UPDATE`) to prevent race conditions.
   - An audit record `STATUS_CHANGED` is appended with optional note.
4. **Audit History Retrieval (PB AC-4)**:
   - Host queries incident history.
   - System returns chronological timeline of all actions taken with author details and timestamps.

## 8. Data & Invariants

### Database Entities

1. **`trip_incidents` Table**:
   - `id`: UUID (Primary Key).
   - `trip_id`: UUID (Foreign Key -> `trips.id`).
   - `reported_by`: UUID (Foreign Key -> `users.id`).
   - `assigned_to`: UUID (Foreign Key -> `users.id`, nullable).
   - `title`: VARCHAR(255).
   - `description`: TEXT.
   - `severity`: Enum (`low`, `medium`, `high`, `critical`).
   - `status`: Enum (`open`, `investigating`, `resolved`, `closed`).
   - `occurred_at`: TIMESTAMPTZ.
   - `created_at`, `updated_at`: TIMESTAMPTZ.

2. **`incident_actions` Table**:
   - `id`: UUID (Primary Key).
   - `incident_id`: UUID (Foreign Key -> `trip_incidents.id` ON DELETE CASCADE).
   - `action_type`: Enum (`reported`, `assigned`, `status_changed`, `note_added`).
   - `previous_status`: Enum (`incident_status`, nullable).
   - `new_status`: Enum (`incident_status`, nullable).
   - `note`: TEXT (nullable).
   - `performed_by`: UUID (Foreign Key -> `users.id`).
   - `created_at`: TIMESTAMPTZ.

## 9. API / Integration Contract

### 1. Report Incident
- **POST** `/trips/:tripId/incidents`
- **Auth**: Bearer Token (Host or Assigned Porter)
- **Body**:
  ```json
  {
    "clientIncidentId": "uuid-optional",
    "title": "Sạt lở nhỏ trên đường",
    "description": "Cần dọn dẹp cành cây",
    "severity": "medium",
    "occurredAt": "2026-10-12T08:00:00.000Z"
  }
  ```
- **Response**: `201 Created` with `IncidentResponseDto`.

### 2. Assign Incident Handler
- **PATCH** `/trips/:tripId/incidents/:incidentId/assign`
- **Auth**: Bearer Token (Owning Host or Admin)
- **Body**:
  ```json
  {
    "assignedTo": "user-uuid",
    "note": "Phân công xử lý"
  }
  ```
- **Response**: `200 OK` with updated `IncidentResponseDto`.

### 3. Update Incident Status
- **PATCH** `/trips/:tripId/incidents/:incidentId/status`
- **Auth**: Bearer Token (Owning Host, Admin, or Assigned Handler)
- **Body**:
  ```json
  {
    "status": "investigating",
    "note": "Đang kiểm tra hiện trường"
  }
  ```
- **Response**: `200 OK` with updated `IncidentResponseDto`.
- **Errors**:
  - `400 Bad Request` with `INVALID_STATUS_TRANSITION` if transition is invalid or incident is `closed`.
  - `409 Conflict` if target status matches current status.

### 4. Get Incident Action History
- **GET** `/trips/:tripId/incidents/:incidentId/history`
- **Auth**: Bearer Token (Owning Host, Admin, or Assigned Porter)
- **Response**: `200 OK` with `IncidentActionResponseDto[]` sorted chronologically.

## 10. Error & Edge Cases

| Case                                 | Expected Behavior                                          |
| ------------------------------------ | ---------------------------------------------------------- |
| Authorized Host creates              | Incident created with status `OPEN` and `REPORTED` action  |
| Unauthorized user mutation           | `403 Forbidden`                                            |
| Valid assignment                     | Responsibility updated and `ASSIGNED` action recorded      |
| Assign to non-existent user          | `404 Not Found`                                            |
| Valid state transition               | Status updated and `STATUS_CHANGED` action recorded        |
| Invalid state transition             | `400 Bad Request` (`INVALID_STATUS_TRANSITION`)            |
| Same state transition                | `409 Conflict`                                             |
| Transition on `CLOSED` incident      | `400 Bad Request` (`INVALID_STATUS_TRANSITION`)            |
| Concurrent state update              | `FOR UPDATE` row lock prevents dirty writes                |
| Incident history queried             | Returns complete, immutable chronological audit trail      |

## 11. Acceptance & Test Matrix

| Source | Scenario                   | Expected Result                         | Test Type   |
| ------ | -------------------------- | --------------------------------------- | ----------- |
| PB AC-1| Create incident by Host    | Persisted with `OPEN` status            | Unit/Integ  |
| PB AC-2| Assign handler             | `assignedTo` saved, action logged       | Unit/Integ  |
| PB AC-3| Valid transitions          | Status updated, action logged           | Unit/State  |
| PB AC-3| Invalid/terminal transitions| `INVALID_STATUS_TRANSITION` error      | Negative    |
| PB AC-3| Same status transition     | `409 Conflict`                          | Negative    |
| PB AC-4| Query action history       | Complete chronological log returned     | Unit/Audit  |
| PB AC-5| Unauthorized mutation      | `403 Forbidden`                         | Security    |
| BR-213 | Concurrency lock           | `FOR UPDATE` query lock                 | Concurrency |

## 12. Open Decisions & Resolution

- **Decision 1 (Status Lifecycle)**: Standardized on 4 states: `OPEN` -> `INVESTIGATING` -> `RESOLVED` -> `CLOSED`. `CLOSED` is final/terminal.
- **Decision 2 (Action Logging)**: Audit records stored in `incident_actions` table, capturing `action_type`, `previous_status`, `new_status`, `note`, `performed_by`, and timestamp.
