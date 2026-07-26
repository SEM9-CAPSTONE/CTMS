# CTMS Architecture Overview

## apps

- `apps/web`: Dashboard React dành cho host để quản lý đặt chỗ, layout khu cắm trại, tuyến trekking, inventory và giám sát tình huống khẩn cấp.
- `apps/mobile`: Ứng dụng mobile dành cho camper và porter để đặt chỗ, dùng bản đồ offline, theo dõi GPS, nhận cảnh báo lệch tuyến và truy cập gói hướng dẫn sinh tồn.

## services

- `services/api`: Backend NestJS phụ trách authentication, booking workflow, RBAC, vận hành campsite, WebSocket events, truy cập PostgreSQL và Redis slot locks.
- `services/ai`: Dịch vụ Python phụ trách diễn giải rủi ro thời tiết, LLM advisories, RAG retrieval và API cho AI Survival Assistant.

## Infrastructure

- PostgreSQL lưu dữ liệu nghiệp vụ dạng quan hệ và các operational logs dạng JSONB.
- Redis lưu slot locks tạm thời, session/cache và trạng thái real-time ngắn hạn.
- Docker Compose hỗ trợ chạy môi trường local và làm nền cho deploy lên AWS EC2.
- Nginx serve web app và reverse proxy traffic tới API, WebSocket và AI service.
- GitHub Actions chạy CI và các workflow deploy.
