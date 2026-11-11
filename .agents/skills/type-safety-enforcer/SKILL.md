---
name: type-safety-enforcer
description: >
  Audits and fixes TypeScript type safety issues across the ehub monorepo.
  Use when the user asks to remove any types, fix type errors, improve type safety,
  or when migrating code from any to proper types.
  Covers: eliminating any, adding generics, Prisma types, strict interfaces,
  type guards, and discriminated unions.
---

# Type Safety Enforcer Skill

## Purpose

Systematically find and eliminate all `any` types across the codebase, replacing them
with proper, strict TypeScript types. This is the **#1 priority rule** of the ehub project.

## Trigger

Use this skill when:
- User asks to fix `any` types
- User asks to improve type safety
- User asks to audit TypeScript strictness
- Running pre-PR quality checks
- Creating new code (always apply these patterns)

## Detection Patterns

### 1. Explicit `any`

```typescript
// ❌ All of these are violations
const data: any = fetchData();
function process(input: any): any { ... }
const items: any[] = [];
const config: Record<string, any> = {};
```

### 2. Implicit `any` (through omission)

```typescript
// ❌ Parameter has implicit any
function handleClick(event) { ... }
// ✅ Fix
function handleClick(event: React.MouseEvent<HTMLButtonElement>) { ... }

// ❌ Callback without types
array.map((item) => item.name);  // item is any if array is untyped
// ✅ Fix
array.map((item: FeatureItem) => item.name);
```

### 3. Type Assertions to `any`

```typescript
// ❌
const result = response as any;
// ✅
const result = response as ApiResponse<FeatureItem[], PageMetaData>;
```

## Replacement Strategies

### Strategy 1 — Use Existing Types

Check if the type already exists:
- `shared/types/api.types.ts` → `ApiResponse<T, M>`, `HttpError`, `PageMetaData`
- `features/<feature>/types.ts` → Feature-specific types
- `@prisma/client` → Prisma model types
- `shared/interfaces/` → JWT, config interfaces

### Strategy 2 — Create New Types

If no existing type fits:

```typescript
// In types.ts of the feature
export interface FeatureItem {
  id: string;
  name: string;
  status: FeatureStatus;
  createdAt: string;
}

export type FeatureStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

// Or as enum for shared use
export enum FeatureStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}
```

### Strategy 3 — Use Generics

```typescript
// ❌
function wrapResponse(data: any, message: any): any {
  return { data, message };
}

// ✅
function wrapResponse<T>(data: T, message: string): { data: T; message: string } {
  return { data, message };
}
```

### Strategy 4 — Use `unknown` + Type Guards

When the type is truly unknown at compile time:

```typescript
// ❌
function processInput(data: any) {
  return data.name;
}

// ✅
function processInput(data: unknown): string {
  if (isFeatureItem(data)) {
    return data.name;
  }
  throw new Error("Invalid input");
}

function isFeatureItem(value: unknown): value is FeatureItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as FeatureItem).name === "string"
  );
}
```

### Strategy 5 — Use Prisma Types (Backend)

```typescript
// ❌
async findAll(): Promise<any[]> {
  return this.prisma.feature.findMany();
}

// ✅
import { Prisma } from "@prisma/client";

type FeatureWithRelations = Prisma.FeatureGetPayload<{
  include: { category: true; tags: true };
}>;

async findAll(): Promise<FeatureWithRelations[]> {
  return this.prisma.feature.findMany({
    include: { category: true, tags: true },
  });
}
```

### Strategy 6 — Use Discriminated Unions

```typescript
// ❌
interface ApiResult {
  success: boolean;
  data: any;
  error: any;
}

// ✅
type ApiResult<T> =
  | { success: true; data: T; error: undefined }
  | { success: false; data: undefined; error: HttpError };
```

### Strategy 7 — Use `Record<string, unknown>`

```typescript
// ❌
const metadata: Record<string, any> = {};

// ✅
const metadata: Record<string, unknown> = {};

// Or better, define the exact shape
interface Metadata {
  page: number;
  limit: number;
  totalItems: number;
}
```

## Known `any` Hotspots in ehub

These patterns commonly produce `any` and must be addressed:

1. **`BaseResponse.metadata`** — Currently typed as `any`, should use generic
2. **`NotificationPayload.variables`** — `Record<string, any>`, needs proper typing
3. **Error catch blocks** — `catch (error)` gives `unknown`, use type guard
4. **Event handlers** — Use React event types
5. **JSON parsing** — `JSON.parse()` returns `any`, narrow immediately

## Audit Report Format

```
## Type Safety Audit Report

### 🔴 Critical: `any` Found (X occurrences)

| File | Line | Current Type | Suggested Fix |
|------|------|-------------|---------------|
| feature.service.ts | 45 | `data: any` | `data: FeatureItem[]` |
| feature.controller.ts | 23 | `metadata: any` | `metadata: PaginationMetadataDto` |

### 🟡 Warning: Implicit any (Y occurrences)

| File | Line | Context | Suggested Fix |
|------|------|---------|---------------|
| utils.ts | 12 | `(item) =>` | `(item: FeatureItem) =>` |

### ✅ Type Safety Score: Z%
```
