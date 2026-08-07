# CTMS Project Guide

Tài liệu này mô tả các folder chính và những script/lệnh mà team sẽ thường xuyên làm việc trong quá trình phát triển CTMS.

## Cấu Trúc Folder

```text
apps/
  web/
  mobile/
services/
  api/
  ai/
infra/
  docker/
  nginx/
.github/
  workflows/
docs/
```

## Cách Chạy Dự Án

### 1. Công cụ cần có

Member cần cài các công cụ sau:

- Node.js `>= 20`
- pnpm `>= 9`
- Docker Desktop
- Python `>= 3.12`
- uv cho Python environment

Kiểm tra nhanh:

````bash
node --version
pnpm --version
docker --version
python --version
uv --version

### 2. Setup lần đầu

Chạy từ root project:

```bash
pnpm install
````

### 3. Chạy database và cache

Backend sẽ cần PostgreSQL và Redis khi bắt đầu làm các chức năng thật như authentication, booking, slot lock, tracking hoặc cache.

```bash
docker compose up -d postgres redis
```

Kiểm tra container:

```bash
docker compose ps
```

Nếu `postgres` và `redis` đang chạy hoặc healthy thì không cần chạy lại Docker ở mỗi lần dev. Các lần sau thường chỉ cần chạy app bằng pnpm.

### 4. Chạy API và Web nhanh

Lệnh thường dùng nhất khi dev backend + frontend:

```bash
pnpm dev:quick
```

Lệnh này chạy cùng lúc:

- NestJS API
- ReactJS Web Dashboard

Các URL kiểm tra:

```text
Web: http://localhost:5173
API Health: http://localhost:3000/api/health
Swagger: http://localhost:3000/api/docs
```

### 5. Chạy từng phần riêng

Chạy API:

```bash
pnpm dev:api
```

Chạy Web:

```bash
pnpm dev:web
```

Chạy Mobile:

```bash
pnpm dev:mobile
```

Chạy AI service:

```bash
cd services/ai
uv venv
.\.venv\Scripts\activate
uv pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

AI service URL:

```text
AI Health: http://localhost:8000/health
```

### 6. Khi nào cần chạy Docker?

Không phải lúc nào cũng cần chạy toàn bộ Docker.

Khi dev bình thường, nên chạy:

```bash
docker compose up -d postgres redis
pnpm dev:quick
```

Tức là PostgreSQL và Redis chạy bằng Docker, còn API và Web chạy local để hot reload nhanh hơn.

Chỉ chạy full Docker khi muốn kiểm tra gần giống môi trường deploy:

```bash
docker compose up -d --build
```

Full Docker sẽ chạy:

- PostgreSQL
- Redis
- API
- AI service
- Web
- Nginx

URL khi chạy full Docker:

```text
Web qua container: http://localhost:5173
Nginx gateway: http://localhost:8080
API: http://localhost:3000/api/health
AI: http://localhost:8000/health
```

### 7. Dừng services

Dừng toàn bộ container:

```bash
docker compose down
```

Dừng terminal dev local:

```text
Ctrl + C
```

### 8. Kiểm tra trước khi tạo Pull Request

Trước khi tạo PR, nên chạy:

```bash
pnpm lint:all
pnpm build:all
pnpm test:all
```

Nếu chỉ sửa docs hoặc README thì không cần chạy toàn bộ build, nhưng nên kiểm tra lại nội dung file đã chỉnh.

### 9. Lỗi thường gặp

Nếu `pnpm` báo lỗi Corepack trên Windows, mở PowerShell bằng Administrator và chạy:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

## Root Project

Các file ở root quản lý toàn bộ monorepo:

- `package.json`: khai báo script chung cho toàn project.
- `pnpm-workspace.yaml`: khai báo workspace cho `apps/*` và `services/*`.
- `tsconfig.base.json`: cấu hình TypeScript dùng chung.
- `eslint.config.mjs`: cấu hình lint dùng chung cho TypeScript/React.
- `.env.example`: mẫu biến môi trường cho local development.
- `docker-compose.yml`: cấu hình chạy PostgreSQL, Redis, API, AI service, Web và Nginx.

Các script ở root:

```bash
pnpm dev:quick
pnpm dev:api
pnpm dev:web
pnpm dev:mobile
pnpm lint:all
pnpm build:all
pnpm test:all
```

Ý nghĩa:

- `pnpm dev:quick`: chạy nhanh API và Web cùng lúc.
- `pnpm dev:api`: chạy NestJS API ở chế độ watch.
- `pnpm dev:web`: chạy React web dashboard.
- `pnpm dev:mobile`: chạy Flutter mobile app (tương đương `cd apps/mobile && flutter run`).
- `pnpm lint:all`: chạy lint cho các workspace có script `lint`.
- `pnpm build:all`: build các workspace có script `build`.
- `pnpm test:all`: chạy test cho các workspace có script `test`.

## apps/web

ReactJS web dashboard dành cho campsite host.

Các phần sẽ làm việc chính:

- `apps/web/src/App.tsx`: entry UI hiện tại của dashboard.
- `apps/web/src/main.tsx`: mount React app.
- `apps/web/src/styles.css`: style global ban đầu.
- `apps/web/vite.config.ts`: cấu hình Vite.

Scripts:

```bash
pnpm --filter @ctms/web dev
pnpm --filter @ctms/web build
pnpm --filter @ctms/web preview
pnpm --filter @ctms/web lint
```

## apps/mobile

Flutter mobile app dành cho camper và porter — 1 codebase, điều hướng theo role sau đăng nhập (xem `lib/core/router/app_router.dart`). Không thuộc pnpm workspace (không có `package.json`), quản lý dependency qua `pubspec.yaml`.

Kiến trúc: Riverpod (state/DI) + Clean Architecture theo feature (`domain/` thuần Dart, `data/` gọi API, `application/` chứa Riverpod controller, `presentation/` chứa UI).

Các phần sẽ làm việc chính:

- `apps/mobile/lib/main.dart`, `lib/app.dart`: entry point, wiring theme + router.
- `apps/mobile/lib/core/`: hạ tầng dùng chung (api client, router, theme, storage, env).
- `apps/mobile/lib/features/auth/`: đăng nhập + khôi phục phiên (đăng ký 3 bước theo role còn là placeholder, để sprint sau).
- `apps/mobile/lib/features/camper/`, `apps/mobile/lib/features/porter/`: shell điều hướng theo role (bottom navigation), các tab tính năng còn là "Sắp ra mắt" chờ đúng sprint.
- `apps/mobile/pubspec.yaml`: khai báo dependency (flutter_riverpod, go_router, dio, freezed, flutter_secure_storage...).

Scripts:

```bash
cd apps/mobile
flutter pub get
flutter run
flutter analyze
flutter test
flutter pub run build_runner build --delete-conflicting-outputs   # sau khi sửa model dùng freezed/json_serializable
```

## services/api

NestJS backend API quản lý authentication, booking, campsite operations, WebSocket events, PostgreSQL và Redis.

Các phần sẽ làm việc chính:

- `services/api/src/main.ts`: bootstrap NestJS, Swagger và global API prefix.
- `services/api/src/modules/app.module.ts`: root module.
- `services/api/src/modules/health/health.controller.ts`: health check API.
- `services/api/src/modules/realtime/events.gateway.ts`: Socket.io WebSocket gateway.

Scripts:

```bash
pnpm --filter @ctms/api dev
pnpm --filter @ctms/api start
pnpm --filter @ctms/api start:dev
pnpm --filter @ctms/api build
pnpm --filter @ctms/api lint
pnpm --filter @ctms/api test
```

Các API endpoint ban đầu:

```text
GET /api/health
GET /api/docs
```

## services/ai

Python FastAPI service cho AI Survival Assistant, rule-based weather scoring, RAG và LLM advisories.

Các phần sẽ làm việc chính:

- `services/ai/app/main.py`: FastAPI app và endpoint AI ban đầu.
- `services/ai/requirements.txt`: Python dependencies.

Setup local bằng `uv`:

```bash
cd services/ai
uv venv
.\.venv\Scripts\activate
uv pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Các endpoint ban đầu:

```text
GET /health
POST /weather-risk
```

## infra

Folder `infra` chứa cấu hình hạ tầng để chạy và deploy app.

```text
infra/
  docker/
    api.Dockerfile
    web.Dockerfile
    ai.Dockerfile
  nginx/
    default.conf
    web.conf
```

Ý nghĩa:

- `infra/docker/api.Dockerfile`: build Docker image cho NestJS API.
- `infra/docker/web.Dockerfile`: build Docker image cho React web app.
- `infra/docker/ai.Dockerfile`: build Docker image cho Python AI service.
- `infra/nginx/default.conf`: reverse proxy cho Web, API, WebSocket và AI service.
- `infra/nginx/web.conf`: serve React build bằng Nginx.

Các lệnh Docker thường dùng:

```bash
docker compose up -d postgres redis
docker compose up -d --build
docker compose ps
docker compose logs -f api
docker compose logs -f web
docker compose down
```

## .github/workflows

Các workflow GitHub Actions:

- `ci.yml`: chạy CI khi có Pull Request vào `develop` hoặc `main`.
- `deploy-dev.yml`: build/push Docker images cho môi trường dev khi push vào `develop`.
- `deploy-prod.yml`: build/push Docker images cho production khi push vào `main`.

CI check chính:

```text
Code Quality & Build Checks
```

Tên check này dùng cho branch ruleset nếu team bật required status checks.

## docs

Tài liệu nội bộ của project:

- `docs/ARCHITECTURE.md`: tổng quan kiến trúc.
- `docs/PROJECT_GUIDE.md`: mô tả folder và script cần làm việc.
