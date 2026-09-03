# CTMS-28 - Block New Registrations when Route Risk Is Red

**Spec Reference**  
/file/spec/ctms-28-block-new-registrations-when-route-risk-is-red.md

**Story Title**  
Block New Registrations when Route Risk Is Red

**Status**  
In Progress

**Story**  
As a Host or Camper, I want the system to block New Registrations when Route Risk is Red so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [x] Do not create new bookings for a Trip/route with Red risk (BR-072).
- [x] Show the reason and assessment time (BR-071, BR-073).
- [x] Do not create Trip Member / booking records when registration is blocked due to Red risk (BR-243).

## System Flow & Behavior Specifications

### Actors
- **Camper / User**: Customer requesting registration / booking creation on a Trekking Trip.
- **Host / Admin**: Manager of the Trekking Route and Trip.
- **Backend API Service**: Authoritative enforcement component for risk rules and registration eligibility.

### Preconditions
1. The user is authenticated with an active account status (`status = active`, per BR-201, BR-202).
2. The target Trekking Route and Trip exist in the system (BR-214).
3. Weather snapshots and weather risk assessments have been processed or are evaluated at runtime (BR-206).

### Main Flow (Registration Allowed)
1. Camper or Host sends a registration / booking eligibility request for a Trip associated with a Trekking Route.
2. The Backend retrieves the latest `WeatherRiskAssessment` for the route.
3. If the route's `riskLevel` is `GREEN` or `YELLOW`:
   - System returns `allowed = true` with `riskLevel` and details.
   - Booking creation workflow may proceed normally.

### Alternate Flow (No Risk Assessment Available)
1. System checks for a calculated `WeatherRiskAssessment` for the route.
2. If no valid assessment exists or weather snapshot is missing:
   - System returns HTTP 409 Conflict indicating that weather risk score must be refreshed/calculated prior to registration.

### Exception Flow (Risk Level IS RED - Registration Blocked)
1. System detects that the route's `riskLevel` is `RED`.
2. System immediately rejects registration attempt with HTTP `409 Conflict` (BR-231).
3. The response payload explicitly provides:
   - `message`: "New registrations are blocked because route weather risk is RED"
   - `allowed`: `false`
   - `riskLevel`: "red"
   - `assessmentTime`: ISO 8601 timestamp of the latest risk assessment (BR-073)
   - `reasons`: Detailed criteria breakdown (rainfall, wind speed, temperature, visibility, thunderstorm) explaining why risk is Red (BR-071, BR-073)
4. Zero side effects: No records are written to `bookings` or `booking_members` tables (BR-243, AC3).
5. Audit log entry is recorded for the blocked attempt (BR-200).

## API Contract Specification

`POST /api/trekking-routes/:routeId/check-registration-eligibility`

### Request Headers
`Authorization: Bearer <jwt-token>`

### Success Response (GREEN or YELLOW) — HTTP 200 OK
```json
{
  "allowed": true,
  "routeId": "11111111-1111-1111-1111-111111111111",
  "riskLevel": "green",
  "assessmentTime": "2026-09-03T12:00:00.000Z",
  "compositeScore": 0.2,
  "reasons": []
}
```

### Blocked Response (RED Risk) — HTTP 409 Conflict
```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "New registrations are blocked because route weather risk is RED",
  "allowed": false,
  "routeId": "11111111-1111-1111-1111-111111111111",
  "riskLevel": "red",
  "assessmentTime": "2026-09-03T12:00:00.000Z",
  "compositeScore": 1.4,
  "reasons": [
    {
      "criterion": "rainfall",
      "level": "red",
      "value": 60,
      "message": "Rainfall (60mm) exceeds Red threshold"
    },
    {
      "criterion": "wind",
      "level": "red",
      "value": 75,
      "message": "Wind speed (75km/h) exceeds Red threshold"
    }
  ]
}
```

## Business Rules Checklist
- [x] BR-071: The system must not display only a color or total score.
- [x] BR-072: The system must not create new bookings for a Trip or route with Red risk.
- [x] BR-073: The system must display the reason and assessment time.
- [x] BR-200: Every change must be written to the audit log.
- [x] BR-201: Every function requiring authentication may only be performed when the user has a valid login session and the account is active.
- [x] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [x] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [x] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [x] BR-206: The backend is the final authority for permissions, status, pricing, capacity, inventory, risk level, and transaction results; clients must not set these values by themselves.
- [x] BR-207: Every change involving multiple tables or records must run in a transaction; if one step fails, the whole business operation must roll back.
- [x] BR-209: Operations that may be retried, such as payment, refund, callback, and synchronization, must support idempotency so one request cannot be successfully processed more than once.
- [x] BR-214: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope.
- [x] BR-215: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164.
- [x] BR-220: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality.
- [x] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [x] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [x] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [x] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [x] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status: `In Progress`.
- Priority: `Must Have`; Story points: `3`; Commitment: `Committed`.
- Epic: `EPIC 4. Weather Risk`.
- Spec Reference: `/file/spec/ctms-28-block-new-registrations-when-route-risk-is-red.md`.
