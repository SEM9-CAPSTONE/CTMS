# CTMS-021 — Create Trip

## 1. Overview

Story: CTMS-021

Epic: EPIC 4. Trip Management

Use Case: Create Trip

Priority: Must Have

Goal: Allow an authorized Host to create a Trip from an approved Trekking Route so the Trip can be configured and later submitted for approval without bypassing Route, schedule, capacity, or ownership rules.

Backlog story: As a Host, I want to create a Trip based on an approved Trekking Route so I can configure and submit a valid trekking Trip for approval.

Acceptance Criteria:

| Source  | Criterion                                                                                                                                                                                                                  |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PB AC-1 | Only an authorized Host may create a Trip.                                                                                                                                                                                 |
| PB AC-2 | A Trip must reference an existing approved Trekking Route and the Route version used by the Trip.                                                                                                                          |
| PB AC-3 | Trip creation captures the required Trip information including Host, title, Trip type, duration, schedule, booking deadline, meeting point, meeting time, capacity, and free/paid indicator according to the authoritative data contract. |
| PB AC-4 | Trip time and capacity values must be valid before the Trip is created.                                                                                                                                                    |
| PB AC-5 | A newly created Trip starts in `draft`.                                                                                                                                                                                    |
| PB AC-6 | Creating a Trip does not publish it; waypoint configuration and submission for approval are handled by the following Trip workflows.                                                                                       |
| PB AC-7 | Invalid, unauthorized, or stale requests must not create a partial Trip.                                                                                                                                                   |

## 2. Scope

### In Scope

- Host creation of a Trip based on an existing approved Trekking Route.
- Binding the Trip to the Route and applicable Route version used at creation.
- Capturing the Trip fields required by BR-054 and BR-055.
- Validation of Host authorization and Route relationship.
- Validation of Trip schedule and time ordering.
- Validation that the Host explicitly selects a Meeting Point for the Trip.
- Validation of Trip capacity values.
- Creation of the Trip in `draft`.
- Backend-authoritative validation before persistence.
- Atomic Trip creation.

### Out of Scope

- Creating or approving a Trekking Route; those remain Route-management workflows.
- Configuring Trip waypoints; that remains CTMS-022.
- Submitting, approving, or publishing the Trip; that remains CTMS-022 and CTMS-023.
- Editing, rescheduling, or cancelling an existing Trip; that remains CTMS-027.
- Creating a Booking; that remains CTMS-029.
- Calculating Weather Risk; that remains EPIC 3.
- Allowing the client to set authoritative `seats_taken`.

## 3. Actors & Authorization

- Host
- System, only for backend validation and persistence.

Authorization:

- Only an authenticated actor with Host permission may create a Trip.
- Backend authorization is authoritative; hiding the Create Trip action in the UI is not sufficient authorization.
- The Host must be allowed to use the referenced Route according to the Route ownership/business-scope rules.
- A Host must not create a Trip using a missing, unrelated, or ineligible Route.
- Client-provided `host_id` must not be accepted as proof that the caller is authorized to create the Trip for that Host.

## 4. Preconditions & Dependencies

- CTMS-010 has created the Trekking Route.
- The referenced Route exists.
- The Route is `approved` according to the authoritative Route lifecycle.
- The Route version referenced by the Trip exists and is the version permitted for Trip creation.
- The acting user is authenticated as an authorized Host.
- Required Trip input is available for validation.
- The request has not already produced the same authoritative Trip through an idempotent/retried operation.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-054 | A Trip must reference a valid approved Route version, and host_id must be derived from the authenticated Host creating or managing the Trip. At minimum, the Trip must store title, trip_type, duration_nights, starts_at, ends_at, meeting_point, meeting_at when applicable, booking_deadline, capacity_min, capacity_max, is_free, price_per_person, province_code, city_code, and the required trip_waypoints. province_code and city_code are geographic snapshots used for search/reporting and must remain historically stable. |
| BR-055 | A Trip must satisfy starts_at < ends_at, booking_deadline < starts_at, meeting_at IS NULL or meeting_at <= starts_at, capacity_min > 0, capacity_min <= capacity_max, and seats_taken within [0, capacity_max]. Meeting Point must be explicitly selected by the Host and must be a valid geographic Point, but it is not required to equal the Start Waypoint. If is_free = true, price_per_person must equal 0; if is_free = false, price_per_person must be greater than 0.                                                                                         |
| BR-056 | A newly created Trip must start in draft status. The Host must complete trip_waypoints before submitting the Trip from draft to pending_approval.                                                                                                                                                                                                                                                                                                                                                                                      |
| BR-172 | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                                                                                                                                                                                                                                                                                                                                                   |
| BR-174 | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                                                                                                                                                                                                                                                                                                                          |
| BR-183 | Every data relationship must reference an existing, valid record. Child records must not be created for a resource outside the correct business scope.                                                                                                                                                                                                                                                                                                                                                                                 |
| BR-188 | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone.                                                                                                                                                                                                                                                                                 |
| BR-189 | A valid time interval requires start_time < end_time. start_time = end_time is allowed only for a business case with an explicit rule permitting it.                                                                                                                                                                                                                                                                                                                                                                                   |
| BR-199 | APIs must use consistent error semantics: 401 for authentication failures, 403 for insufficient authorization, 404 for not found, 409 for business conflicts, and 422 for invalid input.                                                                                                                                                                                                                                                                                                                                               |
| BR-200 | Error messages must clearly describe the problem and the user action required, while never exposing stack traces, secrets, or resources the user is not authorized to see.                                                                                                                                                                                                                                                                                                                                                             |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                                                                                                                                                                                  |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                                                                                                                                                                           |

## 6. State & Lifecycle

### Trip

Before creation:

- No Trip exists.

Successful creation:

- Trip is created in `draft`.

Subsequent lifecycle:

`draft`
→ Host configures Trip waypoints through CTMS-022
→ Trip may later be submitted to `pending_approval` according to the approved Trip lifecycle.

Creating the Trip must not directly produce:

- `pending_approval`
- `approved`
- `published`
- `ongoing`
- `completed`

unless a separate approved lifecycle rule explicitly introduces such behavior.

### Route

- Creating a Trip does not change Route state.
- The Trip references the approved Route/version used for the Trip.
- Future Route changes must not silently rewrite the Trip's authoritative Route/version relationship where the domain requires version binding.

### Capacity

- Initial authoritative occupancy must follow the approved capacity model.
- Client input must not be able to fabricate occupied seats.
- Subsequent occupancy changes belong to Booking/capacity workflows.

## 7. Business Flow

### Create Trip

1. Host opens the Create Trip flow.

2. Host selects the Trekking Route to use for the Trip.

3. System loads the authoritative Route and Route version.

4. System verifies that:
   - the Route exists;
   - the Route is `approved`;
   - the Route/version is eligible for Trip creation;
   - the acting Host is authorized to use it.

5. Host enters the Trip information required by the authoritative contract, including applicable:
   - title;
   - Trip type;
   - duration;
   - start time;
   - end time;
   - booking deadline;
   - meeting point selected on the map;
   - meeting time;
   - minimum capacity;
   - maximum capacity;
   - free/paid indicator.

6. System validates required fields, enums, identifiers, relationships, schedule, Meeting Point, and capacity.

7. System validates `starts_at < ends_at`.

8. System validates `meeting_at <= starts_at` when `meeting_at` is present.

9. System rejects any client attempt to establish unauthorized authoritative occupancy or another server-derived value.

10. If all validation passes, the system creates the Trip atomically.

11. The new Trip is persisted in `draft`.

12. System returns the created Trip.

13. Host may proceed to CTMS-022 to configure Trip waypoints.

14. No approval or publication occurs as a side effect of Create Trip.

## 8. Data & Invariants

- Every Trip created by this flow has an authoritative Host relationship.
- Every Trip created by this flow references an existing approved Route.
- The applicable Route/version relationship is preserved according to the authoritative domain model.
- `starts_at < ends_at`.
- Required datetime fields must satisfy the authoritative Trip time constraints.
- Meeting Point is explicitly chosen by the Host and is not silently defaulted from the Start Waypoint.
- Meeting Point may differ from the Start Waypoint.
- Changing the selected Trekking Route must not overwrite an already chosen Meeting Point.
- `meeting_at <= starts_at` when `meeting_at` exists.
- `capacity_min` and `capacity_max` must satisfy the authoritative capacity constraints.
- `capacity_min` must not exceed `capacity_max`.
- `seats_taken` must not be established from untrusted client input.
- A newly created Trip has `status = draft`.
- Create Trip does not implicitly submit, approve, or publish the Trip.
- Invalid input produces no partially persisted Trip.
- Failed authorization produces no Trip.
- A stale or conflicting request must not overwrite another authoritative Trip state.
- Cross-entity references must point to existing resources inside the permitted business scope.

## 9. API / Integration Contract

TBD — Technical Design.

The exact endpoint, request DTO, response DTO, Route-version identifier representation, Trip enum definitions, and persistence implementation must follow the approved Technical Design and Data Dictionary.

The API contract must not contradict the business invariants defined in this specification.

## 10. Error & Edge Cases

| Case                                                                          | Expected Behavior                                                                                         |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Unauthenticated actor attempts Trip creation                                  | Reject; no Trip is created.                                                                               |
| Non-Host attempts Trip creation                                               | Reject; no Trip is created.                                                                               |
| Host references a Route they are not authorized to use                        | Reject; no Trip is created.                                                                               |
| Referenced Route does not exist                                               | Reject as not found; no Trip is created.                                                                  |
| Referenced Route is not `approved`                                            | Reject; no Trip is created.                                                                               |
| Referenced Route version is invalid or stale                                  | Reject with the applicable validation/business conflict; no Trip is created.                              |
| Required Trip field is missing                                                | Reject before persistence.                                                                                |
| Meeting Point is missing                                                      | Reject with an actionable field-level error; do not silently block progress.                              |
| Meeting Point differs from Start Waypoint                                     | Allow when all other Trip validation passes.                                                              |
| Host changes Trekking Route after selecting Meeting Point                     | Preserve the selected Meeting Point unless the Host explicitly changes it.                                |
| `meeting_at > starts_at`                                                      | Reject.                                                                                                   |
| `starts_at == ends_at`                                                        | Reject.                                                                                                   |
| `starts_at > ends_at`                                                         | Reject.                                                                                                   |
| `capacity_min > capacity_max`                                                 | Reject.                                                                                                   |
| Capacity value violates authoritative numeric constraints                     | Reject.                                                                                                   |
| Client submits an arbitrary occupied-seat value                               | Do not allow the client value to establish authoritative `seats_taken`.                                   |
| Request contains invalid enum value                                           | Reject before persistence.                                                                                |
| Persistence fails after validation                                            | Roll back; no partially created Trip remains.                                                             |
| Duplicate/retried request would create the same authoritative operation twice | Apply the approved duplicate/idempotency protection; do not silently create inconsistent duplicate state. |
| Trip is created successfully                                                  | Persist as `draft`; do not automatically submit, approve, or publish.                                     |

## 11. Acceptance & Test Matrix

| Source                  | Scenario                                                                          | Expected Result                                                        | Test Type                   |
| ----------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------- |
| PB AC-1, BR-172         | Authorized Host creates a Trip                                                    | Authorization passes and creation proceeds to business validation      | Authorization / Integration |
| PB AC-1, BR-172         | Non-Host attempts Trip creation                                                   | Request is rejected and no Trip exists                                 | Authorization / Integration |
| PB AC-2, BR-054, BR-183 | Host selects an existing approved Route/version inside permitted scope            | Route relationship passes validation                                   | Integration                 |
| PB AC-2, BR-054         | Host selects a Route that is not approved                                         | Request is rejected and no Trip is created                             | Boundary / Integration      |
| PB AC-2, BR-183         | Host references an unrelated Route                                                | Request is rejected and no Trip is created                             | Authorization / Integration |
| PB AC-3, BR-054         | Required identity and Trip fields are valid                                       | Trip data passes validation                                            | Validation / Integration    |
| PB AC-3, BR-055         | Valid schedule, capacity, deadline, meeting time, and free/paid data are supplied | Trip data passes validation                                            | Validation                  |
| PB AC-3, BR-055         | Host selects Meeting Point on the map                                             | Meeting Point passes validation and is persisted                        | Unit / E2E                  |
| PB AC-3, BR-055         | Host has not selected Meeting Point                                               | Field-level error is displayed and Trip is not submitted                | Unit / E2E                  |
| PB AC-3, BR-055         | Meeting Point differs from Start Waypoint                                         | Trip remains valid                                                      | Unit / Integration          |
| PB AC-3, BR-055         | Host changes Route after selecting Meeting Point                                  | Meeting Point is preserved                                               | Unit / E2E                  |
| PB AC-4, BR-188, BR-189 | `starts_at < ends_at`                                                             | Time-range validation passes                                           | Boundary                    |
| PB AC-4, BR-055         | `meeting_at <= starts_at`                                                         | Time relationship validation passes                                    | Boundary                    |
| PB AC-4, BR-055         | `meeting_at > starts_at`                                                          | Request is rejected                                                    | Boundary                    |
| PB AC-4, BR-189         | `starts_at == ends_at`                                                            | Request is rejected                                                    | Boundary                    |
| PB AC-4, BR-189         | `starts_at > ends_at`                                                             | Request is rejected                                                    | Boundary                    |
| PB AC-4, BR-055         | `capacity_min > capacity_max`                                                     | Request is rejected                                                    | Boundary                    |
| PB AC-4, BR-055         | Client attempts to establish invalid authoritative `seats_taken`                  | Client value does not establish authoritative occupancy                | Security / Integration      |
| PB AC-5, BR-056         | Valid Trip creation commits                                                       | Trip exists with `status = draft`                                      | Integration                 |
| PB AC-6, BR-056         | Trip has just been created                                                        | Trip is not automatically submitted, approved, or published            | State / Integration         |
| PB AC-7, BR-174         | Request contains malformed identifier, invalid enum, or invalid required value    | Request is rejected before write                                       | Validation                  |
| PB AC-7, BR-183         | Referenced Route/version no longer exists or is no longer valid                   | Request is rejected without partial Trip                               | Integration                 |
| PB AC-7                 | Persistence fails during creation                                                 | Transaction rolls back and no partial Trip remains                     | Transaction / Integration   |
| BR-199, BR-200          | Authentication, authorization, not-found, conflict, or validation failure occurs  | API returns the applicable error semantics and actionable safe message | API / Integration           |
| BR-212, BR-213          | A mapped rule, enum, state transition, or API contract changes                    | Spec, tests, and data documentation are updated before Done            | Process                     |

## 12. Open Decisions

The current CTMS-021 generated source material identifies the required Trip concepts but does not safely define all of the following values:

- exact `trip_type` enum;
- exact numeric lower/upper bounds for `capacity_min` and `capacity_max`;
- exact relationship between `booking_deadline`, `meeting_at`, and `starts_at` beyond the authoritative time rules;
- exact Route-version identifier/storage representation;
- whether duplicate Create Trip requests require an explicit idempotency key or are protected only through the final API/domain implementation.

These values must come from the approved Business Rules, Data Dictionary, Domain Model, or recorded product decision. They must not be invented in this specification.
