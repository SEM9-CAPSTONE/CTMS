# Instruction: Code Review — Quy trình kiểm tra code trước khi merge

## Mục tiêu
Hướng dẫn step-by-step review code cho cả Frontend (React) và Backend (NestJS) theo chuẩn ehub.

---

## Phase 1: Type Safety (Ưu tiên cao nhất)

### Tìm kiếm `any`

```bash
# Tìm tất cả any trong FE
cd ehub-reactjs-fe && grep -rn "any" --include="*.ts" --include="*.tsx" src/features/ | grep -v "node_modules"

# Tìm tất cả any trong BE
cd ehub-nestjs-be && grep -rn "any" --include="*.ts" src/features/ | grep -v "node_modules"
```

### Sửa từng loại `any`

| Pattern `any` | Thay bằng | Ví dụ |
|---|---|---|
| `const data: any` | Type cụ thể | `const data: FeatureItem[]` |
| `(param: any)` | Type cụ thể hoặc generic | `(param: CreatePayload)` hoặc `<T>(param: T)` |
| `Record<string, any>` | `Record<string, unknown>` hoặc interface | `interface Metadata { page: number; }` |
| `as any` | Type assertion đúng | `as ApiResponse<T>` |
| `Promise<any>` | `Promise<FeatureItem[]>` | Dùng Prisma types cho BE |
| `.catch((err: any)` | `catch (err: unknown)` | Narrow bằng type guard |
| `metadata?: any` (BaseResponse) | Generic type | `metadata?: M` |

---

## Phase 2: Architecture Review

### Frontend Checklist

```
📂 Feature Structure
├── ✅ types.ts tồn tại, không có `any`
├── ✅ constants.ts có staleTime, pollInterval
├── ✅ services/ chỉ gọi httpClient, không chứa logic
├── ✅ hooks/ wrap TanStack Query, chứa logic
├── ✅ components/ < 150 dòng mỗi file, chỉ có UI
├── ✅ pages/ compose components
└── ✅ routes/ định nghĩa routes
```

**Kiểm tra data flow đúng:**
```
Page → Component → Custom Hook → Service → httpClient → API
         ↓              ↓             ↓
      UI only       Logic only    API calls only
```

**Anti-patterns cần catch:**
```typescript
// ❌ useQuery trực tiếp trong component
function MyComponent() {
	const { data } = useQuery({ queryKey: ["x"], queryFn: fetchX });
}
// ✅ Phải wrap trong custom hook
function MyComponent() {
	const { data } = useFeatureList();
}

// ❌ Logic trong component
function MyComponent() {
	const filteredData = data.filter(item => item.status === "ACTIVE");
}
// ✅ Logic trong hook
function useActiveFeatures() {
	const { data } = useFeatureList();
	const activeItems = data?.filter(item => item.status === FeatureStatus.ACTIVE) ?? [];
	return { activeItems };
}

// ❌ useState cho server data
const [features, setFeatures] = useState<Feature[]>([]);
useEffect(() => { fetchFeatures().then(setFeatures); }, []);
// ✅ TanStack Query
const { data: features } = useFeatureList();
```

### Backend Checklist

```
📂 Feature Structure
├── ✅ controller chỉ delegate → service → BaseResponse.ok()
├── ✅ service chứa ALL business logic
├── ✅ DTOs dùng class-validator decorators
├── ✅ DTOs có @ApiProperty() cho Swagger
├── ✅ Query params gom vào DTO
├── ✅ Auth dùng @UseGuards(AuthGuard)
├── ✅ Current user dùng @CurrentUserContext()
└── ✅ Tests có describe() grouping
```

**Anti-patterns cần catch:**
```typescript
// ❌ Logic trong controller
@Get()
async findAll(@Query("status") status: string) {
	const features = await this.prisma.feature.findMany();
	const filtered = features.filter(f => f.status === status);
	return { data: filtered };
}

// ✅ Delegate to service
@Get()
async findAll(@Query() query: GetFeatureQueryDto, @I18n() i18n: I18nContext) {
	const result = await this.featureService.findAll(query);
	return BaseResponse.ok(result.data, i18n.t("feature.RETRIEVED_SUCCESS"));
}

// ❌ Nhiều @Query() riêng lẻ
async findAll(
	@Query("status") status: string,
	@Query("page") page: number,
	@Query("limit") limit: number,
	@Query("search") search: string,
)

// ✅ Gom vào DTO
async findAll(@Query() query: GetFeatureQueryDto)

// ❌ Manual token parsing
async create(@Req() req: Request) {
	const userId = req.user.sub;
}

// ✅ Decorator
async create(@CurrentUserContext() user: JwtPayload) {
	const userId = user.sub;
}
```

---

## Phase 3: i18n Compliance

### Kiểm tra hardcoded text

```bash
# Tìm hardcoded strings trong JSX
grep -rn "\"[A-Z].*\"" --include="*.tsx" src/features/ | grep -v "import\|const\|type\|interface\|className\|key="

# Tìm hardcoded messages trong controller responses
grep -rn "BaseResponse.ok" --include="*.ts" src/features/ | grep -v "i18n.t"
```

### Checklist i18n

- [ ] Tất cả text UI dùng `t("namespace.key")`
- [ ] Tất cả response message dùng `i18n.t("namespace.KEY")`
- [ ] File `en/*.json` và `vi/*.json` đều có keys matching
- [ ] Namespace đăng ký trong `core/i18n/index.ts` (FE)
- [ ] Toast messages dùng `t()` hoặc `i18n.t()`

---

## Phase 4: Hardcoding Audit

| Cần kiểm tra | Phải dùng | File |
|---|---|---|
| API URLs | `API_ENDPOINTS.X.Y` | `core/api/endpoints.ts` |
| Query keys | `queryKeys.x.y` | `core/api/queryKeys.ts` |
| Status/Role strings | Enum hoặc constant | `types.ts` hoặc `constants.ts` |
| Magic numbers | Named constant | `constants.ts` |
| Error messages | i18n key | `i18n/{en,vi}/*.json` |

---

## Phase 5: Clean Code

### Kiểm tra nhanh

```bash
# Tìm nested ternary
grep -rn "? .* ? " --include="*.tsx" src/features/

# Tìm console.log (chỉ cho phép console.error, warn, info)
grep -rn "console.log" --include="*.ts" --include="*.tsx" src/

# Tìm useEffect chỉ có logging
grep -A5 "useEffect" --include="*.tsx" src/features/ | grep "console"

# Tìm components quá dài (> 150 dòng)
find src/features -name "*.tsx" -exec wc -l {} + | sort -rn | head -20
```

### Output format

```markdown
## Code Review Report — [Feature Name]

### 🔴 Critical (Phải sửa)
1. `any` type tại `file.ts:45` → Thay bằng `FeatureItem[]`

### 🟡 Warning (Nên sửa)
1. Hardcoded text tại `Component.tsx:23` → Dùng `t("key")`
2. Component > 150 dòng tại `BigComponent.tsx` → Chia nhỏ

### 🔵 Info (Khuyến nghị)
1. Có thể dùng `size-4` thay `w-4 h-4` tại `Icon.tsx:12`

### ✅ Passed
- Type safety: OK
- Architecture: Đúng layer separation
- i18n: Đầy đủ
```

---

## Chạy Biome để kiểm tra format

```bash
# Frontend
cd ehub-reactjs-fe && npx biome check src/features/<feature-name>/

# Backend
cd ehub-nestjs-be && npx biome check src/features/<feature-name>/
```

---

## Chạy TypeScript kiểm tra type errors

```bash
# Frontend
cd ehub-reactjs-fe && npx tsc --noEmit

# Backend
cd ehub-nestjs-be && npx tsc --noEmit
```

---

## Chạy Unit Tests (Backend)

```bash
cd ehub-nestjs-be && npx jest src/features/<feature-name>/
```
