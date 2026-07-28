# CTMS - Camping Site and Trekking Management System

[English version](README.md)

## Description

CTMS (Camping Site and Trekking Management System) là hệ thống quản lý điểm cắm trại và trekking tích hợp Trợ lý Sinh tồn AI. Dự án hướng tới việc xây dựng một hệ sinh thái đồng bộ gồm ứng dụng di động cho camper/porter và web dashboard cho host nhằm hỗ trợ quản lý đặt chỗ, vận hành logistics, theo dõi trekking và điều phối an toàn trong các môi trường ngoài trời có rủi ro cao.

Hệ thống tập trung vào các bài toán chính như chống overbooking bằng cơ chế khóa slot thời gian thực, quản lý tài nguyên cắm trại, theo dõi GPS khi mất kết nối, cảnh báo lệch tuyến offline, đánh giá rủi ro thời tiết bằng thuật toán rule-based và cung cấp hướng dẫn sinh tồn/first-aid thông qua AI Survival Assistant có khả năng tiền tải dữ liệu để sử dụng ngoại tuyến.

## Purpose

Mục tiêu của dự án là tạo ra một nền tảng phần mềm đa nền tảng giúp campsite host vận hành hiệu quả hơn và giúp trekker/camper an toàn hơn khi tham gia hoạt động ở khu vực hoang dã hoặc nơi kết nối mạng không ổn định.

Cụ thể, CTMS hướng đến:

- Cung cấp quy trình đặt chỗ trực quan, hạn chế xung đột booking và ngăn đặt trùng slot bằng Redis lock và kiểm tra toàn vẹn dữ liệu.
- Hỗ trợ host quản lý layout khu cắm trại, inventory, trekking checkpoints, porter assignment và trạng thái check-in/check-out.
- Cung cấp ứng dụng mobile offline-first cho camper/porter với bản đồ tải trước, GPS tracking, cảnh báo lệch tuyến và cơ chế buffer/sync dữ liệu.
- Xây dựng AI Survival Assistant sử dụng survival knowledge base, RAG/LLM và dữ liệu tiền tải để hỗ trợ tra cứu hướng dẫn sinh tồn khi không có mạng.
- Đánh giá rủi ro tuyến đường dựa trên các yếu tố thời tiết như mưa, gió, nhiệt độ, tầm nhìn và sinh cảnh báo an toàn dễ hiểu cho người dùng.
- Đảm bảo cảnh báo khẩn cấp thời gian thực qua WebSocket với độ trễ thấp cho các thiết bị đang kết nối.

## Cấu trúc dự án (Project Structure)

```text
ctms/
├── apps/
│   ├── web/                     # React 18 + Vite + TypeScript Web Dashboard
│   │   ├── src/
│   │   │   ├── core/            # Core system (API endpoints, queryKeys, httpClient, AppLayout, Brand logo)
│   │   │   ├── routes/          # Bộ định tuyến HTML5 Clean URL & AppRoleGuard (camper, host, porter, admin)
│   │   │   ├── shared/          # Shared components (Button, Card), types & trang dùng chung (NotFound, Unauthorized, Error, EdgeCase)
│   │   │   ├── features/        # Kiến trúc mô-đun theo tính năng (Feature-based Modular)
│   │   │   │   ├── auth/        # Đăng nhập Email & Đăng ký 3 bước phân quyền (Camper, Host, Porter)
│   │   │   │   └── landing/     # Màn hình giới thiệu, Mobile mockup preview & Trợ lý Sinh tồn AI
│   │   │   └── index.css        # Hệ thống CSS Design Tokens, Typography, Glassmorphic & Custom Scrollbar
│   ├── mobile/                  # Ứng dụng di động React Native (Expo)
│   └── docs/                    # Tài liệu kiến trúc hệ thống & Sơ đồ CSDL
├── services/
│   ├── api/                     # Backend API NestJS + TypeScript
│   │   ├── src/
│   │   │   ├── modules/         # Các mô-đun NestJS (Auth, Realtime Gateway, Campsites, Safety)
│   │   │   └── shared/          # Shared DTOs, guards, decorators & utilities
│   └── ai/                      # Dịch vụ AI/NLP Python hỗ trợ LLM, RAG & Cẩm nang sinh tồn ngoại tuyến
├── scripts/                     # Automation scripts (validate-branch-name.js)
├── .husky/                      # Git hooks (pre-commit: Biome + lint-staged, pre-push: branch validator)
├── biome.json                   # Biome linter & formatter configuration (tab indent, double quotes)
├── pnpm-workspace.yaml          # Cấu hình pnpm monorepo workspace
└── package.json                 # Monorepo root scripts & dependencies
```

## Proposed Tech Stack

- **Web Frontend**: React 18, Vite, TypeScript, Tailwind CSS v4, Lucide Icons
- **Mobile**: React Native, Expo
- **Backend**: NestJS, TypeScript
- **Database & Cache**: PostgreSQL, Redis
- **Code Quality & Git Hooks**: Biome (Linter/Formatter), Husky, Lint-Staged, Branch Name Validator
- **Real-time Communication**: Socket.io via NestJS WebSocket Gateway
- **AI/NLP**: Python, FastAPI, LLM, RAG, prompt engineering
- **Maps**: Leaflet / Mapbox
- **Deployment**: AWS EC2, Docker, Nginx, GitHub Actions
- **API documentation/testing**: Swagger/OpenAPI, Postman
