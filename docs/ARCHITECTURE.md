# CTMS Architecture Overview

## Domain Baseline v2

The active CTMS domain model is:

```text
Campsite
  ↓
Route
  ↓
Trip
  ↓
Booking
```

Operational visibility is role based:

```text
Host/Admin/System
   ├── Campsite
   ├── Route
   │    ├── Checkpoints
   │    └── Hazard Areas
   └── Trip
         ↓
      Camper
         ↓
      Booking
```

Trekking Route is an internal reusable geospatial and safety resource. Campers do not browse or book Routes directly. Campers discover and book published Trips.

## Core Entities

- `campsites`: Host-owned campsite profile, location, amenities, policies, operating/season data, media, and publication status.
- `routes`: Internal trekking route owned/managed by Host/Admin/System and used by Trips.
- `checkpoints`: Internal route points such as waypoint, rest, shelter, summit, emergency, water source, and other operational checkpoints.
- `route_hazard_areas`: Internal route polygons with severity and description.
- `trips`: Public-offer candidate created from a Route. Trips begin as `draft`, can move to `pending_approval`, and become Camper-visible only as `published`.
- `trip_waypoints`: Trip-specific itinerary points, optionally linked to Route checkpoints.
- `bookings` and `booking_members`: Camper booking records for published Trips.

## Hard Constraints

- A Route with status `closed` blocks Trip creation, approval, publication, publishable edits, and new booking acceptance.
- Trip capacity is Trip-only: `capacity_min`, `capacity_max`, and `seats_taken`.
- Booking capacity changes must be transactional and serialized by Trip.
- Weather rules are configurable and do not depend on `route_type`.

## Retired v1 Concepts

The v2 architecture intentionally excludes the retired campsite sub-area booking model, campsite-level capacity ledger, layout-reservation flow, Trip campsite-stay rows, cache-backed booking ledger, and peer-to-peer emergency handoff model.

Retired logical specs are kept under `file/spec/archived/` with a tombstone header and their CTMS IDs must not be reused.

## Apps

- `apps/web`: React dashboard for Host/Admin operational workflows, including campsite management, route/checkpoint/hazard management, Trip management, audit/admin functions, and Camper web flows where applicable.
- `apps/mobile`: Flutter app for Camper and Porter experiences, including Trip discovery/booking, assigned Trip operations, offline navigation, route deviation detection, SOS/incident handling, profile, and AI assistance.

## Services

- `services/api`: NestJS backend for authentication, RBAC, Campsite/Route/Trip/Booking workflows, payments/refunds, equipment, Porter operations, audit logs, PostgreSQL/PostGIS access, and WebSocket events.
- `services/ai`: Python service for AI Survival Assistant, RAG retrieval, and safety/weather advice generation.

## Infrastructure

- PostgreSQL/PostGIS stores relational business data and geospatial route/campsite/trip data.
- Redis may support sessions, cache, queues, or short-lived operational coordination, but not the authoritative booking capacity ledger.
- Docker Compose supports local development and deployment foundations.
- Nginx serves the web app and reverse proxies API, WebSocket, and AI traffic.
- GitHub Actions runs CI and deployment workflows.
