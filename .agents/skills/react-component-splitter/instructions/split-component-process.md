# Instruction: Chia nhỏ Component React (SOLID)

## Mục tiêu
Hướng dẫn step-by-step phân tích và chia một component lớn thành các sub-components nhỏ theo nguyên tắc SOLID.

---

## Bước 1: Đánh giá Component

### Dấu hiệu cần chia

Kiểm tra component hiện tại:
- [ ] **> 150 dòng** → Phải chia
- [ ] **Nhiều `useState` không liên quan** → Tách thành hooks riêng
- [ ] **Nhiều điều kiện render** → Tách thành sub-components
- [ ] **Chứa cả UI + business logic** → Logic vào hook, UI vào component
- [ ] **Có API calls trực tiếp** → Tách vào service → hook
- [ ] **Nested ternary trong JSX** → Tách thành component riêng hoặc dùng early return

---

## Bước 2: Phân loại Responsibilities

Đọc component và đánh dấu từng block code vào categories:

| Category | Đặt vào | Ví dụ |
|---|---|---|
| **API calls** | `services/` | `fetchItems()`, `httpClient.get()` |
| **Data fetching state** | `hooks/` (TanStack Query) | `useQuery`, `useMutation` |
| **Business logic** | `hooks/` | filter, sort, transform, validate |
| **Local UI state** | Giữ trong component hoặc hook | `useState(false)` cho modal |
| **Repeated UI blocks** | `components/` riêng | Card, Row, ListItem |
| **Visual sections** | `components/` riêng | Header, Footer, Sidebar |
| **Conditional blocks** | `components/` riêng | EmptyState, LoadingState, ErrorState |

---

## Bước 3: Tách Custom Hooks

### 3a. Tách Data Fetching Hook

```typescript
// ❌ TRƯỚC: Logic nằm trong component
function FeaturePage() {
	const [data, setData] = useState<FeatureItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);

	useEffect(() => {
		featureService.getAll(page, 20)
			.then(res => setData(res.data))
			.finally(() => setLoading(false));
	}, [page]);

	// ... 200 dòng JSX
}

// ✅ SAU: Tách hook
// hooks/useFeatureList.ts
function useFeatureList(page = 1, limit = 20) {
	return useQuery({
		queryKey: [...queryKeys.featureName.all, page, limit],
		queryFn: () => featureService.getAll(page, limit),
		staleTime: FEATURE_STALE_TIME,
	});
}

// pages/FeaturePage.tsx (gọn hơn)
function FeaturePage() {
	const [page, setPage] = useState(1);
	const { data, isLoading } = useFeatureList(page);
	// ... gọn hơn nhiều
}
```

### 3b. Tách Action Hook (mutations)

```typescript
// hooks/useFeatureActions.ts
function useFeatureActions() {
	const queryClient = useQueryClient();

	const createMutation = useMutation({
		mutationFn: featureService.create,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.featureName.all });
			toast.success(i18n.t("featureName.messages.createSuccess"));
		},
	});

	const deleteMutation = useMutation({
		mutationFn: featureService.delete,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.featureName.all });
			toast.success(i18n.t("featureName.messages.deleteSuccess"));
		},
	});

	return {
		createFeature: createMutation.mutate,
		isCreating: createMutation.isPending,
		deleteFeature: deleteMutation.mutate,
		isDeleting: deleteMutation.isPending,
	};
}
```

### 3c. Tách Filter/Search Hook

```typescript
// hooks/useFeatureFilters.ts
function useFeatureFilters() {
	const [status, setStatus] = useState<FeatureStatus | undefined>();
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);

	const resetFilters = () => {
		setStatus(undefined);
		setSearch("");
		setPage(1);
	};

	return { status, setStatus, search, setSearch, page, setPage, resetFilters };
}
```

---

## Bước 4: Tách Sub-Components

### 4a. Xác định Props Interface

Mỗi sub-component PHẢI có typed props interface:

```typescript
// ❌ KHÔNG: Props không rõ ràng
function FeatureCard({ data, onAction }: { data: any; onAction: any }) {}

// ✅ ĐÚNG: Props interface rõ ràng
interface FeatureCardProps {
	item: FeatureItem;
	onEdit: (id: string) => void;
	onDelete: (id: string) => void;
	isSelected?: boolean;
	className?: string;
}

function FeatureCard({ item, onEdit, onDelete, isSelected, className }: FeatureCardProps) {
	const { t } = useTranslation("featureName");
	// ...
}
```

### 4b. Tách theo Visual Sections

```typescript
// ❌ TRƯỚC: Một component khổng lồ
function FeaturePage() {
	return (
		<div>
			{/* Header section - 30 dòng */}
			<div>
				<h1>Title</h1>
				<Button>Create</Button>
				<SearchInput />
			</div>

			{/* Filters section - 40 dòng */}
			<div>
				<Select>...</Select>
				<DatePicker>...</DatePicker>
			</div>

			{/* Table section - 80 dòng */}
			<table>...</table>

			{/* Pagination - 20 dòng */}
			<Pagination />

			{/* Dialog - 50 dòng */}
			<Dialog>...</Dialog>
		</div>
	);
}

// ✅ SAU: Composed từ nhiều components nhỏ
function FeaturePage() {
	const { t } = useTranslation("featureName");
	const filters = useFeatureFilters();
	const { data, isLoading } = useFeatureList(filters.page);
	const { deleteFeature } = useFeatureActions();
	const [showCreateDialog, setShowCreateDialog] = useState(false);

	return (
		<div className="space-y-6">
			<FeatureHeader
				title={t("title")}
				onCreateClick={() => setShowCreateDialog(true)}
			/>
			<FeatureFilters
				status={filters.status}
				onStatusChange={filters.setStatus}
				search={filters.search}
				onSearchChange={filters.setSearch}
			/>
			<FeatureTable
				items={data?.data ?? []}
				isLoading={isLoading}
				onDelete={deleteFeature}
			/>
			<FeaturePagination
				page={filters.page}
				totalPages={data?.metadata?.totalPages ?? 0}
				onPageChange={filters.setPage}
			/>
			<CreateFeatureDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
			/>
		</div>
	);
}
```

### 4c. Tách Repeated Items

```typescript
// ❌ TRƯỚC: Map inline với JSX phức tạp
{items.map(item => (
	<div key={item.id} className="border rounded p-4">
		<div className="flex justify-between">
			<h3>{item.name}</h3>
			<Badge>{item.status}</Badge>
		</div>
		<p>{item.description}</p>
		<div className="flex gap-2 mt-4">
			<Button onClick={() => handleEdit(item.id)}>Edit</Button>
			<Button onClick={() => handleDelete(item.id)}>Delete</Button>
		</div>
	</div>
))}

// ✅ SAU: Tách thành component riêng
{items.map(item => (
	<FeatureCard
		key={item.id}
		item={item}
		onEdit={handleEdit}
		onDelete={handleDelete}
	/>
))}
```

---

## Bước 5: Xử lý Conditional Rendering

```typescript
// ❌ KHÔNG: Nested ternary
{isLoading ? <Spinner /> : error ? <Error /> : data?.length === 0 ? <Empty /> : <Table />}

// ✅ ĐÚNG: Early returns
function FeatureContent({ data, isLoading, error }: FeatureContentProps) {
	if (isLoading) {
		return <FeatureSkeleton />;
	}

	if (error) {
		return <FeatureError message={error.message} />;
	}

	if (!data || data.length === 0) {
		return <FeatureEmptyState />;
	}

	return <FeatureTable items={data} />;
}
```

```typescript
// ❌ KHÔNG: Điều kiện lặp lại
{item.status === "ACTIVE" && <ActiveBadge />}
{item.status === "ACTIVE" && <EditButton />}
{item.status === "ACTIVE" ? "Active" : "Inactive"}

// ✅ ĐÚNG: Extract boolean
const isActive = item.status === FeatureStatus.ACTIVE;
{isActive && <ActiveBadge />}
{isActive && <EditButton />}
{isActive ? t("status.active") : t("status.inactive")}
```

---

## Bước 6: Kết quả mong đợi

Sau khi chia xong, cấu trúc feature trông như:

```
features/<feature-name>/
├── components/
│   ├── FeatureHeader.tsx         # ~30 dòng
│   ├── FeatureFilters.tsx        # ~50 dòng
│   ├── FeatureTable.tsx          # ~80 dòng
│   ├── FeatureCard.tsx           # ~40 dòng
│   ├── FeatureEmptyState.tsx     # ~20 dòng
│   ├── FeatureSkeleton.tsx       # ~25 dòng
│   ├── CreateFeatureDialog.tsx   # ~60 dòng
│   └── FeaturePagination.tsx     # ~30 dòng
├── hooks/
│   ├── useFeatureList.ts         # Query hook
│   ├── useFeatureActions.ts      # Mutation hooks
│   └── useFeatureFilters.ts      # Filter state
├── pages/
│   └── FeaturePage.tsx           # ~40 dòng, compose all
├── services/
│   └── featureName.service.ts    # API calls only
├── types.ts
└── constants.ts
```

---

## Checklist Cuối

- [ ] Mỗi component < 150 dòng
- [ ] Mỗi component có typed props interface
- [ ] Không có `any` types
- [ ] Business logic nằm trong hooks, KHÔNG trong components
- [ ] API calls nằm trong services, KHÔNG trong hooks
- [ ] Tất cả text dùng `t()` cho i18n
- [ ] `cn()` cho class merging
- [ ] Không nested ternary
- [ ] Conditions extracted thành named booleans
- [ ] Shadcn UI components được dùng khi có sẵn
- [ ] Data flow: Page → Component → Hook → Service → API
