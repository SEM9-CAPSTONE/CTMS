---
name: code-review-agent
description: >
  Reviews React (frontend) and NestJS (backend) code for compliance with ehub project
  standards. Checks for: any types, i18n violations, hardcoded strings, SOLID violations,
  component size, TanStack Query patterns, DTO validation, auth patterns, and more.
  Use when the user asks to review code, check quality, or validate a feature.
---

# Code Review Agent Skill

## Purpose

Perform a comprehensive code review on frontend (React) and/or backend (NestJS) code
against the ehub project's established standards and conventions.

## Trigger

Use this skill when:
- User asks to review code or a PR
- User asks to check code quality
- User asks "is this code OK?" or "what's wrong with this?"
- User submits a new feature for validation

## Review Process

### Phase 1 — Type Safety Audit

**Priority: CRITICAL** — This is the #1 rule.

Scan for:
- [ ] `any` keyword anywhere → **MUST** replace with proper type
- [ ] `as any` type assertions → Replace with proper narrowing
- [ ] Untyped function parameters → Add explicit types
- [ ] Untyped function return values → Add explicit return types where not inferable
- [ ] Missing `import type` for type-only imports

Report format:
```
🔴 TYPE SAFETY: Found `any` at <file>:<line>
   Current: const data: any = ...
   Fix: const data: FeatureItem[] = ...
```

### Phase 2 — Architecture Review

#### Frontend
- [ ] Component follows single responsibility (< 150 lines)
- [ ] Business logic in hooks, not components
- [ ] API calls in services, not hooks
- [ ] TanStack Query for ALL server state
- [ ] Query keys registered in `core/api/queryKeys.ts`
- [ ] Endpoints registered in `core/api/endpoints.ts`
- [ ] State management hierarchy respected (local → server → global)
- [ ] No `useState` for server data
- [ ] No manual loading/error when using TanStack Query

#### Backend
- [ ] Controller only delegates to service
- [ ] Service contains all business logic
- [ ] DTOs use class-validator decorators
- [ ] Query params grouped in DTOs
- [ ] Auth via guards, not manual token parsing
- [ ] Current user via `@CurrentUserContext()`, not `@Req()`

### Phase 3 — i18n Compliance

- [ ] All user-facing text uses `t()` (frontend) or `i18n.t()` (backend)
- [ ] Translation keys exist in both `en` and `vi` files
- [ ] Error messages use i18n, not hardcoded strings
- [ ] New namespace registered in i18n config if applicable

Report format:
```
🟡 i18n: Hardcoded text at <file>:<line>
   Current: "Feature created successfully"
   Fix: i18n.t("feature.CREATED_SUCCESS")
```

### Phase 4 — Hardcoding Audit

- [ ] No hardcoded API endpoints → use `API_ENDPOINTS`
- [ ] No hardcoded query keys → use `queryKeys`
- [ ] No hardcoded status/role strings → use enums
- [ ] No magic numbers → extract to constants
- [ ] No hardcoded error messages → use i18n keys
- [ ] No hardcoded business data → query from database

### Phase 5 — React Best Practices (Frontend Only)

- [ ] No nested ternary operators
- [ ] Conditions extracted to named boolean variables
- [ ] No `useEffect` for logging only
- [ ] `cn()` used for class merging (not template literals)
- [ ] Shadcn UI components used where available
- [ ] No `<style>` tags in components
- [ ] Text wrapped in semantic tags
- [ ] No direct modification of Shadcn source
- [ ] `size-*` used instead of `w-* h-*` when equal
- [ ] Forms use react-hook-form + Zod

### Phase 6 — NestJS Best Practices (Backend Only)

- [ ] Swagger decorators present (`@ApiTags`, `@ApiOperation`, `@ApiProperty`)
- [ ] Responses use `BaseResponse.ok()`
- [ ] Paginated responses use `PaginationMetadataDto`
- [ ] Prisma types used (not `any`) for DB results
- [ ] `switch/case` preferred over long `if/else if`
- [ ] Named booleans for complex conditions
- [ ] No repeated boilerplate across modules

### Phase 7 — Testing Review (Backend)

- [ ] Tests grouped by method with `describe()` blocks
- [ ] Dependencies properly mocked
- [ ] Happy path and error cases covered
- [ ] Test file follows naming convention

### Phase 8 — Clean Code

- [ ] Meaningful variable/function/class names
- [ ] Functions are short and do ONE thing
- [ ] No deeply nested callbacks
- [ ] Early returns used to reduce nesting
- [ ] No code duplication
- [ ] Import organization (Biome standard)

## Report Format

Generate a structured report with severity levels:

```
## Code Review Report — <Feature Name>

### 🔴 Critical (Must Fix)
1. [TYPE_SAFETY] any type found at ...
2. [SECURITY] Auth guard missing at ...

### 🟡 Warning (Should Fix)
1. [i18n] Hardcoded text at ...
2. [SOLID] Component exceeds 150 lines at ...

### 🔵 Info (Nice to Have)
1. [STYLE] Consider extracting condition to named boolean at ...
2. [PERF] Consider adding staleTime to query at ...

### ✅ Passed Checks
- Type safety: 95% compliant
- i18n: All text translated
- Architecture: Proper layer separation
```
