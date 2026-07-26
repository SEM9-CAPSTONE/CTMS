# CTMS - Camping Site and Trekking Management System

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

## Expected Core Features

- User Authentication & Role-Based Access Control cho các vai trò Camper, Host và Porter.
- Real-time booking và anti-overbooking slot lock.
- Local navigation và GPS deviation alerting.
- Offline survival pre-cache package.
- Asynchronous trekker tracking với cơ chế buffer & sync.
- Rule-based weather risk assessment kết hợp LLM advisories.
- WebSocket emergency broadcasts.
- Host logistics và trail management dashboard.
- QR check-in/check-out verification.

## Proposed Tech Stack

- Frontend web: ReactJS
- Mobile: React Native hoặc Flutter
- Backend: NodeJS, Express
- Database: PostgreSQL, Redis
- Real-time communication: WebSocket hoặc Socket.io
- AI/NLP: Python, LLM, RAG, prompt engineering
- Maps: Leaflet hoặc Mapbox
- Deployment: AWS EC2, Docker, Nginx, GitHub Actions
- API documentation/testing: Swagger/OpenAPI, Postman
