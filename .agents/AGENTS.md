# E-Hub Project — Agent Rules

## 1. Project Architecture Overview

This is a monorepo containing two applications:

- **`ehub-reactjs-fe/`** — React 19 + Vite + TypeScript frontend (Tailwind v4, Shadcn UI, TanStack Query v5, Zustand, React Hook Form + Zod, react-i18next, Biome linter)
- **`ehub-nestjs-be/`** — NestJS + Prisma + TypeScript backend (BullMQ, Redis, nestjs-i18n, class-validator, Swagger, Jest)

Both apps follow a **feature-based modular architecture** under `src/features/`.

---

## 2. Global TypeScript Rules

### 2.1 ABSOLUTELY NO `any`

- **NEVER** use `any` anywhere. This is the highest priority rule.
- Use `unknown` when the type is truly unknown, then narrow with type guards.
- Use generics (`<T>`) when the type is parametric.
- Prefer Prisma-generated types (`Prisma.ModelGetPayload`, model types) on the backend.
- Use `Record<string, unknown>` instead of `Record<string, any>`.
- If an external library forces `any`, wrap it with a typed adapter.

### 2.2 Strict Type Definitions

- Every function parameter, return type, and variable MUST have an explicit type or be inferable.
- Create dedicated `types.ts` files per feature for domain types.
- Shared types go in `shared/types/` or `shared/interfaces/`.
- Import types using `import type { ... }` syntax.
- Use enums or union types for finite sets of values (status, role, category).

### 2.3 Enum & Constant Usage

- NEVER compare against hardcoded strings. Use enums or constants.
- Status values, roles, query keys, tab keys, nav keys → enums or `as const` objects.
- No magic numbers or magic strings in business logic.

```typescript
// ❌ NEVER
if (status === "PUBLISHED") { ... }

// ✅ ALWAYS
if (status === FormStatus.PUBLISHED) { ... }
```

---

## 3. Frontend Rules (React + TypeScript)

### 3.1 Feature Module Structure

Every feature MUST follow this folder structure:

```
src/features/<feature-name>/
├── components/          # UI components (small, single responsibility)
│   ├── FeatureList.tsx
│   ├── FeatureCard.tsx
│   └── FeatureDialog.tsx
├── hooks/               # Custom hooks (data fetching + logic)
│   ├── useFeatureList.ts
│   └── useFeatureActions.ts
├── services/            # API service layer (httpClient calls only)
│   └── feature.service.ts
├── pages/               # Page-level components
│   └── FeaturePage.tsx
├── routes/              # Route definitions
│   └── index.tsx
├── types.ts             # Feature-specific types
├── constants.ts         # Feature-specific constants
├── enums/               # Feature-specific enums (if needed)
│   └── feature-status.enum.ts
└── schema/              # Zod schemas for form validation
    └── feature.schema.ts
```

### 3.2 Component Design (SOLID)

- **Single Responsibility**: Each component does ONE thing. If a component exceeds ~150 lines, split it.
- **Open/Closed**: Use composition and props to extend behavior, not modification.
- **Liskov Substitution**: Components receiving the same props interface must be interchangeable.
- **Interface Segregation**: Don't pass unused props. Create specific prop interfaces.
- **Dependency Inversion**: Components depend on hooks/services abstractions, not implementations.

```
Flow: Page → Component → Custom Hook → Service → API
```

- Components contain ONLY UI rendering logic.
- Business logic goes in custom hooks.
- API calls go in services.
- Data transformations go in utils.

### 3.3 TanStack Query Patterns

- Use `useQuery` for all GET requests (server state).
- Use `useMutation` for all POST/PUT/PATCH/DELETE with optimistic updates.
- Query keys MUST be centralized in `core/api/queryKeys.ts` following existing factory pattern:

```typescript
export const queryKeys = {
  featureName: {
    all: ["feature-name"],
    detail: (id: string) => ["feature-name", id],
    list: (filters: FilterType) => ["feature-name", "list", filters],
  },
};
```

- Set `staleTime` and `refetchInterval` as constants in the feature's `constants.ts`.
- Wrap TanStack Query hooks in feature-specific custom hooks (never call `useQuery` directly in components).

### 3.4 API Endpoints & Services

- All endpoints MUST be defined in `core/api/endpoints.ts` following the existing pattern:

```typescript
export const API_ENDPOINTS = {
  FEATURE_NAME: {
    GET_ALL: `/feature-name`,
    GET_BY_ID: (id: string) => `/feature-name/${id}`,
    CREATE: `/feature-name`,
  },
};
```

- Use `URLSearchParams` for query parameters, never concatenate strings.
- Services are plain objects with typed async methods:

```typescript
export const featureService = {
  getAll: async (): Promise<ApiResponse<FeatureItem[], PageMetaData>> => {
    return httpClient.get<ApiResponse<FeatureItem[], PageMetaData>>(
      API_ENDPOINTS.FEATURE_NAME.GET_ALL,
    );
  },
};
```

### 3.5 State Management Hierarchy

1. **Local State** (`useState`) — Modal open/close, input values, collapse states.
2. **Server State** (TanStack Query) — All data from API.
3. **Global State** (Zustand) — Auth, theme, sidebar, permissions. Use ONLY when truly necessary.

- NEVER use Zustand for data used in only one component.
- NEVER manually manage `loading`/`error` when TanStack Query is used.

### 3.6 i18n (react-i18next)

- ALL user-facing text MUST use `t()` from `useTranslation()`.
- Each feature has its own i18n namespace matching its name.
- Translation files: `core/i18n/locales/{en,vi}/<featureName>.json`.
- Register new namespaces in `core/i18n/index.ts` following the existing import pattern.
- Namespace convention: camelCase matching the feature folder name.

```typescript
const { t } = useTranslation("featureName");
// Usage: t("keyName") or t("nested.keyName")
```

### 3.7 Styling & UI

- Use Shadcn UI components first (Button, Dialog, Sheet, Tooltip, Select, etc.).
- NEVER modify Shadcn source in `src/shadcn/`. Create wrapper components instead.
- Always use `cn()` (from `clsx` + `tailwind-merge`) to merge classes.
- Use `size-4`, `size-5` instead of `w-4 h-4` when equal.
- No `<style>` tags in components. Shared CSS goes in `globals.css`.
- No inline styles except truly dynamic values.

### 3.8 Form Handling

- Use `react-hook-form` + `zod` for all forms.
- Schemas go in `schema/` directory within the feature.
- Use `@hookform/resolvers/zod` for validation.
- Form values MUST have correct TypeScript types inferred from Zod schema.

### 3.9 React Best Practices

- No nested ternary operators in JSX. Use early returns or extracted booleans.
- Extract repeated conditions into named boolean variables.
- No `useEffect` for logging only.
- Error handling via TanStack Query's `onError`, toast, or Error Boundaries.
- Wrap text in semantic tags (`<span>`, `<p>`, `<div>`), not plain text next to icons.
- Prefer early returns to reduce nesting.

### 3.10 Formatter & Linter

- Biome with tab indentation, double quotes.
- No unused imports (auto-removed).
- No `console.log` (only `console.error`, `console.warn`, `console.info` allowed).
- Organize imports automatically.

---

## 4. Backend Rules (NestJS + Prisma)

### 4.1 Feature Module Structure

```
src/features/<feature-name>/
├── <feature>.controller.ts    # Routes only — validate, call service, return response
├── <feature>.service.ts       # All business logic
├── <feature>.module.ts        # NestJS module binding
├── dtos/                      # Request/Response DTOs with class-validator
│   ├── create-<feature>.dto.ts
│   ├── update-<feature>.dto.ts
│   └── get-<feature>-query.dto.ts
├── <feature>.types.ts         # Feature-specific TypeScript types
└── <feature>.spec.ts          # Unit tests
```

### 4.2 Controller Design

- Controllers ONLY: receive request → validate DTO → call service → return `BaseResponse`.
- NEVER put business logic, token parsing, cookie parsing, or complex query parsing in controllers.
- Group query params into DTOs (never multiple separate `@Query()` params).
- Use `@CurrentUserContext()` decorator for the current user (never `@Req()` to read `req.user`).
- Use `@UseGuards(AuthGuard)` for authenticated endpoints.
- Use `@ApiOperation()`, `@ApiTags()`, `@ApiBearerAuth()` for Swagger.

### 4.3 DTOs

- Use `class-validator` decorators for validation.
- Use `class-transformer` for type transformation.
- Paginated queries extend `PageOptionInput`.
- Use `@ApiProperty()` / `@ApiPropertyOptional()` for Swagger.
- Reuse `PaginationMetadataDto` and `BaseResponse` for responses.

### 4.4 Service Design

- Services contain ALL business logic.
- Inject `PrismaService` for database operations.
- Use Prisma-generated types — never `any` for database results.
- Use `include` / `select` to shape Prisma queries precisely.
- Transaction-heavy operations use `prisma.$transaction()`.

### 4.5 Auth & Authorization

- Token validation lives in JWT Strategy / `AuthGuard`.
- Current user via `@CurrentUserContext()` decorator.
- Role-based access via `@Roles()` decorator + `RolesGuard`.
- NEVER manually parse or validate tokens in controllers/services.

### 4.6 i18n (nestjs-i18n)

- Inject `@I18n() i18n: I18nContext` in controller methods.
- Translation files: `src/i18n/{en,vi}/<feature-name>.json`.
- All user-facing messages MUST use `i18n.t("namespace.KEY")`.
- Error messages follow project convention with error codes.
- Default/seed data uses i18n keys, not hardcoded text.

### 4.7 Database & Dynamic Data

- NEVER hardcode data that can change (rubrics, default values, etc.).
- Query business data from DB.
- When create/update needs to return related data, use `include`/`select` or re-query.

### 4.8 Shared Code

- Common utils go in `shared/utils/`.
- Shared decorators in `shared/decorators/`.
- Shared guards in `shared/guards/`.
- Shared DTOs in `shared/dtos/`.
- Shared types in `shared/types/` or `shared/interfaces/`.
- NEVER put domain/business logic in `shared/`.

### 4.9 Testing

- Group tests by method using `describe()` blocks.
- Test file: `<feature>.spec.ts` or `<feature>.service.spec.ts`.
- Use `@nestjs/testing` for module setup.
- Mock external dependencies (PrismaService, other services).

### 4.10 Control Flow

- Prefer `switch/case` over long `if/else if` chains when branching on the same variable.
- Extract named booleans for complex conditions.

---

## 5. Cross-Cutting Rules

### 5.1 Code Readability

- Meaningful names for everything (variables, functions, classes, DTOs, modules).
- Extract reusable logic into utils, custom hooks, decorators, or guards.
- Components and functions should be short and do ONE thing.
- Avoid deeply nested callbacks or conditions.
- Use early returns to reduce nesting.

### 5.2 DRY (Don't Repeat Yourself)

- If code appears in 2+ places, extract it:
  - FE: custom hook, util function, shared component
  - BE: decorator, guard, util, base class, shared module

### 5.3 No Hardcoding

- Endpoints → `endpoints.ts`
- Query keys → `queryKeys.ts`
- Roles/statuses → enums
- Config values → constants or environment variables

### 5.4 Import Organization

- Types from official `types.ts` files, never indirectly from hooks/components.
- Use `import type` for type-only imports.
- Let Biome organize imports automatically.

---

## 6. Git & Workflow

- Branch naming validated by `validate-branch-name`.
- Commit messages follow Conventional Commits (enforced by `commitlint`).
- Lint-staged runs Biome on pre-commit.
