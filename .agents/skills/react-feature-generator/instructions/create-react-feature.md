# Instruction: Tạo Feature Frontend React Mới

## Mục tiêu
Hướng dẫn step-by-step tạo một React feature module hoàn chỉnh trong `ehub-reactjs-fe`.

---

## Bước 1: Tạo cấu trúc thư mục

```bash
mkdir -p src/features/<feature-name>/{components,hooks,services,pages,routes,schema}
```

Tạo các file cốt lõi:
```
src/features/<feature-name>/
├── types.ts
├── constants.ts
├── components/
├── hooks/
├── services/
├── pages/
├── routes/
└── schema/        # (nếu có form)
```

---

## Bước 2: Định nghĩa Types (`types.ts`)

> ⚠️ **TUYỆT ĐỐI KHÔNG dùng `any`**

Tham khảo mẫu thực tế từ [form-management/types.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-reactjs-fe/src/features/form-management/types.ts):

```typescript
// Dùng union type hoặc enum cho status, role, category
export type FeatureStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

// Interface cho từng entity
export interface FeatureItem {
	id: string;
	name: string;
	status: FeatureStatus;
	description: string | null;
	createdAt: string;
	updatedAt: string;
}

// Interface cho response metadata
export interface FeatureListMetadata {
	page: number;
	limit: number;
	totalItems: number;
	totalPages: number;
}

// Import type từ shared nếu cần
import type { RoleScopeValue } from "@/shared/constants/RoleScope.constants";
```

**Checklist:**
- [ ] Mỗi field có type rõ ràng
- [ ] Dùng `import type { ... }` cho type-only imports
- [ ] Dùng union type hoặc enum thay vì `string` cho status/role
- [ ] Tách interface cho request payload và response

---

## Bước 3: Định nghĩa Constants (`constants.ts`)

Tham khảo [notifications/constants.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-reactjs-fe/src/features/notifications/constants.ts):

```typescript
import type { FeatureStatus } from "./types";

// Pagination defaults
export const FEATURE_DEFAULT_PAGE = 1;
export const FEATURE_DEFAULT_LIMIT = 20;

// TanStack Query config
export const FEATURE_STALE_TIME = 30_000;      // 30 giây
export const FEATURE_POLL_INTERVAL = 60_000;   // 1 phút (nếu cần polling)

// Thứ tự hiển thị status
export const FEATURE_STATUS_ORDER: FeatureStatus[] = [
	"DRAFT",
	"ACTIVE",
	"ARCHIVED",
];
```

---

## Bước 4: Đăng ký API Endpoints

Mở [endpoints.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-reactjs-fe/src/core/api/endpoints.ts) và thêm:

```typescript
FEATURE_NAME: {
	GET_ALL: `/feature-name`,
	GET_BY_ID: (id: string) => `/feature-name/${id}`,
	CREATE: `/feature-name`,
	UPDATE: (id: string) => `/feature-name/${id}`,
	DELETE: (id: string) => `/feature-name/${id}`,
},
```

**Quy tắc:**
- Dùng `URLSearchParams` cho query params, KHÔNG nối chuỗi
- Tên key: UPPER_SNAKE_CASE
- Tham số động dùng arrow function

---

## Bước 5: Đăng ký Query Keys

Mở [queryKeys.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-reactjs-fe/src/core/api/queryKeys.ts) và thêm:

```typescript
featureName: {
	all: ["feature-name"],
	detail: (id: string) => ["feature-name", id],
	list: (filters?: FeatureFilters) => ["feature-name", "list", filters],
},
```

---

## Bước 6: Tạo Service (`services/featureName.service.ts`)

Tham khảo [formManagement.service.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-reactjs-fe/src/features/form-management/services/formManagement.service.ts):

```typescript
import { API_ENDPOINTS } from "@/core/api/endpoints";
import { httpClient } from "@/core/api/httpClient.api";
import type { ApiResponse } from "@/shared/types/api.types";
import type { FeatureItem, FeatureListMetadata } from "../types";

export const featureNameService = {
	getAll: async (
		page: number,
		limit: number,
	): Promise<ApiResponse<FeatureItem[], FeatureListMetadata>> => {
		const params = new URLSearchParams({
			page: String(page),
			limit: String(limit),
		});
		return httpClient.get<ApiResponse<FeatureItem[], FeatureListMetadata>>(
			`${API_ENDPOINTS.FEATURE_NAME.GET_ALL}?${params}`,
		);
	},

	getById: async (
		id: string,
	): Promise<ApiResponse<FeatureItem, undefined>> => {
		return httpClient.get<ApiResponse<FeatureItem, undefined>>(
			API_ENDPOINTS.FEATURE_NAME.GET_BY_ID(id),
		);
	},

	create: async (
		payload: CreateFeaturePayload,
	): Promise<ApiResponse<FeatureItem, undefined>> => {
		return httpClient.post<ApiResponse<FeatureItem, undefined>>(
			API_ENDPOINTS.FEATURE_NAME.CREATE,
			payload,
		);
	},

	update: async (
		id: string,
		payload: UpdateFeaturePayload,
	): Promise<ApiResponse<FeatureItem, undefined>> => {
		return httpClient.put<ApiResponse<FeatureItem, undefined>>(
			API_ENDPOINTS.FEATURE_NAME.UPDATE(id),
			payload,
		);
	},

	delete: async (id: string): Promise<ApiResponse<null, undefined>> => {
		return httpClient.delete<ApiResponse<null, undefined>>(
			API_ENDPOINTS.FEATURE_NAME.DELETE(id),
		);
	},
};
```

**Quy tắc:**
- Service là plain object, KHÔNG phải class
- Mỗi method đều có return type rõ ràng với `Promise<ApiResponse<T, M>>`
- Dùng generic trên `httpClient.get<>()`, `httpClient.post<>()`
- Dùng `URLSearchParams` cho query params

---

## Bước 7: Tạo Hooks (`hooks/`)

### 7a. Query Hook

Tham khảo [useFormList.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-reactjs-fe/src/features/form-management/hooks/useFormList.ts):

```typescript
// hooks/useFeatureList.ts
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/core/api/queryKeys";
import { FEATURE_DEFAULT_LIMIT, FEATURE_DEFAULT_PAGE, FEATURE_STALE_TIME } from "../constants";
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

### 7b. Mutation Hook

Tham khảo [useCreateForm.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-reactjs-fe/src/features/form-management/hooks/useCreateForm.ts):

```typescript
// hooks/useCreateFeature.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/core/api/queryKeys";
import { featureNameService } from "../services/featureName.service";
import type { CreateFeaturePayload } from "../types";

export function useCreateFeature() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (payload: CreateFeaturePayload) =>
			featureNameService.create(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.featureName.all });
		},
	});
}
```

### 7c. Optimistic Update Hook

Tham khảo [useNotifications.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-reactjs-fe/src/features/notifications/hooks/useNotifications.ts) (useMarkNotificationRead):

```typescript
// hooks/useDeleteFeature.ts
export function useDeleteFeature() {
	const queryClient = useQueryClient();

	type CacheType = ApiResponse<FeatureItem[], FeatureListMetadata>;

	return useMutation<
		ApiResponse<null, undefined>,
		Error,
		string,
		{ previousData: CacheType | undefined }
	>({
		mutationFn: (id: string) => featureNameService.delete(id),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.featureName.all });
			const previousData = queryClient.getQueryData<CacheType>(
				queryKeys.featureName.all,
			);
			queryClient.setQueriesData<CacheType>(
				{ queryKey: queryKeys.featureName.all },
				(old) => {
					if (!old) return old;
					return {
						...old,
						data: old.data?.filter((item) => item.id !== id),
					};
				},
			);
			return { previousData };
		},
		onError: (_err, _id, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(queryKeys.featureName.all, context.previousData);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.featureName.all });
		},
	});
}
```

---

## Bước 8: Tạo Components (`components/`)

**Nguyên tắc SOLID:**
- Mỗi component < 150 dòng
- Chỉ chứa UI rendering, KHÔNG business logic
- Dùng Shadcn UI components (Button, Dialog, Sheet, Table, ...)
- Dùng `cn()` merge Tailwind classes
- Dùng `useTranslation()` cho tất cả text

```typescript
// components/FeatureCard.tsx
import { useTranslation } from "react-i18next";
import { cn } from "@/shadcn/lib/utils";
import { Button } from "@/shadcn/components/ui/button";
import type { FeatureItem } from "../types";

interface FeatureCardProps {
	item: FeatureItem;
	onEdit: (id: string) => void;
	onDelete: (id: string) => void;
	className?: string;
}

export function FeatureCard({ item, onEdit, onDelete, className }: FeatureCardProps) {
	const { t } = useTranslation("featureName");

	return (
		<div className={cn("rounded-lg border p-4", className)}>
			<h3 className="text-lg font-semibold">{item.name}</h3>
			<p className="text-sm text-muted-foreground">{item.description}</p>
			<div className="mt-4 flex gap-2">
				<Button variant="outline" onClick={() => onEdit(item.id)}>
					{t("actions.edit")}
				</Button>
				<Button variant="destructive" onClick={() => onDelete(item.id)}>
					{t("actions.delete")}
				</Button>
			</div>
		</div>
	);
}
```

---

## Bước 9: Tạo Page (`pages/FeatureNamePage.tsx`)

```typescript
import { useTranslation } from "react-i18next";
import { useFeatureList } from "../hooks/useFeatureList";
import { useDeleteFeature } from "../hooks/useDeleteFeature";
import { FeatureCard } from "../components/FeatureCard";

export function FeatureNamePage() {
	const { t } = useTranslation("featureName");
	const { data, isLoading } = useFeatureList();
	const { mutate: deleteFeature } = useDeleteFeature();

	if (isLoading) {
		return <div>{t("common:loading")}</div>;
	}

	const items = data?.data ?? [];

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">{t("title")}</h1>
			<div className="grid gap-4">
				{items.map((item) => (
					<FeatureCard
						key={item.id}
						item={item}
						onEdit={(id) => { /* navigate to edit */ }}
						onDelete={deleteFeature}
					/>
				))}
			</div>
		</div>
	);
}
```

---

## Bước 10: Tạo i18n Translations

**Tạo 2 file:**

`core/i18n/locales/en/featureName.json`:
```json
{
	"title": "Feature Name",
	"actions": { "create": "Create", "edit": "Edit", "delete": "Delete" },
	"fields": { "name": "Name", "status": "Status" },
	"messages": { "createSuccess": "Created successfully", "deleteConfirm": "Delete this item?" }
}
```

`core/i18n/locales/vi/featureName.json`:
```json
{
	"title": "Tên Tính Năng",
	"actions": { "create": "Tạo mới", "edit": "Chỉnh sửa", "delete": "Xóa" },
	"fields": { "name": "Tên", "status": "Trạng thái" },
	"messages": { "createSuccess": "Tạo thành công", "deleteConfirm": "Xóa mục này?" }
}
```

**Đăng ký namespace** trong [core/i18n/index.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-reactjs-fe/src/core/i18n/index.ts):

```typescript
import featureNameEn from "./locales/en/featureName.json";
import featureNameVi from "./locales/vi/featureName.json";

// Thêm vào resources
en: { ..., featureName: featureNameEn },
vi: { ..., featureName: featureNameVi },
```

---

## Bước 11: Tạo Routes

```typescript
// routes/index.tsx
import { FeatureNamePage } from "../pages/FeatureNamePage";

export const featureNameRoutes = [
	{
		path: "feature-name",
		element: <FeatureNamePage />,
	},
];
```

---

## Bước 12: Tạo Schema Zod (nếu có form)

```typescript
// schema/featureName.schema.ts
import { z } from "zod";

export const createFeatureSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	description: z.string().optional(),
	status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
});

export type CreateFeatureFormValues = z.infer<typeof createFeatureSchema>;
```

---

## Checklist Cuối

- [ ] Không có `any` nào trong toàn bộ feature
- [ ] Tất cả text dùng `t()` từ `useTranslation()`
- [ ] Endpoints đăng ký trong `core/api/endpoints.ts`
- [ ] Query keys đăng ký trong `core/api/queryKeys.ts`
- [ ] i18n namespace đăng ký trong `core/i18n/index.ts`
- [ ] Mỗi component < 150 dòng
- [ ] Services chỉ gọi API, không chứa logic
- [ ] Hooks encapsulate toàn bộ logic
- [ ] Dùng Shadcn UI components
- [ ] Dùng `cn()` cho class merging
- [ ] `import type` cho type-only imports
- [ ] Forms dùng `react-hook-form` + `zod`
- [ ] Biome format: tab indentation, double quotes
