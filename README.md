# CTMS - Camping Site and Trekking Management System

[Vietnamese version](README.vi.md)

## Description

CTMS (Camping Site and Trekking Management System) is a campsite and trekking operations platform with mobile apps for Campers and Porters, a web dashboard for Hosts/Admins, and AI-assisted safety support.

The v2 baseline separates public booking behavior from internal operational resources. Campers discover and book published Trips. Hosts/Admins manage Campsites, internal Routes, route checkpoints, hazard areas, Trips, bookings, equipment, porters, weather risk, offline safety data, and audit trails.

## Domain Baseline v2

```text
Campsite
  ↓
Route
  ↓
Trip
  ↓
Booking
```

Entity visibility:

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

Active v2 rules:

- Campsites are created as `draft`, completed by the Host, submitted to `pending_approval`, and approved before becoming public.
- Routes are internal resources used for geospatial planning, checkpoints, hazard areas, weather risk, offline safety packages, and Trip validation.
- A `closed` Route is a hard constraint: Trips using it cannot be created, approved, published, edited into a publishable state, or newly booked until the Route is valid again.
- Trips start as `draft`, move to `pending_approval`, and are published only after approval.
- Trip capacity is controlled by `trips.capacity_min`, `trips.capacity_max`, and `trips.seats_taken`.
- Bookings are made against published Trips, not Campsites or Routes.

Removed v1 planning concepts are kept only in archived specs. Active v2 docs must not model campsite sub-areas as booking units, campsite-level capacity ledgers, layout-based reservations, Trip campsite-stay rows, cache-based booking ledgers, or peer-to-peer emergency handoff.

## Purpose

CTMS helps outdoor operators publish safe trekking experiences while giving Campers a clear Trip booking flow. The system focuses on:

- Campsite, Route, Trip, Booking, and Porter workflows with role-based access control.
- Route checkpoints and hazard areas as reusable safety/operations data.
- Trip planning with waypoints, capacity control, approval, publication, cancellation, and revalidation.
- Booking, payment, refund, member check-in, equipment, and logistics workflows.
- Weather risk evaluation based on weather factors and configurable rules that do not depend on route type.
- Offline navigation, route deviation detection, synchronization batches, SOS/incident handling, and AI Survival Assistant support.

## Project Structure

```text
ctms/
├── apps/
│   ├── web/                     # React + Vite + TypeScript web dashboard
│   └── mobile/                  # Flutter mobile app for Camper and Porter
├── services/
│   ├── api/                     # NestJS backend API
│   └── ai/                      # Python AI/NLP service
├── docs/                        # Architecture, planning, and design docs
├── file/spec/                   # Active CTMS story specs
├── file/spec/archived/          # Retired specs kept for Git history only
├── scripts/                     # Monorepo automation scripts
└── package.json                 # Monorepo root scripts and dependencies
```

## Tech Stack

- Web Frontend: React, Vite, TypeScript, Tailwind CSS, Lucide Icons
- Mobile: Flutter, Riverpod, go_router
- Backend: NestJS, TypeScript
- Database: PostgreSQL/PostGIS
- Cache/session support: Redis where appropriate, but not as the booking capacity source of truth
- Real-time Communication: Socket.io via NestJS WebSocket Gateway
- AI/NLP: Python, FastAPI, LLM, RAG, prompt engineering
- Maps and Navigation: Leaflet / Mapbox
- Deployment: AWS EC2, Docker, Nginx, GitHub Actions
- API Documentation and Testing: Swagger/OpenAPI, Postman
