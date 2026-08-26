# CTMS - Camping Site and Trekking Management System

[English version](README.md)

## Mô tả

CTMS (Camping Site and Trekking Management System) là nền tảng vận hành campsite và trekking, gồm ứng dụng mobile cho Camper/Porter, dashboard web cho Host/Admin và AI Survival Assistant phục vụ an toàn ngoài trời.

Baseline v2 tách rõ tài nguyên vận hành nội bộ khỏi luồng đặt chỗ công khai. Camper tìm kiếm và đặt published Trip. Host/Admin quản lý Campsite, Route nội bộ, checkpoint, hazard area, Trip, booking, thiết bị, porter, weather risk, offline safety data và audit trail.

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

Phân quyền nhìn entity:

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

Nguyên tắc active v2:

- Campsite được tạo ở `draft`, Host hoàn thiện thông tin, submit sang `pending_approval`, sau đó Admin duyệt trước khi public.
- Route là tài nguyên nội bộ cho bản đồ, checkpoint, hazard area, weather risk, offline safety package và validate Trip.
- Route `closed` là hard constraint: Trip dùng Route đó không được tạo/duyệt/publish/sửa thành trạng thái publishable hoặc nhận booking mới cho tới khi Route hợp lệ lại.
- Trip bắt đầu ở `draft`, chuyển sang `pending_approval`, và chỉ public sau khi được duyệt.
- Capacity của Trip chỉ dùng `trips.capacity_min`, `trips.capacity_max`, và `trips.seats_taken`.
- Booking được tạo cho published Trip, không đặt trực tiếp Campsite hoặc Route.

Các khái niệm lập kế hoạch v1 đã loại bỏ chỉ được giữ trong archived specs. Tài liệu active v2 không mô hình hóa tiểu khu campsite như đơn vị đặt chỗ, sổ capacity ở cấp campsite, đặt chỗ theo layout, dòng lưu trú campsite của Trip, capacity ledger dựa trên cache, hoặc cơ chế chuyển tiếp khẩn cấp ngang hàng.

## Mục tiêu

CTMS giúp đơn vị vận hành outdoor publish các trekking experience an toàn, đồng thời cho Camper một luồng đặt Trip rõ ràng. Hệ thống tập trung vào:

- Quản lý Campsite, Route, Trip, Booking và Porter theo phân quyền.
- Checkpoint và hazard area của Route dưới dạng dữ liệu vận hành/an toàn có thể tái sử dụng.
- Lập kế hoạch Trip bằng waypoint, kiểm soát capacity, phê duyệt, public, hủy và revalidate Trip.
- Booking, payment, refund, check-in thành viên, equipment và logistics.
- Đánh giá weather risk theo các yếu tố thời tiết và rule cấu hình, không phụ thuộc route type.
- Offline navigation, route deviation detection, sync batches, SOS/incident handling và AI Survival Assistant.

## Cấu trúc dự án

```text
ctms/
├── apps/
│   ├── web/                     # Web dashboard React + Vite + TypeScript
│   └── mobile/                  # Mobile app Flutter cho Camper và Porter
├── services/
│   ├── api/                     # Backend API NestJS
│   └── ai/                      # Dịch vụ AI/NLP Python
├── docs/                        # Tài liệu architecture, planning, design
├── file/spec/                   # CTMS story specs đang active
├── file/spec/archived/          # Specs đã retired, giữ lại để tra lịch sử Git
├── scripts/                     # Automation scripts
└── package.json                 # Root scripts và dependencies
```

## Tech Stack

- Web Frontend: React, Vite, TypeScript, Tailwind CSS, Lucide Icons
- Mobile: Flutter, Riverpod, go_router
- Backend: NestJS, TypeScript
- Database: PostgreSQL/PostGIS
- Cache/session support: Redis khi phù hợp, nhưng không là source of truth cho booking capacity
- Real-time Communication: Socket.io qua NestJS WebSocket Gateway
- AI/NLP: Python, FastAPI, LLM, RAG, prompt engineering
- Maps and Navigation: Leaflet / Mapbox
- Deployment: AWS EC2, Docker, Nginx, GitHub Actions
- API Documentation and Testing: Swagger/OpenAPI, Postman
