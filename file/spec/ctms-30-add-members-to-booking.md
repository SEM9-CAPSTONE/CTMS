# CTMS-030 — Add Members to Booking

## 1. Overview

Story: CTMS-030

Epic: EPIC 5. Booking and Payment

Use Case: Add Members to Booking (Invitation & Mandatory DiTrek Account Flow)

Priority: Must Have

Goal: Allow the Booking owner to invite and manage companion participants before Trip start while guaranteeing that every participant holds an active DiTrek account for trip safety (check-in/roster, offline map download, GPS & off-route monitoring, emergency alerts, and consented health-profile access for Host/Porter), and ensuring member count, Booking ownership, and Trip capacity remain consistent.

Backlog story: As a Camper, I want to add or invite members to my Booking so the system knows who will participate in the Trip and each participant can safely use DiTrek during the Trip.

Acceptance Criteria:

| Source  | Criterion                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| PB AC-1 | Booking owner automatically holds the primary member slot and can invite/manage companion members while Booking state permits modification (before Trip start). |
| PB AC-2 | Member records and invitations belong strictly to the owning Booking; companions receive read-only access to the Booking and full Trip safety features once accepted. |
| PB AC-3 | Active members plus pending invitations never exceed the authoritative `bookings.num_people` reservation.    |
| PB AC-4 | Every companion must accept using an active DiTrek account whose email matches the invitation; duplicates within a Booking or across active Bookings of the same Trip are rejected. |
| PB AC-5 | Invalid member updates or concurrent accept/invite attempts execute transactionally without corrupting Booking membership. |

## 2. Scope

### In Scope

- Automatically create the primary `booking_members` row (`is_primary = true`, `member_status = registered`) when a Booking is created.
- Invite companion participants by email (`booking_member_invitations`), supporting both existing active DiTrek users and not-yet-registered companions (who open `/invitations/:token`, register a DiTrek account with the invited email, and accept).
- Send optional SMTP invitation emails (when configured) and always provide a shareable `/invitations/:token` link for the Booking owner.
- Allow the Booking owner to revoke pending invitations and remove registered companion members before Trip start (`member_status = removed`, freeing the slot).
- Allow invited Campers to view pending invitations (`GET /api/booking-invitations/mine` or `/invitations/:token`) and accept or decline them.
- Grant accepted companions read-only visibility (`participationRole = "member"`) on Booking list, Booking details, and Packing List, as well as Trip safety access (Roster, Offline Maps, GPS/Checkpoints, Emergency Broadcasts, and consented Health Profile access for Host/Porter).
- Maintain backwards compatibility with existing bulk initialization endpoints (`POST /api/bookings/:bookingId/member-candidates/resolve`, `POST /api/bookings/:bookingId/members`).

### Out of Scope

- Check-in status transitions (`joined`, `no_show`, `left`); covered by CTMS-037.
- Booking payment and refund policy; covered by CTMS-032 / CTMS-034.
- Trip capacity definition; covered by CTMS-024.
- Unregistered guest-only participation without a DiTrek account (explicitly prohibited to protect Trip safety workflows).

## 3. Actors & Authorization

- **Camper (Booking owner)**: Views workspace, creates/revokes invitations, removes companion members before Trip start, and retains exclusive authority over payment, cancellation, and refund mutations.
- **Camper (Invited companion)**: Previews invitation via token, registers/signs in with matching active DiTrek account, accepts or declines invitation, and views Booking details/packing list in read-only mode (`participationRole = "member"`).
- **Host / Porter / Admin**: Sees active (non-removed) members in Trip Roster, completes Bookings ignoring `removed` members, and accesses consented Health Profiles of both primary owners and active companion members.
- **System**: Enforces ownership, slot limits, email matching, duplicate-trip prevention, and transactional integrity on the backend.

## 4. Preconditions & Dependencies

- CTMS-029 Booking exists (`status IN ('pending_payment', 'confirmed')`).
- Trip has not started (`trips.starts_at > now`).
- Every participant accepting an invitation must have an active DiTrek account (`users.status = 'active'`).

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-085 | `booking_members` stores all participants and preserves their status history, including the person who made the Booking. Before Trip start, a member with `member_status = 'removed'` does not count as an active seat holder and is excluded from active check-in roster and completion blockers. Active members plus pending invitations must never exceed `num_people`.                                                      |
| BR-086 | Each Booking has exactly one `booking_member` with `is_primary = true`, created automatically for the Booking owner and non-removable.                                                                                                                                                                                                                                                                                           |
| BR-087 | Before Trip start, active `booking_members` (`member_status <> 'removed'`) cannot exceed `bookings.num_people`. Removing a companion marks `member_status = 'removed'` and frees a slot for re-invitation within the existing seat reservation. After Trip start, member roster edits are locked; operational status changes (`joined`, `no_show`, `left`) follow CTMS-037.                                                     |
| BR-088 | A non-null `user_id` must not appear more than once within the same Booking (`UQ_booking_members_booking_id_user_id`); re-accepting a previously `removed` user reactivates their row to `registered`. A user cannot be an active member in multiple active Bookings of the same Trip.                                                                                                                                            |
| BR-172 | Access control is enforced by the backend using role, ownership, and business scope. Companion read-only access never permits payment, cancellation, refund, or roster mutations.                                                                                                                                                                                                                                                |
| BR-173 | A user may view or modify only data they own unless explicitly authorized as an active Booking participant or assigned Trip Host/Porter.                                                                                                                                                                                                                                                                                         |
| BR-174 | All input emails, UUIDs, and tokens are normalized and validated before processing.                                                                                                                                                                                                                                                                                                                                              |
| BR-175 | The backend is the authoritative source for slot counts, invitation validity, expiration, and membership state.                                                                                                                                                                                                                                                                                                                  |
| BR-176 | Multi-row invitation acceptance, removal, and audit logging execute atomically inside a database transaction with pessimistic locking on the Booking and Invitation rows.                                                                                                                                                                                                                                                        |
| BR-177 | A failed operation rolls back completely and leaves no partial membership or orphaned slot locks.                                                                                                                                                                                                                                                                                                                                |
| BR-180 | Every stateful resource follows defined database enum transitions (`booking_member_status` and `booking_member_invitation_status`).                                                                                                                                                                                                                                                                                            |
| BR-181 | Before changing state, the system validates current Booking/Invitation/Trip state under lock and rejects stale requests with `409 Conflict`.                                                                                                                                                                                                                                                                                     |
| BR-212 | Changes to Business Rules, enums, state transitions, and API contracts are reflected in this specification and automated tests.                                                                                                                                                                                                                                                                                                  |
| BR-213 | Valid-path and violation-path automated tests cover ownership, slot limits, email matching, reactivation, and safety-module integration.                                                                                                                                                                                                                                                                                         |

## 6. State & Lifecycle

### Booking Member (`booking_members.member_status`)
- `registered` (auto-created for primary owner on Booking create, or created/reactivated when companion accepts invitation)
- `registered -> removed` (owner removes companion before Trip start; frees slot)
- `removed -> registered` (re-invited and accepted before Trip start)
- `registered -> joined / no_show / left` (operational lifecycle under CTMS-037)

### Booking Member Invitation (`booking_member_invitations.status`)
- `pending` (reserves 1 slot until `expires_at = trip.starts_at`)
- `pending -> accepted` (invited Camper accepts with matching active DiTrek email)
- `pending -> declined` (invited Camper declines; frees slot)
- `pending -> revoked` (Booking owner revokes before Trip start; frees slot)
- `pending -> expired` (Trip starts or Booking becomes ineligible)

## 7. Business Flow

1. Camper creates Booking (`numPeople >= 1`) -> system automatically creates primary `booking_members` row (`1/numPeople`).
2. For `numPeople > 1`, Booking owner opens Booking Details (Web) or Order/Booking Done screen (Mobile), enters companion's email, and submits an invitation.
3. System validates ownership, Booking eligibility (`pending_payment` / `confirmed`), Trip not started, available slot (`activeMembers + pendingInvitations < numPeople`), no duplicate pending invite, and no duplicate active participation on the Trip.
4. System creates `booking_member_invitations` (`status = pending`, `token`), writes `audit_logs`, optionally sends SMTP email, and returns a shareable `/invitations/:token` link.
5. **Existing DiTrek user**: sees the invitation in `GET /api/booking-invitations/mine` (Web Bookings list / Mobile Trips & Orders tab) or opens `/invitations/:token`, and clicks **Accept** or **Decline**.
6. **Unregistered user**: opens `/invitations/:token`, sees Trip details and DiTrek safety notice, clicks **Register DiTrek account** (email prefilled), completes registration/OTP verification, signs in, and clicks **Accept**.
7. On acceptance, system atomically adds/reactivates the user in `booking_members` (`is_primary = false`, `member_status = registered`), marks invitation `accepted`, and unlocks full Trip participation (Roster, Offline Map, GPS/off-route, Emergency Broadcasts, Health Profile sharing).
8. Before Trip start, the Booking owner may revoke any `pending` invitation or remove any `registered` companion to invite a replacement.

## 8. Data & Invariants

- `booking_member_invitations` stores pending/historical invitations with unique `token` and partial unique index `UQ_booking_member_invitations_pending_email` on `(booking_id, LOWER(invited_email)) WHERE status = 'pending'`.
- `activeMembers + pendingInvitations <= bookings.num_people` always holds under Booking row lock.
- Primary owner (`is_primary = true`) cannot be removed.
- Companion members (`participationRole = "member"`) cannot invoke owner-only mutations (payment, cancel, refund, invite, revoke, remove).

## 9. API / Integration Contract

### Invitation & Companion Management Endpoints
- `GET /api/bookings/:bookingId/invitations` (Camper owner): returns active members, pending invitations, slot counts, and `canManage`.
- `POST /api/bookings/:bookingId/invitations` (Camper owner): body `{ email }`; creates pending invitation, dispatches email when SMTP is configured, returns `{ invitation, emailSent, workspace }`.
- `DELETE /api/bookings/:bookingId/invitations/:invitationId` (Camper owner): revokes a pending invitation and returns updated workspace.
- `DELETE /api/bookings/:bookingId/members/:memberId` (Camper owner): marks a registered companion member as `removed` before Trip start and returns updated workspace.
- `GET /api/booking-invitations/mine` (Camper): returns active pending invitations sent to the authenticated user's email.
- `GET /api/booking-invitations/:token` (Public): returns safe preview (Trip title, route name, schedule, inviter display name, invited email, `hasAccount`, `status`, `canRespond`).
- `POST /api/booking-invitations/:token/accept` (Camper): validates email match & active account, inserts/reactivates `booking_members`, marks invitation `accepted`.
- `POST /api/booking-invitations/:token/decline` (Camper): marks invitation `declined` and frees the slot.

### Backwards-Compatible Endpoints Preserved
- `POST /api/bookings/:bookingId/member-candidates/resolve`
- `POST /api/bookings/:bookingId/members` (bulk roster initialization)
- `GET /api/bookings` & `GET /api/bookings/:bookingId` (extended with optional `participationRole: "owner" | "member"` and member `fullName`)

## 10. Error & Edge Cases

| Case                                         | Expected Behavior                              |
| -------------------------------------------- | ---------------------------------------------- |
| Non-owner tries to invite/revoke/remove      | `403 Forbidden`                                |
| Booking cancelled/expired or Trip started    | `409 Conflict`                                 |
| Inviting owner's own email                   | `409 Conflict`                                 |
| Duplicate pending invite or active member    | `409 Conflict`                                 |
| Invitee already active in another Trip order | `409 Conflict`                                 |
| All `numPeople` slots occupied/pending       | `409 Conflict`                                 |
| Accepting with mismatched signed-in email    | `403 Forbidden`                                |
| Removing primary member or checked-in member | `409 Conflict`                                 |
| Re-inviting previously removed member        | Reactivates existing row to `registered`       |

## 11. Acceptance & Test Matrix

| Source  | Scenario                                                | Expected Result                                          | Test Type   |
| ------- | ------------------------------------------------------- | -------------------------------------------------------- | ----------- |
| PB AC-1 | Booking created -> primary member auto-created          | `is_primary = true` row exists immediately               | Unit / Int  |
| PB AC-1 | Owner invites unregistered email                        | Pending invitation created + shareable link returned     | Unit / UI   |
| PB AC-2 | Non-owner attempts invite/revoke/remove                 | Rejected with `403`                                      | Security    |
| PB AC-3 | Inviting beyond `numPeople` slots                       | Rejected with `409`                                      | Boundary    |
| PB AC-4 | Accepting with mismatched email                         | Rejected with `403`                                      | Security    |
| PB AC-4 | Accepting with matching active DiTrek account           | Member added to `booking_members`, visible in Bookings   | Unit / UI   |
| PB AC-5 | Removing companion before Trip start and re-inviting    | Slot freed, removed member ignored in Roster/Completion  | Transaction |
| Safety  | Host/Porter views companion's consented Health Profile  | Authorized via active `booking_members`                  | Unit        |
