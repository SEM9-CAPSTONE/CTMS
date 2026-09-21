# CTMS - Camping Site and Trekking Management System

[English version](README.md)

## Mô tả

CTMS (Camping Site and Trekking Management System) là nền tảng vận hành campsite và trekking theo hướng safety-first, gồm ứng dụng mobile cho Camper/Porter, dashboard web cho Host/Admin và AI Survival Assistant phục vụ an toàn ngoài trời.

Baseline sản phẩm hiện tại là **Product Backlog v3.1**. Camper tìm kiếm và đặt published Trip. Host/Admin quản lý Campsite, Route nội bộ, checkpoint, hazard area, Trip, booking, equipment, porter, weather risk, offline safety package, realtime safety tracking, financial settlement, audit, report và safety analytics.

## Domain Baseline v3.1

Chuỗi vận hành chính:

```text
Campsite / Operating Area
  -> Route
  -> Trip
  -> Booking
  -> Booking Member
```

Chuỗi safety và offline:

```text
Route + Checkpoints + Hazards + Survival Content
  -> Offline Safety Package
  -> Trip Safety Session
  -> GPS Logs / Safety Events / SOS / Incidents
  -> Sync + Realtime Monitoring
  -> Safety Analytics / Hotspot Review / Package Versioning
```

Chuỗi tài chính:

```text
Booking Payment
  -> Held Funds
  -> Refund / Complaint Window
  -> Settlement
  -> Platform Fee
  -> Host Payout
  -> Reconciliation / Adjustment
```

Chuỗi AI:

```text
Curated Survival Documents
  -> Knowledge Chunks
  -> RAG Retrieval
  -> AI Answer / Sources / Feedback / Moderation
```

Trekking Route là tài nguyên geospatial và safety nội bộ có thể tái sử dụng. Camper không browse hoặc book Route trực tiếp. Camper discover và book published Trip.

## Nguyên tắc active v3.1

- Product Backlog v3.1 là nguồn scope chính cho story; behavior chi tiết nằm trong `file/spec`.
- Business Rules phải được hiện thực thành validation, authorization, state, transaction, audit, notification và test behavior có thể thực thi.
- Trip là đơn vị public booking; Route là tài nguyên vận hành nội bộ.
- Trip capacity được kiểm soát transactionally ở cấp Trip.
- Porter Assignment là nguồn authoritative cho lịch Porter và phải chống work-range conflict/concurrent commit.
- Offline Safety Package có version và lưu đủ context để diễn giải GPS/safety history.
- Ongoing Trip không hot-update active Offline Safety Package trong v3.1.
- AI/RAG chỉ mang tính advisory và không được override hard rule, authoritative state, payment state, safety state hoặc authorization.
- Booking payment, refund, held funds, settlement, platform fee, payout và reconciliation phải dựa trên ledger và audit được.
- Safety analytics có thể đề xuất hotspot, nhưng chỉ hotspot đã review/confirm mới được dùng để thay đổi authoritative safety data.

## Mục tiêu

CTMS giúp đơn vị vận hành outdoor publish trekking experience an toàn, đồng thời cho Camper một luồng booking và chuẩn bị safety rõ ràng. Hệ thống tập trung vào:

- Quản lý Campsite, Route, Trip, Booking, Booking Member và Porter theo phân quyền.
- Route checkpoint, hazard area và versioned offline safety package.
- Lập kế hoạch Trip bằng waypoint, kiểm soát capacity, phê duyệt, publish, hủy và revalidate Trip.
- Booking, payment, refund, settlement, payout, reconciliation, member check-in, equipment và logistics.
- Weather risk dựa trên weather factors và configurable rules.
- Offline navigation, GPS tracking, route deviation detection, checkpoint detection, sync batches, SOS/incident handling và realtime monitoring.
- AI Survival Assistant, RAG source visibility, feedback, unsafe report handling và advisory analytics.
- Safety evaluation, reporting, route deviation analytics, hotspot review và publishing offline package version mới.

## Cấu trúc dự án

```text
ctms/
├── apps/
│   ├── web/                     # Web dashboard React + Vite + TypeScript
│   └── mobile/                  # Mobile app Flutter cho Camper và Porter
├── services/
│   ├── api/                     # Backend API NestJS
│   └── ai/                      # Dịch vụ AI/RAG Python
├── docs/                        # Tài liệu architecture, planning, design
├── file/spec/                   # Active CTMS story specs theo PB v3.1
├── file/spec/archived/          # Specs đã retired, giữ lại để tra lịch sử
├── scripts/                     # Automation scripts
└── package.json                 # Root scripts và dependencies
```

## Tech Stack

- Web Frontend: React, Vite, TypeScript, Tailwind CSS, Lucide Icons, Leaflet, Socket.io client
- Mobile: Flutter, Riverpod, go_router, Dio, Freezed/json_serializable, flutter_secure_storage, intl
- Backend: NestJS, TypeScript
- Database: PostgreSQL/PostGIS
- Cache/session support: Redis khi phù hợp, nhưng không là authoritative ledger cho booking, funds hoặc safety
- Real-time Communication: Socket.io qua NestJS WebSocket Gateway
- AI/RAG: Python, FastAPI, LLM, retrieval-augmented generation, safety guardrails
- Maps and Navigation: Leaflet / Mapbox-compatible map stack
- Deployment: AWS EC2, Docker, Nginx, GitHub Actions
- API Documentation and Testing: Swagger/OpenAPI, Postman

## Tài liệu

- `docs/ARCHITECTURE.md`: baseline architecture cho PB v3.1.
- `docs/design/`: design system và Figma inventory.
- `file/spec/`: active story specs, map theo PB v3.1 và Business Rules đã materialize.
