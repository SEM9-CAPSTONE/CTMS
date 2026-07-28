---
name: react-feature-generator
description: >
  Generates a complete React feature module with TypeScript for the ehub-reactjs-fe app.
  Use when the user asks to create a new feature, page, module, or CRUD screen.
  Produces: components, hooks, services, types, constants, i18n, routes, pages
  following the project's established patterns with TanStack Query, Zod, Shadcn UI.
---

# React Feature Generator Skill

## Purpose

Generate a complete, production-ready React feature module that conforms to the ehub-reactjs-fe
codebase conventions. The output must be immediately mergeable without additional refactoring.

## Trigger

Use this skill when:
- User asks to create a new frontend feature, page, or module
- User asks to scaffold a new CRUD screen
- User asks to add a new section to the frontend app

## Execution Steps

### Step 1 — Understand Requirements

1. Identify the feature name (use kebab-case for folders, camelCase for code).
2. Determine the data model (fields, types, relationships).
3. Identify CRUD operations needed (list, detail, create, update, delete).
4. Check if any existing features have similar patterns to reference.

### Step 2 — Generate Types (`types.ts`)

Create strict TypeScript types. Rules:
- ZERO `any` types
- Use union types or enums for status/category fields
- Use `import type` syntax
- Follow existing pattern from features like `notifications/types.ts`

```typescript
// Example template
export interface FeatureItem {
  id: string;
  name: string;
  status: FeatureStatus;
  createdAt: string;
  updatedAt: string;
}

export enum FeatureStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}
```

### Step 3 — Generate Constants (`constants.ts`)

```typescript
import type { FeatureStatus } from "./types";

export const FEATURE_DEFAULT_PAGE = 1;
export const FEATURE_DEFAULT_LIMIT = 20;
export const FEATURE_STALE_TIME = 30_000;
export const FEATURE_POLL_INTERVAL = 60_000;
```

### Step 4 — Register API Endpoints (`core/api/endpoints.ts`)

Add to the existing `API_ENDPOINTS` object:

```typescript
FEATURE_NAME: {
  GET_ALL: `/feature-name`,
  GET_BY_ID: (id: string) => `/feature-name/${id}`,
  CREATE: `/feature-name`,
  UPDATE: (id: string) => `/feature-name/${id}`,
  DELETE: (id: string) => `/feature-name/${id}`,
},
```

### Step 5 — Register Query Keys (`core/api/queryKeys.ts`)

Add to the existing `queryKeys` object:

```typescript
featureName: {
  all: ["feature-name"],
  detail: (id: string) => ["feature-name", id],
  list: (params?: FilterParams) => ["feature-name", "list", params],
},
```

### Step 6 — Generate Service (`services/feature.service.ts`)

Rules:
- Services are plain objects with typed async methods
- Use `httpClient` from `@/core/api/httpClient.api`
- Use `API_ENDPOINTS` from `@/core/api/endpoints`
- Full generic typing on `httpClient` calls
- Use `URLSearchParams` for query parameters

```typescript
import { API_ENDPOINTS } from "@/core/api/endpoints";
import { httpClient } from "@/core/api/httpClient.api";
import type { ApiResponse } from "@/shared/types/api.types";
import type { FeatureItem } from "../types";

export const featureService = {
  getAll: async (
    page: number,
    limit: number,
  ): Promise<ApiResponse<FeatureItem[], PageMetaData>> => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    return httpClient.get<ApiResponse<FeatureItem[], PageMetaData>>(
      `${API_ENDPOINTS.FEATURE_NAME.GET_ALL}?${params}`,
    );
  },

  getById: async (id: string): Promise<ApiResponse<FeatureItem, undefined>> => {
    return httpClient.get<ApiResponse<FeatureItem, undefined>>(
      API_ENDPOINTS.FEATURE_NAME.GET_BY_ID(id),
    );
  },

  create: async (data: CreateFeaturePayload): Promise<ApiResponse<FeatureItem, undefined>> => {
    return httpClient.post<ApiResponse<FeatureItem, undefined>>(
      API_ENDPOINTS.FEATURE_NAME.CREATE,
      data,
    );
  },
};
```

### Step 7 — Generate Hooks (`hooks/`)

Rules:
- Wrap all TanStack Query calls in custom hooks
- Typed generics on `useQuery` and `useMutation`
- Use `queryKeys` from `@/core/api/queryKeys`
- Use constants for `staleTime`, `refetchInterval`
- Implement optimistic updates for mutations where appropriate

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/core/api/queryKeys";
import { FEATURE_DEFAULT_LIMIT, FEATURE_DEFAULT_PAGE, FEATURE_STALE_TIME } from "../constants";
import { featureService } from "../services/feature.service";

export function useFeatureList(
  page = FEATURE_DEFAULT_PAGE,
  limit = FEATURE_DEFAULT_LIMIT,
) {
  return useQuery({
    queryKey: [...queryKeys.featureName.all, page, limit],
    queryFn: () => featureService.getAll(page, limit),
    staleTime: FEATURE_STALE_TIME,
  });
}

export function useCreateFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFeaturePayload) => featureService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.featureName.all });
    },
  });
}
```

### Step 8 — Generate Components (`components/`)

Rules:
- Each component: small, single responsibility, < 150 lines
- Use Shadcn UI components first
- Use `cn()` for class merging
- Use `useTranslation()` for all text
- Props typed with explicit interfaces
- No business logic — delegate to hooks

### Step 9 — Generate Page (`pages/`)

The page component:
- Composes feature components
- Calls feature hooks
- Handles layout and page-level concerns

### Step 10 — Generate i18n Files

Create translation files in both languages:
- `core/i18n/locales/en/<featureName>.json`
- `core/i18n/locales/vi/<featureName>.json`
- Register in `core/i18n/index.ts`

### Step 11 — Generate Routes

Create route definition in `features/<feature-name>/routes/index.tsx`.

## Validation Checklist

Before completing, verify:
- [ ] Zero `any` types anywhere
- [ ] All text uses i18n `t()` function
- [ ] TanStack Query used for all server state
- [ ] Query keys registered centrally
- [ ] Endpoints registered centrally
- [ ] Components are small and single-purpose
- [ ] Services only make API calls
- [ ] Hooks encapsulate all logic
- [ ] Types defined in `types.ts`
- [ ] Constants defined in `constants.ts`
- [ ] Shadcn UI components used where possible
- [ ] `cn()` used for class merging
- [ ] `import type` used for type imports
- [ ] No hardcoded strings/numbers
- [ ] Forms use react-hook-form + Zod
