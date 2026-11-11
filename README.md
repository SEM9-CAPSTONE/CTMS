# CTMS - Camping Site and Trekking Management System

[Vietnamese version](README.vi.md)

## Description

CTMS (Camping Site and Trekking Management System) is a safety-first campsite and trekking operations platform with mobile apps for Campers and Porters, a web dashboard for Hosts/Admins, and AI-assisted outdoor safety support.

The active product baseline is **Product Backlog v3.1**. Campers discover and book published Trips. Hosts/Admins manage Campsites, internal Routes, checkpoints, hazard areas, Trips, bookings, equipment, porters, weather risk, offline safety packages, realtime safety tracking, financial settlement, audit, reports, and safety analytics.

## Domain Baseline v3.1

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

Trekking Route is an internal reusable geospatial and safety resource. Campers do not browse or book Routes directly. Campers discover and book published Trips.

## Active v3.1 Principles

- Product Backlog v3.1 is the story scope authority; detailed story behavior lives in `file/spec`.
- Business Rules must be implemented as executable validation, authorization, state, transaction, audit, notification, and test behavior.
- Trips are the public booking unit; Routes remain internal operational resources.
- Trip capacity is controlled transactionally at Trip level.
- Porter Assignment is the authoritative Porter schedule record and must be protected against work-range conflicts and concurrent commits.
- Offline Safety Package is versioned and preserves enough route/safety context for historical GPS and safety interpretation.
- Ongoing Trips do not hot-update their active Offline Safety Package in v3.1.
- AI/RAG output is advisory and must not override hard rules, authoritative state, payment state, safety state, or authorization.
- Booking payment, refund, held funds, settlement, platform fee, payout, and reconciliation must be ledger-backed and auditable.
- Safety analytics can propose hotspots, but only reviewed/confirmed hotspots may drive authoritative safety data changes.

## Purpose

CTMS helps outdoor operators publish safe trekking experiences while giving Campers a clear Trip booking and safety-preparation flow. The system focuses on:

- Campsite, Route, Trip, Booking, Booking Member, and Porter workflows with role-based access control.
- Route checkpoints, hazard areas, and versioned offline safety packages.
- Trip planning with waypoints, capacity control, approval, publication, cancellation, and revalidation.
- Booking, payment, refund, settlement, payout, reconciliation, member check-in, equipment, and logistics workflows.
- Weather risk evaluation based on weather factors and configurable rules.
- Offline navigation, GPS tracking, route deviation detection, checkpoint detection, sync batches, SOS/incident handling, and realtime monitoring.
- AI Survival Assistant, RAG source visibility, feedback, unsafe report handling, and advisory analytics.
- Safety evaluation, reporting, route deviation analytics, hotspot review, and new offline package publication.

## Project Structure

```text
ctms/
├── apps/
│   ├── web/                     # React + Vite + TypeScript web dashboard
│   └── mobile/                  # Flutter mobile app for Camper and Porter
├── services/
│   ├── api/                     # NestJS backend API
│   └── ai/                      # Python AI/RAG service
├── docs/                        # Architecture, planning, and design docs
├── file/spec/                   # Active CTMS story specs aligned with PB v3.1
├── file/spec/archived/          # Retired specs kept for history only
├── scripts/                     # Monorepo automation scripts
└── package.json                 # Monorepo root scripts and dependencies
```

## Tech Stack

- Web Frontend: React, Vite, TypeScript, Tailwind CSS, Lucide Icons, Leaflet, Socket.io client
- Mobile: Flutter, Riverpod, go_router, Dio, Freezed/json_serializable, flutter_secure_storage, intl
- Backend: NestJS, TypeScript
- Database: PostgreSQL/PostGIS
- Cache/session support: Redis where appropriate, but not as the authoritative booking, funds, or safety ledger
- Real-time Communication: Socket.io via NestJS WebSocket Gateway
- AI/RAG: Python, FastAPI, LLM, retrieval-augmented generation, safety guardrails
- Maps and Navigation: Leaflet / Mapbox-compatible map stack
- Deployment: AWS EC2, Docker, Nginx, GitHub Actions
- API Documentation and Testing: Swagger/OpenAPI, Postman

## Documentation

- `docs/ARCHITECTURE.md`: architecture baseline for PB v3.1.
- `docs/design/`: design-system and Figma inventory documents.
- `file/spec/`: active story specs. Each spec maps PB v3.1 story scope and materialized Business Rules.
