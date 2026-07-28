# CTMS - Camping Site and Trekking Management System

[Vietnamese version](README.vi.md)

## Description

CTMS (Camping Site and Trekking Management System) is a camping site and trekking management platform integrated with an AI Survival Assistant. The project aims to build a synchronized ecosystem that includes a mobile application for campers and porters, together with a web dashboard for campsite hosts.

The system supports booking management, campsite logistics, trekking coordination, safety monitoring, offline navigation, weather risk evaluation, and survival guidance for outdoor activities in remote or high-risk environments.

## Purpose

The purpose of CTMS is to help campsite hosts operate more efficiently while providing campers and trekkers with a safer experience in wilderness areas where network connectivity may be unstable or unavailable.

CTMS focuses on:

- Providing a visual booking workflow that reduces booking conflicts and prevents duplicated slot reservations through Redis-based locking and relational data integrity checks.
- Helping hosts manage campsite layouts, equipment inventory, trekking checkpoints, porter assignments, and check-in/check-out states.
- Supporting an offline-first mobile experience with pre-downloaded maps, GPS tracking, route deviation alerts, and buffered data synchronization.
- Building an AI Survival Assistant powered by survival knowledge bases, RAG/LLM techniques, and pre-cached data for offline lookup.
- Evaluating route safety based on weather factors such as rain, wind, temperature, and visibility, then generating clear safety advisories for users.
- Delivering low-latency emergency broadcasts through WebSocket communication for connected devices.

## Project Structure

```text
ctms/
├── apps/
│   ├── web/                     # React 18 + Vite + TypeScript Web App
│   │   ├── src/
│   │   │   ├── core/            # Core system abstractions (API endpoints, queryKeys, httpClient, AppLayout, Brand assets)
│   │   │   ├── routes/          # Clean HTML5 router & AppRoleGuard (camper, host, porter, admin)
│   │   │   ├── shared/          # Shared components (Button, Card), types & pages (NotFound, Unauthorized, Error, EdgeCase)
│   │   │   ├── features/        # Feature-based modular architecture
│   │   │   │   ├── auth/        # Login, 3-step Role-based Registration (Camper, Host, Porter)
│   │   │   │   └── landing/     # Landing page, Mobile app preview & AI survival assistant
│   │   │   └── index.css        # Global CSS design tokens, typography, glassmorphism & custom scrollbars
│   ├── mobile/                  # React Native mobile app powered by Expo
│   └── docs/                    # System architecture & database diagrams
├── services/
│   ├── api/                     # NestJS + TypeScript Backend Service
│   │   ├── src/
│   │   │   ├── modules/         # NestJS feature modules (Auth, Realtime Gateway, Campsites, Safety)
│   │   │   └── shared/          # Shared DTOs, guards, decorators & utilities
│   └── ai/                      # Python AI/NLP service for LLM, RAG & offline survival advisories
├── scripts/                     # Monorepo automation scripts (validate-branch-name.js)
├── .husky/                      # Git hooks (pre-commit: Biome + lint-staged, pre-push: branch validator)
├── biome.json                   # Biome linter & formatter configuration (tab indent, double quotes)
├── pnpm-workspace.yaml          # Monorepo workspace configuration
└── package.json                 # Monorepo root dependencies & scripts
```

## Tech Stack

- **Web Frontend**: React 18, Vite, TypeScript, Tailwind CSS v4, Lucide Icons
- **Mobile**: React Native, Expo
- **Backend**: NestJS, TypeScript
- **Database & Cache**: PostgreSQL, Redis
- **Code Quality & Git Hooks**: Biome (Linter/Formatter), Husky, Lint-Staged, Branch Name Validator
- **Real-time Communication**: Socket.io via NestJS WebSocket Gateway
- **AI/NLP**: Python, FastAPI, LLM, RAG, prompt engineering
- **Maps & Navigation**: Leaflet / Mapbox
- **Deployment**: AWS EC2, Docker, Nginx, GitHub Actions
- **API Documentation & Testing**: Swagger/OpenAPI, Postman
