# 1.1.2. System Architecture Explanation

The CTMS (Camping and Trekking Management System) is engineered upon a modern, distributed Client-Server architecture designed to ensure high availability, data consistency, and robust offline-first synchronization in outdoor wilderness environments. The entire infrastructure is deployed and hosted on high-performance virtual private server infrastructure (**VPS Sieu Toc**) managed centrally via **Coolify** and containerized with **Docker**, ensuring predictable low-latency networking across Vietnam and automated CI/CD deployment workflows.

The detailed breakdown of the architectural layers is organized as follows:

---

### 1.1.2.1. Presentation Layer

This layer delivers specialized, responsive user interfaces tailored to each actor's operational operational context:

* **Web Application (ReactJS SPA):**
  * **Technology:** Developed using **React 18**, **Vite**, **Tailwind CSS**, and **TanStack Query** (React Query v5) for performant server-state management.
  * **Geospatial Visualization:** Incorporates **Leaflet** and **MapLibre GL** for rendering high-precision topographic maps, elevation profiles, interactive trail routes, checkpoints, and hazard danger zones.
  * **Purpose:** Serves as the primary operational dashboard for management and supervisory actors (**Admin** and **Host**) on desktop/laptop displays. Hosts manage campsite facilities, plan trekking routes, schedule expeditions, monitor live GPS participant telemetry, and manage financial escrow wallets and payouts. Admins oversee system-wide governance, approve published routes, audit critical actions, and handle flagged safety content reports.

* **Mobile Application (Flutter Mobile App):**
  * **Technology:** Built with Google's **Flutter SDK (v3.11+)** and **Dart**, utilizing **Riverpod** for declarative state management, **GoRouter** for strict role-guarded navigation, and **Dio** for robust networking.
  * **Offline-First & Native Sensor Access:** Integrates native device hardware capabilities including background **GPS location tracking** (`geolocator`), **Camera & Image Picker** for photo evidence, hardware compass, and encrypted on-device storage (`flutter_secure_storage` & local SQLite caching) to operate seamlessly in zero-connectivity mountain corridors.
  * **Purpose:** Tailored for field-active users (**Camper** and **Porter**). Campers explore trips, download versioned offline safety packages, navigate on-trail, send emergency SOS alerts, and chat with the AI survival assistant. Porters view assigned operational schedules, track client rosters, navigate offline routes, and report on-trail hazards and incidents.

---

### 1.1.2.2. Application Layer (Services & Logic)

The Application Layer acts as the central business execution engine, orchestrating transactional workflows, spatial safety algorithms, and external service integrations:

* **Backend API Gateway & Business Engine (NestJS):**
  * **Technology:** Built on **Node.js** with the **NestJS** enterprise framework in TypeScript, utilizing **TypeORM** for object-relational mapping, **Passport JWT** for stateless authentication and Role-Based Access Control (RBAC), and **class-validator** for incoming payload schema integrity.
  * **Realtime Communication:** Embeds a **Socket.IO** Gateway backed by Redis pub/sub to deliver sub-second bidirectional messaging for real-time SOS distress alerts, live hiker location telemetry broadcast, trip capacity availability updates, and operational notifications.
  * **Financial & Booking Core:** Enforces atomic database transactions (`QueryRunner`) for seat reservations (pessimistic row locking against overbooking), dynamic cancellation policy evaluations, escrow payment holds, trip financial reconciliations, platform fee deductions, and host payout disbursements.

* **AI & Weather Risk Microservice (Python FastAPI):**
  * **Technology:** Implemented as a high-performance Python microservice using **FastAPI**, **Pydantic**, and the official **OpenAI SDK**.
  * **Multi-Criteria Weather Risk Engine:** Evaluates composite meteorological thresholds (precipitation, wind speed, ambient temperature, visibility, thunderstorm WMO codes) against configurable safety rules to compute standardized color-coded risk levels (Green, Yellow, Red) and enforce booking suspension when routes exceed danger limits.
  * **Survival Assistant (RAG Engine):** Powers the offline/online wilderness survival assistant by ingesting curated first-aid guides, segmenting text into knowledge chunks, and using **OpenAI (GPT-4o-mini)** to generate clear, actionable, hallucination-free emergency advice with referenced sources.

* **Third-Party External Services & Integrations:**
  * **Payment Gateway (PayOS):** Integrates PayOS via `@payos/node` for domestic bank transfer QR payments with instant payment webhook synchronization, ensuring immediate reservation confirmation and verifiable payment records.
  * **Media & Asset Storage (Cloudinary):** Handles cloud-based storage, on-the-fly transformations, and CDN distribution for trip cover banners, checkpoint photographs, and user profile media, offloading server storage and bandwidth.
  * **Weather Telemetry API (Open-Meteo):** Supplies real-time high-resolution meteorological forecasts across GPS trail coordinates without credential bottlenecks, enabling continuous safety evaluations for upcoming departures.
  * **SMS OTP Verification (Twilio):** Serves as the primary SMS delivery gateway for two-factor authentication, account verification, and emergency telephone broadcasts.
  * **Email Notification Service (SMTP / Nodemailer):** Delivers transactional emails, account activation OTP codes, booking invoices, and financial payout receipts via secure SMTP transport.
  * **OpenStreetMap & Vector Map Tiles:** Provides open-source geospatial tile data and trail geometries utilized by web and mobile mapping layers for offline package bundling and trail routing.

---

### 1.1.2.3. Data Layer

This layer safeguards data integrity, transactional persistence, geospatial queries, and caching:

* **Relational & Geospatial Database (PostgreSQL 16 + PostGIS 3.4):**
  * **Relational Integrity:** Serves as the authoritative source of truth across 42 domain tables, safeguarding ACID guarantees for bookings, financial ledgers, audit trails, and member identities.
  * **Spatial PostGIS Engine:** Leverages spatial extensions (`geography(LineString, 4326)` and `geography(Point, 4326)`) to store GPS route geometries, calculate trail lengths and elevation contours, execute bounding-box proximity queries, and detect hiker off-route deviations and hazard zone intrusions.
  * **Vector Embeddings (`pgvector`):** Stores vectorized knowledge chunks for fast semantic cosine-similarity search in RAG survival queries.

* **In-Memory Cache & Message Broker (Redis 7):**
  * Manages active WebSocket connection sessions, rate-limiting counters (throttling brute-force login/OTP attempts), and distributed pub/sub event broadcasting across container instances.

---

### 1.1.2.4. Infrastructure & DevOps

The infrastructure is optimized for continuous delivery, automated container orchestration, and high-speed network performance within Vietnam:

* **Cloud Hosting Platform (VPS Sieu Toc):**
  * Deployed on high-performance **VPS Sieu Toc** virtual servers featuring high-frequency NVMe storage, dedicated compute cores, and direct connection to Vietnam's domestic internet exchange (VNIX), minimizing latency for mobile trackers and real-time Socket.IO broadcasts.
* **Self-Hosted PaaS Management (Coolify):**
  * Utilizes **Coolify** as an open-source, self-hosted Platform-as-a-Service on top of Docker. Coolify automates application container life-cycles, manages environment variables, monitors server resource consumption, handles automatic Let's Encrypt SSL/TLS certificates, and provides zero-downtime rolling deployments.
* **Reverse Proxy & Gateway (Nginx 1.27):**
  * Acts as the edge reverse proxy, managing SSL/TLS termination, HTTP/2 compression, static asset caching, and HTTP-to-WebSocket connection upgrades for real-time telemetry streaming.
* **Containerization (Docker & Docker Compose):**
  * Packages API, AI microservice, web client, database, cache, and reverse proxy into reproducible, isolated Docker containers, guaranteeing operational consistency across development, staging, and production environments.
* **Source Control & CI/CD (GitHub Actions):**
  * GitHub maintains source code version control. Continuous Integration and Deployment (CI/CD) pipelines (`ci.yml`, `deploy-prod.yml`) run automated linting and unit/integration test suites on pull requests, build production multi-stage Docker images, push them to Docker Hub, and trigger deployment webhooks directly to Coolify on VPS Sieu Toc.
