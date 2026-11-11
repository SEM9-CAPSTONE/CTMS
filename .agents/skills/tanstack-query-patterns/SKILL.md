---
name: tanstack-query-patterns
description: >
  Generates and reviews TanStack Query (React Query v5) patterns for the ehub frontend.
  Use when the user asks about data fetching, caching, mutations, optimistic updates,
  query invalidation, or when adding server state management to a feature.
  Ensures centralized query keys, proper typing, and no any usage.
---

# TanStack Query Patterns Skill

## Purpose

Generate and validate TanStack Query patterns that follow the ehub-reactjs-fe conventions
with strict TypeScript typing, centralized query key management, and proper
separation of concerns.

## Trigger

Use this skill when:
- User asks to add data fetching to a feature
- User asks about caching, refetching, or stale data strategies
- User asks to implement optimistic updates
- User asks to add a mutation (create, update, delete)
- Reviewing code that uses `useState` + `useEffect` for data fetching

## Core Rules

1. **NEVER** use `any` in query/mutation type parameters
2. **ALWAYS** register query keys in `core/api/queryKeys.ts`
3. **ALWAYS** wrap queries/mutations in feature-specific custom hooks
4. **NEVER** call `useQuery`/`useMutation` directly in components
5. **ALWAYS** use the service layer for API calls
6. **NEVER** manually manage loading/error state when using TanStack Query

## Patterns

### Pattern 1 — Basic Query Hook

```typescript
// hooks/useFeatureList.ts
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/core/api/queryKeys";
import type { ApiResponse, PageMetaData } from "@/shared/types/api.types";
import { FEATURE_STALE_TIME } from "../constants";
import { featureService } from "../services/feature.service";
import type { FeatureItem } from "../types";

export function useFeatureList(page: number, limit: number) {
  return useQuery<ApiResponse<FeatureItem[], PageMetaData>>({
    queryKey: [...queryKeys.featureName.all, page, limit],
    queryFn: () => featureService.getAll(page, limit),
    staleTime: FEATURE_STALE_TIME,
  });
}
```

### Pattern 2 — Detail Query with Enabled

```typescript
export function useFeatureDetail(id: string | undefined) {
  return useQuery<ApiResponse<FeatureItem, undefined>>({
    queryKey: queryKeys.featureName.detail(id ?? ""),
    queryFn: () => featureService.getById(id!),
    enabled: !!id,
  });
}
```

### Pattern 3 — Mutation with Cache Invalidation

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/core/api/queryKeys";
import type { ApiResponse } from "@/shared/types/api.types";
import { featureService } from "../services/feature.service";
import type { CreateFeaturePayload, FeatureItem } from "../types";

export function useCreateFeature() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<FeatureItem, undefined>,
    Error,
    CreateFeaturePayload
  >({
    mutationFn: (data) => featureService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.featureName.all,
      });
    },
  });
}
```

### Pattern 4 — Optimistic Update Mutation

Follow the exact pattern from `useMarkNotificationRead`:

```typescript
export function useUpdateFeatureStatus() {
  const queryClient = useQueryClient();

  type CacheType = ApiResponse<FeatureItem[], PageMetaData>;

  return useMutation<
    ApiResponse<FeatureItem, undefined>,
    Error,
    { id: string; status: FeatureStatus },
    { previousData: CacheType | undefined }
  >({
    mutationFn: ({ id, status }) =>
      featureService.updateStatus(id, status),

    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.featureName.all,
      });

      const previousData = queryClient.getQueryData<CacheType>(
        queryKeys.featureName.all,
      );

      queryClient.setQueriesData<CacheType>(
        { queryKey: queryKeys.featureName.all },
        (old) => {
          if (!old) return old;

          const updatedData = old.data?.map((item) =>
            item.id === id ? { ...item, status } : item,
          );

          return { ...old, data: updatedData };
        },
      );

      return { previousData };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.featureName.all,
          context.previousData,
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.featureName.all,
      });
    },
  });
}
```

### Pattern 5 — Polling / Auto-Refetch

```typescript
export function useFeatureWithPolling() {
  return useQuery({
    queryKey: queryKeys.featureName.all,
    queryFn: () => featureService.getAll(),
    refetchInterval: FEATURE_POLL_INTERVAL,   // constants.ts
    staleTime: FEATURE_STALE_TIME,             // constants.ts
  });
}
```

### Pattern 6 — Dependent Queries

```typescript
export function useFeatureWithDeps(cycleId: string | undefined) {
  const { data: cycle } = useCycleDetail(cycleId);

  return useQuery({
    queryKey: queryKeys.featureName.list({ cycleId: cycleId ?? "" }),
    queryFn: () => featureService.getByCycle(cycleId!),
    enabled: !!cycleId && !!cycle,
  });
}
```

## Query Key Registration

Always add to `core/api/queryKeys.ts`:

```typescript
featureName: {
  all: ["feature-name"],
  detail: (id: string) => ["feature-name", id],
  list: (filters?: FeatureFilters) => ["feature-name", "list", filters],
  byParent: (parentId: string) => ["feature-name", "parent", parentId],
},
```

## Anti-Patterns to Avoid

```typescript
// ❌ NEVER: useEffect + useState for data fetching
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
useEffect(() => {
  fetchData().then(setData).finally(() => setLoading(false));
}, []);

// ❌ NEVER: any in mutation types
useMutation({ mutationFn: (data: any) => api.post(data) });

// ❌ NEVER: Inline query keys
useQuery({ queryKey: ["some-feature", id], ... });

// ❌ NEVER: Direct useQuery in component
function MyComponent() {
  const { data } = useQuery({ queryKey: ["x"], queryFn: fetchX });
  // Should be: const { data } = useFeatureX();
}
```
