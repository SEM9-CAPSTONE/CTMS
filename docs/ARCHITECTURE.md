# CTMS Architecture Overview

> Product baseline: Product Backlog v3.1.
> Detailed story behavior lives in `file/spec`.

## 1. Domain Baseline v3.1

CTMS is a safety-first trekking and camping operations platform.

Core operational chain:

```text
Campsite / Operating Area
  -> Route
  -> Trip
  -> Booking
  -> Booking Member
```

Safety and offline chain:

```text
Route + Checkpoints + Hazards + Survival Content
  -> Offline Safety Package
  -> Trip Safety Session
  -> GPS Logs / Safety Events / SOS / Incidents
  -> Sync + Realtime Monitoring
  -> Safety Analytics / Hotspot Review / Package Versioning
```

Financial chain:

```text
Booking Payment
  -> Held Funds
  -> Refund / Complaint Window
  -> Settlement
  -> Platform Fee
  -> Host Payout
  -> Reconciliation / Adjustment
```

AI chain:

```text
Curated Survival Documents
  -> Knowledge Chunks
  -> RAG Retrieval
  -> AI Answer / Sources / Feedback / Moderation
```

## 2. Role Model

| Role | Primary Responsibility |
| --- | --- |
| Camper | Discover trips, book trips, prepare offline package, use safety/AI assistance, send SOS, review trip/host/porter |
| Host | Create and operate routes/trips, manage bookings, assign porters, monitor trips, handle incidents and financial views |
| Porter | Accept/respond to requests, operate assigned trips, view members, use offline maps, report incidents, handle alerts |
| Admin | Cross-system governance, audit, moderation, reporting, system operations, safety hotspot review and authoritative safety updates |
| System | Scheduled jobs, sync, detection, AI/RAG processing, notifications, settlement automation, package publishing |

Backend authorization is authoritative. UI visibility is a usability layer only.

## 3. Core Entities

| Entity | Purpose |
| --- | --- |
| `users` | Authenticated actors, role assignment, status, profile linkage |
| `campsites` | Host-owned campsite profile and operational context |
| `routes` | Internal reusable trekking route managed by Host/Admin/System |
| `checkpoints` | Route checkpoints for operations and safety detection |
| `route_hazard_areas` | Route-level hazard polygons or zones |
| `trips` | Published operational offer created from a Route |
| `trip_waypoints` | Trip-specific itinerary points, optionally linked to Route checkpoints |
| `bookings` | Camper booking record for a published Trip |
| `booking_members` | Members participating under a booking |
| `porter_profiles` | Porter qualification, availability, profile, and reputation source |
| `porter_requests` | Host request for porter participation |
| `porter_assignments` | Authoritative porter schedule and assignment record |
| `offline_packages` | Versioned offline bundle for route, checkpoint, hazard, survival, and safety data |
| `gps_logs` | Historical GPS telemetry |
| `safety_events` | OFF_ROUTE, checkpoint, SOS, hazard, and related safety event records |
| `incidents` | Operational incident reports and handling state |
| `notifications` | In-app, push, and realtime alert delivery records |
| `payments`, `refunds` | Payment and refund provider-facing records |
| `held_funds`, `settlements`, `payouts`, `adjustments` | Financial ledger and reconciliation records |
| `audit_logs` | Append-only evidence for critical actions |
| `survival_documents`, `knowledge_chunks` | AI/RAG source material |
| `ai_answers`, `ai_feedback` | AI output, user feedback, unsafe reports, and moderation hooks |
| `potential_safety_hotspots` | Analytics-derived candidate hotspots for review |

## 4. Product Modules

| Module | PB v3.1 Coverage |
| --- | --- |
| Authentication and Account | CTMS-001 to CTMS-009 |
| Route and Weather Risk | CTMS-010 to CTMS-020 |
| Trip, Booking, Payment, Equipment | CTMS-021 to CTMS-042 |
| Porter Management | CTMS-043 to CTMS-048 |
| Survival Content and Offline Package | CTMS-049 to CTMS-057 |
| GPS and Safety Tracking | CTMS-058 to CTMS-067 |
| AI Survival Assistant | CTMS-068 to CTMS-073 |
| SOS, WebSocket, Realtime Operations | CTMS-074 to CTMS-087 |
| Notifications and Reviews | CTMS-088 to CTMS-094 |
| Evaluation and Reports | CTMS-095 to CTMS-110 |
| Funds, Settlement, Payout, Reconciliation | CTMS-111 to CTMS-114 |
| Safety Analytics and Package Publishing | CTMS-115 to CTMS-119 |

## 5. Hard Constraints

- Product Backlog v3.1 is the story scope authority.
- Business Rules are implemented as executable validation, authorization, state, transaction, audit, notification, and test behavior.
- Route is an internal operational resource. Campers discover/book Trips, not raw Routes.
- Route status and safety state can block Trip creation, approval, publication, publishable edits, and new booking acceptance.
- Trip capacity is authoritative at Trip level and must be protected transactionally.
- Booking, payment, refund, settlement, payout, and reconciliation must be ledger-backed and auditable.
- Porter Assignment is the authoritative Porter schedule record. It requires accepted request, valid qualification, no work-range conflict, and transaction-protected concurrency.
- Offline Safety Package is versioned and must preserve enough context for historical GPS/safety interpretation.
- Ongoing Trips do not hot-update their active Offline Safety Package in v3.1.
- AI/RAG output is advisory. It must not override hard rules, state, Weather Risk score, payment state, authorization, or safety/package constraints.
- WebSocket and notifications expose state but do not replace backend persistence or audit.
- Every critical action must be auditable without leaking passwords, OTPs, tokens, payment secrets, unnecessary health data, or private location payloads.

## 6. Application Boundaries

### `apps/web`

React dashboard for Public, Admin, and Host workflows:

- Public landing, login, registration.
- Admin operations, route/trip/booking/porter/weather/report/moderation/audit views.
- Host operations, booking management, trip monitoring, customer and financial views.

### `apps/mobile`

Flutter app for Camper and Porter workflows:

- Camper discovery, trip preparation, offline package, AI assistance, SOS, reviews, profile.
- Porter schedule, assigned trip operations, offline map, member status, incidents, alerts.

### `services/api`

NestJS backend responsible for authentication, RBAC, product workflow validation, state transitions, transactions, PostgreSQL/PostGIS access, financial orchestration, offline sync, idempotency, WebSocket events, notifications, and audit logging.

### `services/ai`

AI/RAG service responsible for survival document chunking, retrieval, answer generation with sources, unsafe report handling, and advisory analytics. It does not mutate authoritative state.

## 7. Data and Infrastructure

| Component | Responsibility |
| --- | --- |
| PostgreSQL/PostGIS | Authoritative relational and geospatial data |
| Redis | Sessions, queues, short-lived coordination, cache where non-authoritative |
| Object storage | Media, offline package assets, document artifacts where applicable |
| Queue / Outbox | Post-commit notification/event delivery and retryable jobs |
| WebSocket gateway | Realtime trip, SOS, notification, sync, and operational status updates |
| Docker Compose | Local development and deployment foundation |
| Nginx | Web serving and reverse proxy for API/WebSocket/AI traffic |
| GitHub Actions | CI/CD checks and deployment workflows |

Redis must not become the authoritative booking, funds, or safety ledger.

## 8. Offline and Sync Architecture

- Client records offline GPS logs, safety events, SOS, and feedback with stable client identifiers.
- Sync uses partial acceptance and per-record acknowledgement.
- Duplicate or retried records must not create duplicate authoritative records.
- Server conflict handling must not silently overwrite newer authoritative data.
- Sync payloads preserve event time, client id, GPS accuracy, package/version context, and failure reason where applicable.
- UI exposes pending, synced, failed, stale, degraded, and retry states where relevant.

## 9. Safety Tracking Architecture

- GPS tracking runs within an active Trip safety session.
- Samples are tied to Trip, member/participant, device/session context, and active Offline Safety Package version.
- OFF_ROUTE, ON_ROUTE recovery, checkpoint arrival, behind-schedule warning, SOS, and hazard events become authoritative safety events only through backend rules.
- Historical GPS logs are telemetry and are not the sole source of realtime safety state.
- Safety analytics may generate potential hotspots, but only confirmed hotspots may drive authoritative safety data updates through review/authorization.

## 10. Financial Architecture

- Booking payment success creates funds eligible for hold/settlement rules.
- Refunds before settlement reduce held funds and settlement base.
- Settlement requires completed Trip, complaint/refund windows satisfied, and no blocking claim.
- Platform fee is calculated from settlement rules.
- Host payout requires approval/process state and provider result tracking.
- Reconciliation handles provider reversal, chargeback, admin correction, payout/refund exception, and manual adjustment with full traceability.

## 11. Retired Concepts

The current v3.1 architecture excludes:

- Camper booking directly against raw Route.
- Campsite-level capacity ledger as the authoritative Trip capacity source.
- Redis-backed authoritative booking or funds ledger.
- Peer-to-peer emergency handoff without backend persistence/audit.
- Hot-updating ongoing Trip offline package in v3.1.
- AI overriding hard safety, payment, authorization, or operational state.
