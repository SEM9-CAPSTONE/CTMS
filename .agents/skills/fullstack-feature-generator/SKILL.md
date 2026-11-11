---
name: fullstack-feature-generator
description: >
  Generates a complete fullstack feature spanning both frontend (React) and backend (NestJS).
  Use when the user asks to create a new end-to-end feature, a complete CRUD module,
  or when a feature needs both API endpoints and UI screens simultaneously.
  Orchestrates both react-feature-generator and nestjs-feature-generator skills.
---

# Fullstack Feature Generator Skill

## Purpose

Generate a complete end-to-end feature module across both the React frontend and NestJS
backend simultaneously, ensuring type consistency, API contract alignment, and proper
i18n across both layers.

## Trigger

Use this skill when:
- User asks to create a new feature end-to-end
- User asks to build a full CRUD module
- User needs both API + UI for a new domain entity
- User says "tạo feature mới" or "tạo module mới"

## Execution Order

### Phase 1 — Requirements & Planning

1. Identify the feature name, data model, and CRUD operations
2. Define the Prisma model schema (if new)
3. Map out API endpoints (REST routes)
4. Plan the UI screens needed

### Phase 2 — Backend First (API Contract)

Generate backend in this order:
1. **Prisma schema** (if new model needed) → run `prisma migrate dev`
2. **Types** (`<feature>.types.ts`) — using Prisma-generated types
3. **DTOs** (`dtos/`) — request validation with class-validator
4. **Service** (`<feature>.service.ts`) — all business logic
5. **Controller** (`<feature>.controller.ts`) — thin REST layer
6. **Module** (`<feature>.module.ts`) — NestJS wiring
7. **i18n** (`src/i18n/{en,vi}/<feature-name>.json`)
8. **Tests** (`<feature>.service.spec.ts`)
9. **Register** in `app.module.ts`

### Phase 3 — Frontend (Consuming API)

Generate frontend in this order:
1. **Types** (`types.ts`) — matching backend response shape
2. **Constants** (`constants.ts`) — query config, pagination defaults
3. **API Endpoints** (add to `core/api/endpoints.ts`)
4. **Query Keys** (add to `core/api/queryKeys.ts`)
5. **Service** (`services/feature.service.ts`) — typed API calls
6. **Hooks** (`hooks/`) — TanStack Query wrappers
7. **Components** (`components/`) — small, focused UI pieces
8. **Pages** (`pages/`) — composing components
9. **Routes** (`routes/`) — route definitions
10. **i18n** (`core/i18n/locales/{en,vi}/<featureName>.json` + register)
11. **Schema** (`schema/`) — Zod validation for forms

### Phase 4 — Type Alignment Check

Verify types match across the boundary:

```typescript
// Backend DTO (request)
export class CreateFeatureDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsOptional() description?: string;
}

// Frontend payload type (must match DTO fields)
export interface CreateFeaturePayload {
  name: string;
  description?: string;
}

// Backend response shape (BaseResponse<T>)
// { data: T, message: string, metadata?: any }

// Frontend response type (must match)
export type ApiResponse<T, M> = {
  message: string;
  data: T;
  metadata?: M;
};
```

### Phase 5 — File Manifest

After generation, the complete feature produces these files:

#### Backend
```
ehub-nestjs-be/src/features/<feature-name>/
├── <feature>.controller.ts
├── <feature>.service.ts
├── <feature>.module.ts
├── <feature>.types.ts
├── <feature>.service.spec.ts
└── dtos/
    ├── create-<feature>.dto.ts
    ├── update-<feature>.dto.ts
    └── get-<feature>-query.dto.ts

ehub-nestjs-be/src/i18n/en/<feature-name>.json
ehub-nestjs-be/src/i18n/vi/<feature-name>.json
```

#### Frontend
```
ehub-reactjs-fe/src/features/<feature-name>/
├── types.ts
├── constants.ts
├── components/
│   ├── FeatureList.tsx
│   ├── FeatureCard.tsx
│   ├── FeatureForm.tsx
│   └── FeatureDialog.tsx
├── hooks/
│   ├── useFeatureList.ts
│   ├── useFeatureDetail.ts
│   └── useFeatureActions.ts
├── services/
│   └── feature.service.ts
├── pages/
│   └── FeaturePage.tsx
├── routes/
│   └── index.tsx
└── schema/
    └── feature.schema.ts

ehub-reactjs-fe/src/core/i18n/locales/en/<featureName>.json
ehub-reactjs-fe/src/core/i18n/locales/vi/<featureName>.json
```

#### Modified Files
```
ehub-nestjs-be/src/app.module.ts              (register new module)
ehub-reactjs-fe/src/core/api/endpoints.ts      (add endpoints)
ehub-reactjs-fe/src/core/api/queryKeys.ts      (add query keys)
ehub-reactjs-fe/src/core/i18n/index.ts         (register namespace)
ehub-reactjs-fe/src/routes/                     (add routes)
```

## Validation Checklist

### Cross-Cutting
- [ ] Zero `any` types in both FE and BE
- [ ] Types aligned between FE and BE
- [ ] i18n files created for both en and vi in both FE and BE
- [ ] Feature registered in both app.module.ts and routes

### Backend
- [ ] Controller thin, service fat
- [ ] DTOs with class-validator
- [ ] Swagger decorators present
- [ ] Auth guards applied
- [ ] BaseResponse used for all responses
- [ ] Prisma types used (not any)
- [ ] Unit tests created

### Frontend
- [ ] Components < 150 lines each
- [ ] TanStack Query for server state
- [ ] Query keys centralized
- [ ] Endpoints centralized
- [ ] Hooks encapsulate logic
- [ ] Services only make API calls
- [ ] Shadcn UI components used
- [ ] Forms use react-hook-form + Zod
- [ ] All text uses t() for i18n
