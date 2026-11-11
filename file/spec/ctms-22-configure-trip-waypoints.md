# CTMS-022 — Configure Trip Waypoints

## 1. Overview

Story: CTMS-022

Epic: EPIC 4. Trip Management

Use Case: Configure Trip Waypoints

Priority: Must Have

Goal: Allow the owning Host to configure the operational waypoints and overnight stops of a draft Trip while keeping waypoint timing, Route references, Trip duration, and Trip lifecycle consistent.

Backlog story: As a Host, I want to configure Trip waypoints and overnight stops so the Trip has a complete, time-ordered itinerary before it is submitted for approval.

Acceptance Criteria:

| Source | Criterion |
| --- | --- |
| PB AC-1 | The owning Host can configure waypoints for a Trip while the Trip is in a state that permits itinerary configuration. |
| PB AC-2 | Each Trip waypoint contains the required waypoint type, location, and `planned_at` information according to the authoritative data contract. |
| PB AC-3 | A waypoint may reference a Route Checkpoint only when that Checkpoint belongs to the Route/version used by the Trip. |
| PB AC-4 | Waypoints are ordered chronologically by `planned_at`; `planned_at` must be valid within the Trip schedule. |
| PB AC-5 | The first and last waypoint must satisfy the authoritative start/finish rules. |
| PB AC-6 | Overnight waypoint configuration must be consistent with `duration_nights` and Trip type. |
| PB AC-7 | Invalid waypoint configuration must not partially update the Trip itinerary. |
| PB AC-8 | AI/recommendation output, if used, cannot override the deterministic waypoint and Trip rules. |
| PB AC-9 | When the Trip is submitted for approval, eligible Admin users are notified that a new Trip requires review. |

## 2. Scope

### In Scope

- Add Trip waypoints.
- Edit Trip waypoints.
- Remove Trip waypoints while the Trip is editable.
- Configure waypoint type.
- Configure waypoint location.
- Configure `planned_at`.
- Optionally associate a Trip waypoint with a Route Checkpoint.
- Chronologically order waypoints.
- Validate start and finish waypoints.
- Initialize Start and Finish waypoints from the approved Trekking Route when the Host reaches itinerary configuration.
- Validate overnight stops against `duration_nights`.
- Validate Trip-type compatibility.
- Submit a complete draft Trip to `pending_approval` after waypoint validation succeeds.
- Notify Admin users when a Trip enters `pending_approval`.
- Persist the waypoint set atomically where the operation changes multiple waypoint records.

### Out of Scope

- Creating Route Checkpoints; CTMS-011.
- Creating the Trip; CTMS-021.
- Approving/publishing the Trip; CTMS-023.
- Detecting physical arrival at a Checkpoint; CTMS-061.
- GPS breadcrumb recording; CTMS-059.
- Allowing AI to define authoritative itinerary rules.

## 3. Actors & Authorization

- Host.
- System, for backend validation and persistence.
- AI/recommendation component, only if invoked as an advisory component.

Authorization:

- Only the Host authorized to manage the Trip may configure its waypoints.
- Backend must validate Trip ownership/business scope.
- Trip state must permit waypoint modification.
- Client-side visibility of the edit action is not sufficient authorization.
- AI output is not an authorization or validation source.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-021.

Preconditions:

- Trip exists.
- Acting Host is authorized for the Trip.
- Trip is in `draft` or another explicitly approved state that permits itinerary configuration.
- Trip has valid `starts_at` and `ends_at`.
- Trip is bound to a valid Route/version.
- Any referenced Route Checkpoint exists and belongs to that Route/version.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-056 | A newly created Trip must start in draft status. The Host must complete trip_waypoints before submitting the Trip from draft to pending_approval.                                                                                                                                                                                                                                                                                            |
| BR-057 | trip_waypoints are the structured source of the Trip itinerary. Each waypoint must include trip_id, type, location as Point(4326), day_number > 0, and sequence_order > 0; checkpoint_id is optional. Custom and overnight waypoints may store name, address, note, and external provider/contact/reference information as Trip metadata. location is always a required snapshot, and no shared external-place master entity may be created. |
| BR-058 | Within a Trip, sequence_order must be unique. If planned_at is provided, it must fall within [starts_at, ends_at]. duration_minutes, when provided, must be >= 0.                                                                                                                                                                                                                                                                            |
| BR-059 | Before publishing an overnight Trip, the number of waypoints with type = overnight must exactly match duration_nights, and their day/order placement must be consistent with the Trip duration.                                                                                                                                                                                                                                              |
| BR-060 | A Trip with trip_type = day_trip must have duration_nights = 0 and must not contain any waypoint with type = overnight.                                                                                                                                                                                                                                                                                                                      |
| BR-218 | When trip_waypoint.checkpoint_id is not NULL, the backend must verify that the Checkpoint belongs to trips.route_id and must snapshot checkpoints.location into trip_waypoints.location. Later Checkpoint changes must not automatically alter the Trip's snapshotted location. When checkpoint_id = NULL, the Host must provide a valid custom location.                                                                                    |
| BR-220 | The Start and Finish Trip waypoints must be initialized from the approved Trekking Route's authoritative start and finish locations. Meeting Point is independent Trip data and must not be used to overwrite the Start Waypoint.                                                                                                                                                                                                            |
| BR-221 | Submitting a draft Trip for review changes status to pending_approval only after the complete waypoint set passes validation. The system must notify eligible Admin users that a new Trip is waiting for review.                                                                                                                                                                                                                            |
| BR-174 | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                                                                                                                                                                                                                                |
| BR-183 | Every data relationship must reference an existing, valid record. Child records must not be created for a resource outside the correct business scope.                                                                                                                                                                                                                                                                                       |
| BR-188 | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone.                                                                                                                                                                                       |
| BR-189 | A valid time interval requires start_time < end_time. start_time = end_time is allowed only for a business case with an explicit rule permitting it.                                                                                                                                                                                                                                                                                         |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                                                                                        |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                                                                                 |

## 6. State & Lifecycle

### Trip

`draft`
→ waypoint configuration
→ remains `draft`

A successful waypoint edit does not itself publish or approve the Trip.

When all submission requirements are satisfied:

`draft`
→ submit through the approved Trip submission flow
→ `pending_approval`

### Trip Waypoint

No waypoint
→ create
→ active waypoint belonging to Trip.

Existing waypoint
→ edit
→ updated waypoint.

Existing waypoint
→ remove while editable
→ no longer part of Trip itinerary.

Exact persistence deletion semantics are defined by Technical Design/Data Dictionary.

## 7. Business Flow

1. Host opens a draft Trip.

2. System verifies Host authorization and current Trip state.

3. System loads:
   - Trip schedule;
   - Trip type;
   - `duration_nights`;
   - Route/version;
   - existing Trip waypoints.

4. System initializes or displays Start and Finish waypoints from the approved Route's authoritative start and finish locations.

5. Host creates, edits or removes configurable waypoint data.

6. Meeting Point remains independent Trip data and is not overwritten by Start Waypoint initialization.

7. For each waypoint, backend validates:
   - waypoint belongs to target Trip;
   - required type is valid;
   - location is valid;
   - `planned_at` is valid;
   - `planned_at` lies within Trip schedule.

8. If `checkpoint_id` is provided, backend verifies that the Checkpoint belongs to the Trip's Route/version.

9. System orders itinerary chronologically using `planned_at`.

10. System validates first/last waypoint semantics according to the authoritative waypoint rules.

11. System validates overnight waypoint count against `duration_nights`.

12. System validates Trip-type compatibility.

13. Any AI recommendation is treated only as proposed input and passes through the same deterministic validations.

14. If the complete change set is valid, backend persists it atomically.

15. Trip remains in its permitted configuration state while the Host continues editing.

16. When the Host submits for review, backend revalidates the complete waypoint set.

17. If validation passes, Trip status changes from `draft` to `pending_approval`.

18. System notifies eligible Admin users that a new Trip requires review.

## 8. Data & Invariants

- Every Trip waypoint belongs to exactly the intended Trip.
- A referenced Route Checkpoint belongs to the Route/version used by the Trip.
- `planned_at` is the authoritative waypoint ordering field.
- `planned_at` lies inside the Trip's permitted time range.
- Waypoint ordering is chronological.
- First waypoint satisfies the authoritative `start` requirement.
- Last waypoint satisfies the authoritative `finish` requirement.
- Start and Finish Waypoints are based on the approved Route, not on Meeting Point.
- Meeting Point remains independent from Trip waypoints.
- Overnight configuration agrees with `duration_nights`.
- Trip type and overnight configuration cannot contradict each other.
- `day_number`, `sequence_order`, and `duration_minutes` must not become alternative authoritative scheduling fields if they are merely derived values.
- AI output cannot bypass deterministic validation.
- Invalid batch changes leave the previous authoritative itinerary intact.

## 9. API / Integration Contract

TBD — Technical Design.

The exact endpoint, DTO, Point representation, waypoint-type enum, Checkpoint reference representation, and persistence strategy must follow the approved Technical Design/Data Dictionary.

## 10. Error & Edge Cases

| Case | Expected Behavior |
| --- | --- |
| Unauthorized Host | Reject; itinerary unchanged. |
| Trip not editable | Conflict; itinerary unchanged. |
| Invalid waypoint type | Reject. |
| Invalid location | Reject. |
| `planned_at` before Trip start | Reject. |
| `planned_at` after Trip end | Reject. |
| Duplicate `planned_at` where uniqueness is required | Reject. |
| Referenced Checkpoint belongs to another Route | Reject. |
| First waypoint violates start rule | Reject complete invalid configuration. |
| Last waypoint violates finish rule | Reject complete invalid configuration. |
| Meeting Point differs from Start Waypoint | Keep both values; do not overwrite Meeting Point or Start Waypoint. |
| Route changes before waypoint submission | Reinitialize Start/Finish from the selected approved Route; do not overwrite Meeting Point. |
| Overnight count conflicts with `duration_nights` | Reject. |
| Day-trip type contains prohibited overnight stop | Reject. |
| AI proposes invalid waypoint | Reject proposal as authoritative configuration. |
| One record in multi-waypoint update fails | Roll back the authoritative change set. |
| Complete waypoint set submitted for review | Persist valid waypoints and change Trip to `pending_approval`. |
| Trip submitted for review | Notify eligible Admin users. |

## 11. Acceptance & Test Matrix

| Source | Scenario | Expected Result | Test Type |
| --- | --- | --- | --- |
| PB AC-1, BR-056 | Owning Host edits draft Trip | Configuration allowed | Authorization / Integration |
| PB AC-1 | Unrelated Host edits Trip | Rejected | Security |
| PB AC-2, BR-057 | Valid waypoint submitted | Waypoint persisted | Integration |
| PB AC-3, BR-057, BR-183 | Checkpoint belongs to Trip Route | Reference accepted | Integration |
| PB AC-3, BR-183 | Checkpoint belongs to another Route | Rejected | Boundary |
| PB AC-4, BR-058 | Multiple waypoints supplied | Ordered by `planned_at` | Integration |
| PB AC-4, BR-188 | Waypoint outside Trip schedule | Rejected | Boundary |
| PB AC-5, BR-058 | Valid start/finish ordering | Accepted | Integration |
| PB AC-5, BR-220 | Start/Finish initialized from approved Route | Start and Finish waypoints use Route locations | Unit / E2E |
| PB AC-5, BR-220 | Meeting Point differs from Start Waypoint | Values remain independent | Unit |
| PB AC-6, BR-059 | Overnight count matches duration | Accepted | Integration |
| PB AC-6, BR-059 | Overnight count conflicts with duration | Rejected | Boundary |
| PB AC-6, BR-060 | Trip type conflicts with overnight data | Rejected | Boundary |
| PB AC-7 | One item in atomic update invalid | No partial itinerary update | Transaction |
| PB AC-8, BR-218 | AI suggests rule-breaking waypoint | Deterministic rule wins | AI Safety / Integration |
| PB AC-9, BR-221 | Valid Trip submitted for approval | Trip enters `pending_approval` and Admin notification is emitted | Integration / E2E |
| BR-212, BR-213 | Contract changes | Spec/tests/data docs updated | Process |

## 12. Open Decisions

The authoritative sources must define, rather than this spec invent:

- exact waypoint-type enum;
- exact Point/coordinate representation;
- whether two waypoints may ever share identical `planned_at`;
- exact persistence behavior for deleted waypoints;
- exact allowed Trip states for waypoint editing beyond `draft`, if any.
