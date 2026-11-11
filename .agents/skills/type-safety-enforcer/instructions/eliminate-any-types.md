# Instruction: Loại bỏ `any` Types — Quy trình từng bước

## Mục tiêu
Hướng dẫn step-by-step tìm và thay thế tất cả `any` types bằng proper TypeScript types.

---

## Bước 1: Scan toàn bộ project

```bash
# Frontend - tìm any
cd ehub-reactjs-fe
grep -rn "\bany\b" --include="*.ts" --include="*.tsx" src/ | grep -v "node_modules\|\.d\.ts" | grep -v "// .*any"

# Backend - tìm any
cd ehub-nestjs-be
grep -rn "\bany\b" --include="*.ts" src/ | grep -v "node_modules\|\.d\.ts" | grep -v "// .*any"
```

---

## Bước 2: Phân loại theo mức ưu tiên

### 🔴 P0 — Sửa ngay

| Pattern | Ví dụ | Cách sửa |
|---|---|---|
| `any` trong function params | `function f(x: any)` | Thêm type cụ thể |
| `any` trong return type | `(): any =>` | Thêm return type |
| `any[]` | `const list: any[] = []` | Dùng `FeatureItem[]` |
| `Promise<any>` | `async f(): Promise<any>` | `Promise<FeatureItem>` |
| `Record<string, any>` | `const meta: Record<string, any>` | Tạo interface cụ thể |

### 🟡 P1 — Sửa sớm

| Pattern | Ví dụ | Cách sửa |
|---|---|---|
| `as any` | `const x = y as any` | Type assertion đúng |
| `metadata?: any` | Trong BaseResponse | Dùng generic `<M>` |
| Implicit any từ 3rd party | `event` handlers | Dùng React event types |

### 🔵 P2 — Sửa khi refactor

| Pattern | Ví dụ | Cách sửa |
|---|---|---|
| `[key: string]: any` | Index signature | `[key: string]: unknown` |
| Error catch blocks | `catch (e)` | `catch (e: unknown)` + guard |

---

## Bước 3: Sửa từng loại

### 3a. Function Parameters

```typescript
// ❌
function handleChange(value: any) { ... }

// ✅ Xác định type từ context sử dụng
function handleChange(value: FeatureStatus) { ... }

// ✅ React event
function handleClick(event: React.MouseEvent<HTMLButtonElement>) { ... }
function handleChange(event: React.ChangeEvent<HTMLInputElement>) { ... }
function handleSubmit(event: React.FormEvent<HTMLFormElement>) { ... }
```

### 3b. API Response Types

```typescript
// ❌
const response: any = await httpClient.get("/api/features");

// ✅ Dùng generic
const response = await httpClient.get<ApiResponse<FeatureItem[], PageMetaData>>(
	API_ENDPOINTS.FEATURE.GET_ALL,
);
```

### 3c. Prisma Query Results (Backend)

```typescript
// ❌
async findAll(): Promise<any[]> {
	return this.prisma.feature.findMany();
}

// ✅ Dùng Prisma.ModelGetPayload
import { Prisma } from "@prisma/client";

type FeatureWithCategory = Prisma.FeatureGetPayload<{
	include: { category: true };
}>;

async findAll(): Promise<FeatureWithCategory[]> {
	return this.prisma.feature.findMany({
		include: { category: true },
	});
}
```

### 3d. BaseResponse Metadata

```typescript
// ❌ Hiện tại trong project
export class BaseResponse<T> {
	constructor(
		public readonly data: T,
		public readonly message: string = "Success",
		public readonly metadata?: any,  // ← any ở đây
	) {}
}

// ✅ Thêm generic cho metadata
export class BaseResponse<T, M = undefined> {
	constructor(
		public readonly data: T,
		public readonly message: string = "Success",
		public readonly metadata?: M,
	) {}

	static ok<T, M = undefined>(
		data: T,
		message = "Success",
		metadata?: M,
	): BaseResponse<T, M> {
		return new BaseResponse(data, message, metadata);
	}
}
```

### 3e. Error Handling

```typescript
// ❌
try {
	await doSomething();
} catch (error: any) {
	console.error(error.message);
}

// ✅ Type guard approach
try {
	await doSomething();
} catch (error: unknown) {
	if (error instanceof Error) {
		console.error(error.message);
	}

	// Hoặc cho HTTP errors
	if (isHttpError(error)) {
		toast.error(error.message);
	}
}

// Type guard helper
function isHttpError(error: unknown): error is HttpError {
	return (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		"message" in error
	);
}
```

### 3f. Record Types

```typescript
// ❌
const variables: Record<string, any> = {};

// ✅ Option 1: unknown
const variables: Record<string, unknown> = {};

// ✅ Option 2: Cụ thể
interface NotificationVariables {
	cycleName: string;
	daysLeft: number;
	revieweeName: string;
}
const variables: NotificationVariables = {
	cycleName: "Q4 2024",
	daysLeft: 3,
	revieweeName: "John Doe",
};

// ✅ Option 3: Union
const variables: Record<string, string | number | boolean | Date> = {};
```

### 3g. Event Handlers trong React

```typescript
// ❌
const handleSelect = (value: any) => { ... }

// ✅ Shadcn Select
const handleSelect = (value: string) => { ... }

// ✅ Shadcn Combobox
const handleSelect = (value: string) => { ... }

// ✅ React Hook Form
const onSubmit = (values: CreateFeatureFormValues) => { ... }

// ✅ Table sorting
const handleSort = (column: keyof FeatureItem, direction: "asc" | "desc") => { ... }
```

---

## Bước 4: Chạy TypeScript kiểm tra

```bash
# Frontend
cd ehub-reactjs-fe && npx tsc --noEmit

# Backend
cd ehub-nestjs-be && npx tsc --noEmit
```

Sửa tất cả type errors cho đến khi build thành công.

---

## Bước 5: Verify không còn `any`

```bash
# Final check
cd ehub-reactjs-fe && grep -rn "\bany\b" --include="*.ts" --include="*.tsx" src/ | grep -v "node_modules\|\.d\.ts" | wc -l

cd ehub-nestjs-be && grep -rn "\bany\b" --include="*.ts" src/ | grep -v "node_modules\|\.d\.ts" | wc -l
```

Mục tiêu: **0 occurrences** (trừ `.d.ts` files từ thư viện).

---

## Checklist Cuối

- [ ] Không còn `any` trong function params
- [ ] Không còn `any` trong return types
- [ ] Không còn `any[]`
- [ ] Không còn `Promise<any>`
- [ ] Không còn `Record<string, any>` → dùng interface hoặc `unknown`
- [ ] Không còn `as any` → dùng type assertion đúng
- [ ] Không còn `metadata?: any` → dùng generic
- [ ] Error handlers dùng `unknown` + type guard
- [ ] Prisma queries dùng `Prisma.ModelGetPayload<>`
- [ ] React events dùng proper event types
- [ ] `tsc --noEmit` pass không lỗi
