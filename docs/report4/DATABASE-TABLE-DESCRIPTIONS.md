# Database Table Descriptions

The following table provides the technical and functional descriptions for all 43 database tables in the CTMS (Camping & Trekking Management System) schema.

| No | Table | Description |
| :---: | :--- | :--- |
| **01** | `users` | Stores core identity, profile details, credentials, and account statuses for all platform actors (Camper, Host, Porter, Admin), including emergency contact information. |
| **02** | `user_medical_profiles` | Maintains individual medical and physical profiles (blood type, allergies, medical notes, fitness, trekking experience) used for emergency response upon user consent. |
| **03** | `devices` | Tracks user mobile devices, registered push notification tokens, and last active timestamps for push delivery and session management. |
| **04** | `refresh_tokens` | Manages hashed session refresh tokens per user device to support secure JWT authentication cycles and token revocation. |
| **05** | `otp_codes` | Handles temporary one-time passcodes for authentication verification (registration, phone verification, password reset) with expiry and attempt counting. |
| **06** | `trekking_routes` | Defines geographic trekking trails with PostGIS spatial line geometries (LineString/Point), elevation profiles, distance, difficulty ratings, and approval statuses. |
| **07** | `checkpoints` | Defines designated milestone points, rest areas, and spatial monitoring coordinates along a specific trekking route. |
| **08** | `route_hazard_areas` | Stores spatial hazard polygons (landslides, flash flood zones, cliffs) along trekking trails with severity levels to issue safety alerts to hikers. |
| **09** | `trips` | Manages scheduled camping and trekking expeditions organized by Hosts based on approved routes, including capacity, pricing, schedules, and policies. |
| **10** | `trip_waypoints` | Defines planned operational stops and itinerary milestones during a trip (start, meal, checkpoint, overnight, finish) with scheduled arrival times. |
| **11** | `trip_media` | Catalogs promotional media, route imagery, and video URLs associated with specific trips for user catalog browsing. |
| **12** | `bookings` | Tracks camper reservation records for trips, capturing party sizes, total amounts, booking life-cycles, and payment statuses. |
| **13** | `booking_members` | Records individual participants under a booking, capturing traveler details and immutable medical profile snapshots for safety compliance. |
| **14** | `porter_profiles` | Holds porter qualifications, certifications, outdoor skill sets, availability statuses, experience years, and cumulative performance ratings. |
| **15** | `porter_requests` | Handles hiring invitations and service requests sent by Hosts or Campers to Porters for specific trips, along with acceptance/rejection statuses. |
| **16** | `porter_assignments` | Manages confirmed porter deployments and duty roles on scheduled trips following accepted service requests. |
| **17** | `equipment` | Inventories camping and trekking gear available for rent (tents, sleeping bags, trekking poles) along with rental pricing, deposits, and stock levels. |
| **18** | `equipment_reservations` | Manages gear rental orders tied to trip bookings, tracking item reservation windows, pickup, and return statuses. |
| **19** | `offline_packages` | Packages versioned offline bundle datasets (vector maps, route coordinates, hazard polygons) for mobile synchronization in zero-connectivity areas. |
| **20** | `gps_logs` | Logs real-time geographic breadcrumbs (latitude, longitude, altitude, accuracy, battery levels) transmitted from hiker devices for tracking and safety. |
| **21** | `sync_batches` | Coordinates offline-to-online data synchronization batches from mobile clients with idempotency keys and sync record statistics. |
| **22** | `weather_snapshots` | Captures historical and forecasted meteorological data (temperature, rainfall, wind speed, humidity, storm probability) along trekking routes. |
| **23** | `weather_rules` | Stores configurable decision rules, formula thresholds, and risk criteria used to assess weather safety levels for trekking corridors. |
| **24** | `weather_risk_assessments` | Records automated weather risk evaluations generated from meteorological snapshots and rules, assigning risk scores, levels, and safety recommendations. |
| **25** | `survival_documents` | Archives wilderness survival handbooks, safety protocols, and outdoor medical guides serving as the source knowledge base for AI assistance. |
| **26** | `knowledge_chunks` | Stores chunked and vector-embedded survival text passages enabling semantic search and Retrieval-Augmented Generation (RAG) queries. |
| **27** | `ai_conversations` | Tracks interactive AI chat sessions between hikers and the on-trip AI assistant during preparation or wilderness navigation. |
| **28** | `ai_messages` | Records individual prompt and response messages within AI conversations, including retrieved context references and response confidence scores. |
| **29** | `user_preferences` | Stores explicit camper preferences regarding route difficulty, trip duration, preferred regions, activities, and group sizes for personalized suggestions. |
| **30** | `trip_recommendations` | Stores algorithmic trip recommendation scores and contextual rationale generated for individual campers based on their historical profiles. |
| **31** | `reviews` | Captures post-trip ratings and narrative feedback submitted by campers for trips, hosts, or porters. |
| **32** | `review_ai_analysis` | Stores AI-analyzed review insights, extracting sentiment classifications, discussed key topics, and summary abstracts. |
| **33** | `reputation_scores` | Maintains aggregated reputation metrics and average star ratings for hosts and porters across all completed engagements. |
| **34** | `demand_insights` | Stores aggregated regional outdoor demand analytics, season trends, and suggested tour types to assist hosts in commercial trip planning. |
| **35** | `payments` | Records payment transaction records, gateway payment references, and settlement statuses for camper bookings. |
| **36** | `payment_holds` | Implements financial escrow holds on booking funds, enforcing retention conditions until trip milestones or refund windows elapse. |
| **37** | `settlements` | Computes comprehensive trip financial reconciliations, balancing gross revenue, cancellations/refunds, platform commissions, and net host dues. |
| **38** | `host_payouts` | Manages disbursement transactions and banking payout records transferring finalized settlement proceeds to trip hosts. |
| **39** | `sos_alerts` | Records emergency SOS distress signals triggered by hikers, containing live coordinates, battery life, emergency categorization, and lifecycle states. |
| **40** | `incidents` | Manages formal incident resolution cases stemming from SOS alarms or on-trail reports, tracking assigned handlers, incident statuses, and resolution notes. |
| **41** | `notifications` | Manages multi-channel user alerts (trip updates, booking deadlines, weather warnings, SOS broadcast alerts) and delivery/read statuses. |
| **42** | `audit_logs` | Provides immutable security audit logging of critical actions, entity changes, actor identities, and metadata for compliance and traceability. |
| **43** | `safety_events` | Stores route-deviation and GPS-quality transitions detected on hiker devices (OFF_ROUTE, ON_ROUTE_RECOVERED, GPS_DEGRADED, GPS_RESTORED) with the original client context (event time, location, accuracy, distance to route, offline flag), the authoritative route and route/package/config versions, and the server receipt time; idempotent by client UUID. |
