# Instruction: Tạo Feature Fullstack End-to-End

## Mục tiêu
Hướng dẫn step-by-step tạo feature hoàn chỉnh cả Backend (NestJS) + Frontend (React) với type alignment.

---

## Thứ tự thực hiện

```
1. Prisma Schema (nếu cần)
2. Backend: Types → DTOs → Service → Controller → Module → i18n → Tests
3. Frontend: Types → Constants → Endpoints → QueryKeys → Service → Hooks → Components → Pages → Routes → i18n
4. Verify type alignment
5. Test end-to-end
```

---

## Phase 1: Backend

> Xem chi tiết: [create-nestjs-feature.md](file:///c:/Users/ASUS/Desktop/ehub-befe/.agents/skills/nestjs-feature-generator/instructions/create-nestjs-feature.md)

### Tóm tắt:
1. Cập nhật `prisma/schema.prisma` + chạy migration
2. Tạo `<feature>.types.ts` — dùng `Prisma.ModelGetPayload<>`
3. Tạo `dtos/` — `class-validator` + `@ApiProperty`
4. Tạo `<feature>.service.ts` — ALL business logic, Prisma types
5. Tạo `<feature>.controller.ts` — thin, delegate, `BaseResponse.ok()`, `i18n.t()`
6. Tạo `<feature>.module.ts` → đăng ký trong `app.module.ts`
7. Tạo `src/i18n/{en,vi}/<feature-name>.json`
8. Tạo `<feature>.service.spec.ts`

---

## Phase 2: Frontend

> Xem chi tiết: [create-react-feature.md](file:///c:/Users/ASUS/Desktop/ehub-befe/.agents/skills/react-feature-generator/instructions/create-react-feature.md)

### Tóm tắt:
1. Tạo `types.ts` — matching backend response shape
2. Tạo `constants.ts` — staleTime, pollInterval, pagination
3. Thêm endpoints vào `core/api/endpoints.ts`
4. Thêm query keys vào `core/api/queryKeys.ts`
5. Tạo `services/featureName.service.ts` — typed httpClient calls
6. Tạo `hooks/` — TanStack Query wrappers
7. Tạo `components/` — small, SOLID, Shadcn UI
8. Tạo `pages/` — compose components
9. Tạo `routes/` — route definitions
10. Tạo i18n files + đăng ký namespace
11. Tạo `schema/` — Zod validation (nếu có form)

---

## Phase 3: Type Alignment

### Kiểm tra API Contract

Backend response shape (từ `BaseResponse`):
```typescript
{
	data: T,           // ← FE types.ts phải match T
	message: string,
	metadata?: M       // ← FE PageMetaData phải match M
}
```

### Mapping Table

| Backend | Frontend |
|---|---|
| `BaseResponse<Feature[]>` | `ApiResponse<FeatureItem[], PageMetaData>` |
| `CreateFeatureDto` fields | `CreateFeaturePayload` interface |
| `UpdateFeatureDto` fields | `UpdateFeaturePayload` interface |
| `FeatureStatus` enum (Prisma) | `FeatureStatus` type (union hoặc enum) |
| `@ApiProperty()` types | Form schema (Zod) types |

### Ví dụ mapping

```typescript
// Backend DTO
export class CreateFeatureDto {
	@IsString() @IsNotEmpty() name!: string;
	@IsString() @IsOptional() description?: string;
	@IsEnum(FeatureStatus) @IsOptional() status?: FeatureStatus;
}

// Frontend payload — PHẢI khớp DTO fields
export interface CreateFeaturePayload {
	name: string;
	description?: string;
	status?: FeatureStatus;
}

// Frontend Zod schema — PHẢI khớp payload
export const createFeatureSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
});
```

---

## Phase 4: Verify

### Chạy Backend

```bash
cd ehub-nestjs-be
npx tsc --noEmit          # TypeScript check
npx jest src/features/<feature>/  # Unit tests
npm run start:dev          # Start server
```

### Chạy Frontend

```bash
cd ehub-reactjs-fe
npx tsc --noEmit          # TypeScript check
npx biome check src/features/<feature>/  # Lint
npm run dev               # Start dev server
```

### Test API

```bash
# GET all
curl http://localhost:3000/api/v1/features

# POST create
curl -X POST http://localhost:3000/api/v1/features \
	-H "Content-Type: application/json" \
	-d '{"name": "Test", "description": "Test description"}'
```

---

## Checklist Cuối

### Cross-Cutting
- [ ] Zero `any` trong cả FE và BE
- [ ] Types FE matching BE response shape
- [ ] DTO fields matching FE payload interface
- [ ] Zod schema matching DTO validation
- [ ] i18n files cho cả en + vi, cả FE + BE

### Backend
- [ ] Prisma schema + migration
- [ ] Types dùng `Prisma.ModelGetPayload<>`
- [ ] DTOs: `class-validator` + `@ApiProperty`
- [ ] Controller thin → `BaseResponse.ok()` + `i18n.t()`
- [ ] Service fat — all business logic
- [ ] Module registered in `app.module.ts`
- [ ] Unit tests

### Frontend
- [ ] Types, constants defined
- [ ] Endpoints + query keys centralized
- [ ] Services typed with `httpClient<ApiResponse<T,M>>`
- [ ] Hooks wrap TanStack Query
- [ ] Components < 150 lines, SOLID
- [ ] Pages compose components
- [ ] i18n namespace registered
- [ ] Forms: react-hook-form + Zod
- [ ] `tsc --noEmit` pass
