# Package Diagram Descriptions

## 1. Frontend Package Descriptions

| No | Package | Description |
| :---: | :--- | :--- |
| 01 | Routes | Defines client-side application routes, URL path mappings, and route guards for role-based navigation and authentication. |
| 02 | Layouts | Provides standardized structural layout wrappers (header, sidebar, footer) to organize navigation and enclose page views. |
| 03 | Components | Contains reusable, generic UI components (buttons, modals, tables, forms, toasts) used across the application. |
| 04 | Pages | Contains feature-specific views and screen modules for business workflows (e.g., auth, trips, booking, profile, admin management). |
| 05 | Services | Encapsulates HTTP client API communication, endpoints, and data fetching operations to interact with backend services. |
| 06 | Store | Manages application state, client-side caching, and server-state synchronization (e.g., TanStack Query, user session state). |
| 07 | Utils | Provides helper functions, formatters, constants, and validation schemas used throughout the frontend. |
| 08 | Public | Stores unbundled static assets directly accessible by URL, including public images, logos, and favicons. |
| 09 | Assets | Contains global styling resources (CSS/Tailwind styles), theme configurations, icons, and bundled media files. |

---

## 2. Backend Package Descriptions

| No | Package | Description |
| :---: | :--- | :--- |
| 01 | Routes | Defines API endpoints and maps HTTP requests to corresponding controller functions. |
| 02 | Controllers | Handles incoming requests, processes input, invokes business logic, and returns responses. |
| 03 | Services | Contains reusable business logic and operations that are independent of controllers and models. |
| 04 | Templates | Stores view templates or email templates used for rendering dynamic content. |
| 05 | Utils | Provides utility functions and helpers used throughout the application. |
| 06 | Middlewares | Implements Express / NestJS middleware, guards, and interceptors for request processing, authentication, validation, and error handling. |
| 07 | Configs | Holds configuration files and environment-specific settings (e.g., database, server, third-party services). |
| 08 | Models | Defines data structures and database interaction logic (ORM/queries) for application entities. |
| 09 | Realtime | A PostgreSQL-driven real-time notification system that listens for database changes (INSERT/UPDATE/DELETE) via LISTEN/NOTIFY and broadcasts updates to connected clients through Socket.IO. Supports modular domain-based listeners for scalable event handling. |
| 10 | Socket | A Socket.IO-based real-time communication module for bidirectional client-server messaging, including authentication, event handling, and room management. Enables features like notifications, user status tracking, and delivery tracking. |

---

## 3. Mobile Package Descriptions

| No | Package | Description |
| :---: | :--- | :--- |
| 01 | App | Defines the routing and screen modules of the mobile application. Organized by feature groups with role-based access control for CTMS personas: `(auth)` (authentication & OTP), `(camper)` (camper workflows & profile), `(porter)` (porter tasks & navigation), `(incidents)` (SOS emergency & hazard reports), `(trips)`, `(bookings)`, `(tracking)` (real-time GPS), `(weather)` (risk alerts), and `(shared)`. |
| 02 | Components | Contains reusable UI components and base widgets (buttons, text fields, cards, custom app bars, status badges, modals) used across multiple mobile screens to maintain design consistency. |
| 03 | Services | Responsible for communicating with the CTMS Backend. Encapsulates HTTP client API configurations, REST endpoints, and WebSocket connections for data fetching and mutations (e.g., authService, tripService, bookingService, trackingService). |
| 04 | Store | Manages global client state and local persistence (using secure storage and state coordinators); stores user sessions, active booking cache, offline GPS breadcrumbs, and notification alerts. |
| 05 | Hooks | Contains state management controllers and custom hooks (StateNotifier / ViewModels) that encapsulate business logic (e.g., OTP verification, trip booking flow, live tracking, weather alert evaluation), separating UI presentation from domain operations. |
| 06 | Utils | A collection of shared helper functions used throughout the mobile app, such as GPS distance calculation, date/time formatting, VND currency conversion, string sanitization, and input validation. |
| 07 | Constants | Stores unchangeable system constants and design tokens, including theme colors (`AppColors`), typography, standard spacing, GPS tracking thresholds, and API endpoint constants. |
| 08 | Types | Contains data models, entities, and type definitions (TypeScript/Dart) standardizing the data contracts transferred between packages and API payloads. |
| 09 | Assets | Stores static resources including route maps, campsite imagery, navigation marker icons, SVG graphics, and custom typography fonts. |
| 10 | Plugins | Integrates native device hardware bridges and platform plugins (background GPS location tracking, camera access, push notifications, compass/sensors). |
| 11 | Scripts | Includes automation scripts (e.g., `run-verify-otp-e2e.ps1`, environment configuration, CI/CD build scripts) supporting automated testing, environment setup, and deployment workflows. |

