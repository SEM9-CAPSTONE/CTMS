# Instruction: TanStack Query — Thêm Data Fetching cho Feature

## Mục tiêu
Hướng dẫn step-by-step thêm TanStack Query vào feature theo pattern chuẩn ehub.

---

## Bước 1: Đăng ký Query Keys

Mở [queryKeys.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-reactjs-fe/src/core/api/queryKeys.ts) và thêm:

```typescript
featureName: {
	all: ["feature-name"],
	detail: (id: string) => ["feature-name", id],
	list: (filters?: FeatureFilters) => ["feature-name", "list", filters],
	byParent: (parentId: string) => ["feature-name", "parent", parentId],
},
```

**Quy tắc:**
- `all` là base key, dùng cho `invalidateQueries` rộng
- Key factories trả về array, có thể chứa objects
- Key phải deterministic (cùng input → cùng output)

---

## Bước 2: Tạo Service

```typescript
// services/featureName.service.ts
import { API_ENDPOINTS } from "@/core/api/endpoints";
import { httpClient } from "@/core/api/httpClient.api";
import type { ApiResponse, PageMetaData } from "@/shared/types/api.types";
import type { FeatureItem, CreateFeaturePayload } from "../types";

export const featureNameService = {
	getAll: async (page: number, limit: number) => {
		const params = new URLSearchParams({
			page: String(page),
			limit: String(limit),
		});
		return httpClient.get<ApiResponse<FeatureItem[], PageMetaData>>(
			`${API_ENDPOINTS.FEATURE_NAME.GET_ALL}?${params}`,
		);
	},
	getById: async (id: string) =>
		httpClient.get<ApiResponse<FeatureItem, undefined>>(
			API_ENDPOINTS.FEATURE_NAME.GET_BY_ID(id),
		),
	create: async (payload: CreateFeaturePayload) =>
		httpClient.post<ApiResponse<FeatureItem, undefined>>(
			API_ENDPOINTS.FEATURE_NAME.CREATE,
			payload,
		),
	update: async (id: string, payload: Partial<CreateFeaturePayload>) =>
		httpClient.put<ApiResponse<FeatureItem, undefined>>(
			API_ENDPOINTS.FEATURE_NAME.UPDATE(id),
			payload,
		),
	delete: async (id: string) =>
		httpClient.delete<ApiResponse<null, undefined>>(
			API_ENDPOINTS.FEATURE_NAME.DELETE(id),
		),
};
```

---

## Bước 3: Tạo Query Hooks

### 3a. List Hook (có pagination)

```typescript
// hooks/useFeatureList.ts
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/core/api/queryKeys";
import {
	FEATURE_DEFAULT_LIMIT,
	FEATURE_DEFAULT_PAGE,
	FEATURE_STALE_TIME,
} from "../constants";
import { featureNameService } from "../services/featureName.service";

export function useFeatureList(
	page = FEATURE_DEFAULT_PAGE,
	limit = FEATURE_DEFAULT_LIMIT,
) {
	return useQuery({
		queryKey: [...queryKeys.featureName.all, page, limit],
		queryFn: () => featureNameService.getAll(page, limit),
		staleTime: FEATURE_STALE_TIME,
	});
}
```

### 3b. Detail Hook (có enabled)

```typescript
// hooks/useFeatureDetail.ts
export function useFeatureDetail(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.featureName.detail(id ?? ""),
		queryFn: () => featureNameService.getById(id!),
		enabled: !!id, // Chỉ fetch khi có id
	});
}
```

### 3c. List Hook với Polling

```typescript
// hooks/useFeatureWithPolling.ts
export function useFeatureWithPolling() {
	return useQuery({
		queryKey: queryKeys.featureName.all,
		queryFn: () => featureNameService.getAll(1, 20),
		refetchInterval: FEATURE_POLL_INTERVAL,
		staleTime: FEATURE_STALE_TIME,
	});
}
```

---

## Bước 4: Tạo Mutation Hooks

### 4a. Create Mutation (đơn giản)

```typescript
// hooks/useCreateFeature.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/core/api/queryKeys";
import { toast } from "sonner";
import i18n from "@/core/i18n";
import { featureNameService } from "../services/featureName.service";
import type { CreateFeaturePayload } from "../types";

export function useCreateFeature() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (payload: CreateFeaturePayload) =>
			featureNameService.create(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.featureName.all,
			});
			toast.success(i18n.t("featureName.messages.createSuccess"));
		},
		onError: () => {
			toast.error(i18n.t("featureName.messages.saveError"));
		},
	});
}
```

### 4b. Delete Mutation với Optimistic Update

Tham khảo [useNotifications.ts useMarkNotificationRead](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-reactjs-fe/src/features/notifications/hooks/useNotifications.ts):

```typescript
// hooks/useDeleteFeature.ts
import type { ApiResponse, PageMetaData } from "@/shared/types/api.types";
import type { FeatureItem } from "../types";

type FeatureCache = ApiResponse<FeatureItem[], PageMetaData>;

export function useDeleteFeature() {
	const queryClient = useQueryClient();

	return useMutation<
		ApiResponse<null, undefined>,        // TData (success response)
		Error,                                // TError
		string,                              // TVariables (id)
		{ previous: FeatureCache | undefined } // TContext
	>({
		mutationFn: (id: string) => featureNameService.delete(id),

		onMutate: async (id) => {
			// 1. Cancel outgoing refetches
			await queryClient.cancelQueries({
				queryKey: queryKeys.featureName.all,
			});

			// 2. Snapshot previous value
			const previous = queryClient.getQueryData<FeatureCache>(
				queryKeys.featureName.all,
			);

			// 3. Optimistically update
			queryClient.setQueriesData<FeatureCache>(
				{ queryKey: queryKeys.featureName.all },
				(old) => {
					if (!old) return old;
					return {
						...old,
						data: old.data?.filter((item) => item.id !== id),
					};
				},
			);

			// 4. Return context
			return { previous };
		},

		onError: (_err, _id, context) => {
			// Rollback on error
			if (context?.previous) {
				queryClient.setQueryData(
					queryKeys.featureName.all,
					context.previous,
				);
			}
			toast.error(i18n.t("featureName.messages.deleteError"));
		},

		onSettled: () => {
			// Always refetch after settle
			queryClient.invalidateQueries({
				queryKey: queryKeys.featureName.all,
			});
		},
	});
}
```

---

## Bước 5: Sử dụng trong Component

```typescript
// pages/FeaturePage.tsx
function FeaturePage() {
	const { t } = useTranslation("featureName");
	const [page, setPage] = useState(1);

	// Queries
	const { data, isLoading, isError } = useFeatureList(page);

	// Mutations
	const { mutate: deleteFeature, isPending: isDeleting } = useDeleteFeature();
	const { mutate: createFeature, isPending: isCreating } = useCreateFeature();

	// Derived state — KHÔNG dùng useState cho computed values
	const items = data?.data ?? [];
	const totalPages = data?.metadata?.totalPages ?? 0;
	const isEmpty = !isLoading && items.length === 0;

	if (isLoading) return <FeatureSkeleton />;
	if (isError) return <FeatureError />;
	if (isEmpty) return <FeatureEmptyState />;

	return (
		<FeatureTable
			items={items}
			onDelete={deleteFeature}
			isDeleting={isDeleting}
		/>
	);
}
```

---

## Anti-Patterns

```typescript
// ❌ useState + useEffect cho server data
const [data, setData] = useState([]);
useEffect(() => { fetchData().then(setData); }, []);

// ❌ Manual loading state khi đã dùng TanStack Query
const [loading, setLoading] = useState(false);

// ❌ Inline query key
useQuery({ queryKey: ["features", id], queryFn: ... });

// ❌ useQuery trực tiếp trong component (không wrap hook)
const { data } = useQuery({ queryKey: queryKeys.x.all, queryFn: fetchX });

// ❌ any trong mutation generics
useMutation({ mutationFn: (data: any) => api.post(data) });

// ❌ useState cho derived/computed values
const [filteredItems, setFilteredItems] = useState([]);
useEffect(() => {
	setFilteredItems(items.filter(...));
}, [items]);
// ✅ Dùng useMemo hoặc tính trực tiếp
const filteredItems = items.filter(...);
```

---

## Checklist Cuối

- [ ] Query keys đăng ký trong `core/api/queryKeys.ts`
- [ ] Service methods có đầy đủ generic types
- [ ] Queries wrapped trong custom hooks
- [ ] Mutations wrapped trong custom hooks
- [ ] `staleTime` và `refetchInterval` là constants
- [ ] Optimistic updates cho UX tốt hơn
- [ ] Error handling: `onError` callback hoặc Error Boundary
- [ ] Không `useState` cho server data
- [ ] Không manual loading/error state
- [ ] Không `any` trong generics
- [ ] `enabled` cho conditional queries
