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

- **MANDATORY IMPECCABLE STANDARDS ON ALL NEW UI / SCREENS (Bắt buộc 100% khi sinh Màn hình & UI mới)**:
  - Khi sinh bất kỳ màn hình, trang (`Page`), dialog, modal, drawer, filter bar, bảng dữ liệu (`DataTable`), hoặc component UI mới nào, BẮT BUỘC PHẢI áp dụng 100% chuẩn Impeccable ngay từ đầu (Default by Design, tuyệt đối không code cẩu thả/AI slop rồi chờ người dùng nhắc refactor sau).
  - Không lồng Card trong Card. Không chèn icon trang trí cạnh nhãn số liệu. Phân cấp 3 tầng typography chuẩn (Label nhỏ + Số lớn + Chú thích ngắn). Khoảng cách nhịp 4px (`gap-3`, `gap-4`, `p-4`, `p-6`). Không gradient lòe loẹt. Dùng semantic tokens và bảng màu camping `#164027`. 100% tiếng Việt tự nhiên.
- Use Shadcn UI components first (Button, Dialog, Sheet, Tooltip, Select, etc.).
- NEVER modify Shadcn source in `src/shadcn/`. Create wrapper components instead.
- Always use `cn()` (from `clsx` + `tailwind-merge`) to merge classes.
- Use `size-4`, `size-5` instead of `w-4 h-4` when equal.
- No `<style>` tags in components. Shared CSS goes in `globals.css`.
- No inline styles except truly dynamic values.
- **Mandatory Shared Component Reuse**: BẮT BUỘC kiểm tra và tái sử dụng toàn bộ component dùng chung chuẩn của hệ thống trong `src/shared/components/` (`DataTable`, `Pagination`, `Card`, `StatusBadge`, `Button`, `PageSkeleton`, `Modal`, `ConfirmModal`, `Collapse`, v.v.). TUYỆT ĐỐI KHÔNG tự chế HTML chay (như tự viết thẻ `<table>`, tự bọc `<div>` viền bo góc thay cho `Card`, dùng thẻ `<button>` chay thay cho `Button`, tự viết `<span>` huy hiệu thay cho `StatusBadge`, tự làm spinner thay cho `PageSkeleton`).
- **Component Creation Rule**: Nếu giao diện cần một component mà `src/shared/components/` CHƯA CÓ, và component đó có tính chất dùng chung / tái sử dụng nhiều lần giữa các tính năng/trang, PHẢI tạo component mới trong `src/shared/components/`, export tại `src/shared/components/index.ts` và viết unit test đi kèm thay vì viết ad-hoc bên trong feature.
- **Minimalist Headers & No Decorative Icon Clutter**: Hạn chế lạm dụng icon ở tiêu đề chính / tiêu đề modal / tiêu đề biểu đồ; TUYỆT ĐỐI KHÔNG chèn icon trang trí bên cạnh nhãn các thẻ chỉ số (metric/stat cards như gắn icon lịch cạnh "Đơn đặt chỗ", la bàn cạnh "Chuyến đi", icon % cạnh "Tỷ lệ lấp đầy", tam giác cạnh "Tỷ lệ hủy", v.v.). Việc gắn icon tràn lan khiến UI bị rối, lòe loẹt và "nhựa". Thẻ chỉ số phải giữ phong cách tối giản, hiện đại, tập trung vào typography: nhãn chữ nhỏ tinh gọn + con số lớn nổi bật + thông tin phụ ngắn gọn bên dưới. KHÔNG thêm các dòng mô tả hiển nhiên dưới các mục lớn để tối ưu không gian và giữ UI gãy gọn.
- **No Redundant UI & Single Total Display**: Trong cùng 1 modal/panel, CHỈ hiển thị thông tin tổng tiền / số lượng ở 1 vị trí duy nhất (ưu tiên tại footer action bar). TUYỆT ĐỐI KHÔNG render lặp lại 2 hộp tổng tiền trong cùng UI; KHÔNG thêm các câu miêu tả giải thích hiển nhiên làm loãng giao diện.
- **Data Table, Filter & Detail Pop-up Pattern**: Các danh sách quản lý (sự cố, đơn hàng, nhật ký) phải dùng `DataTable` kết hợp `Pagination` và thanh lọc (`FilterBar`) với pill tabs & search input. Thông tin trên từng dòng phải ngắn gọn; chi tiết phức tạp được xem qua pop-up (`DetailModal`) khi bấm icon `Eye`. Nút hành động xử lý nghiệp vụ chính (như *"Xử lý sự cố"*) đặt bên trong pop-up chi tiết để giữ bảng thông thoáng.
- **UX Copywriting & Language Rule**: Giao diện người dùng phải ngắn gọn, súc tích, trực diện. Tuyệt đối KHÔNG chèn tiếng Anh (cả trong ngoặc đơn như `(Audit History)`, `(User ID)` lẫn đan xen); KHÔNG dịch thô / dịch máy móc từ tiếng Anh; sử dụng từ ngữ tự nhiên, thuần Việt (ví dụ: dùng `"Ghi chú"` thay vì *"Ghi chú xử lý / Biên bản hành động"*, dùng `"Lịch sử"` thay vì *"Lịch sử xử lý sự cố (Audit History)"*).
- **Impeccable Visual Hygiene (Anti-AI Slop & Container Discipline)**:
  - Cấm lồng Card trong Card vô nghĩa (Nested Card Abuse). Nếu nội dung đã nằm trong `Card` hoặc section container lớn, phân tách các khối bằng khoảng trống (`space-y-4` / `gap-4`) hoặc divider thanh mảnh (`border-b border-border/40`). Tuyệt đối không bọc thêm một thẻ Card có viền dày và shadow bên trong.
  - Cấm sử dụng bóng đổ nặng (`shadow-lg`, `shadow-xl`) hoặc viền đậm nổi gân cộm mắt. Chỉ dùng `shadow-xs` hoặc `shadow-sm` cho elevation tinh tế. Nền card và background chuyển tiếp êm dịu (`bg-card` trên `bg-background`).
  - Loại bỏ các khối background rực rỡ hoặc gradient tùy tiện (`bg-gradient-to-r from-blue-500...`). Mọi gradient trang trí nếu có phải rất nhẹ và đồng nhất với palette camping xanh rêu (`#164027`).
- **Impeccable Typographic & Spatial Rhythm**:
  - Tỷ lệ khoảng cách (Spacing rhythm) tuân thủ nghiêm ngặt thang 4px: `p-4`, `p-6`, `gap-3`, `gap-4`, `gap-6`. Không dùng padding lệch hoặc lộn xộn.
  - Phân cấp Typography rõ rệt:
    - *Metric Values / Headline*: `text-2xl` hoặc `text-3xl font-bold tracking-tight text-foreground`.
    - *Section Title*: `text-lg font-semibold text-foreground`.
    - *Label / Metric Title*: `text-xs font-medium text-muted-foreground tracking-wide`.
    - *Supporting Meta*: `text-xs text-muted-foreground/80`.
  - Không để các khối text dày đặc không có nhịp thở; dùng line-height chuẩn (`leading-relaxed` cho đoạn văn, `leading-tight` cho con số lớn).
- **Impeccable Micro-interactions & Affordance**:
  - Mọi thành phần tương tác (interactive elements) PHẢI có visual affordance rõ rệt: hover state nhẹ (`hover:bg-muted/50`, `transition-colors duration-150`), active state, cursor pointer.
  - Nút bấm và hành động nguy hiểm (Xóa, Hủy, Từ chối) phải có xác nhận rõ qua `ConfirmModal`.
  - Empty state & Loading state: Không để khoảng trống vô hồn. Empty state phải có thông điệp hướng dẫn cụ thể kèm hành động tiếp theo nếu có; Loading state phải dùng `PageSkeleton` hoặc skeleton layout tương đồng cấu trúc trang thực tế.
- **Impeccable Directing Directives**:
  - Hỗ trợ các chỉ thị tinh chỉnh UI:
    - `distill` / `quieter`: Lọc bỏ viền thừa, card lồng card, icon rác, giảm độ tương phản của nền để mắt nghỉ ngơi.
    - `polish`: Đánh bóng từng viền border (1px mờ), căn chỉnh padding pixel-perfect, thêm hover affordance mượt mà.
    - `audit` / `critique`: Rà soát toàn bộ độ tương phản WCAG, độ nhất quán tokens, khoảng cách, font size, và tính thuần Việt của giao diện.
    - `bolder`: Tăng cường lực nhấn thị giác cho các số liệu KPIs và nút hành động chính.

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

- **Branch Naming**: Branch naming validated by `validate-branch-name` (e.g., `feat/<JIRA-KEY>-<description>`).
- **Commit Messages**: Follow Conventional Commits with Jira scope (enforced by `commitlint`, e.g., `feat(CTMS-101): ...`).
- **Pre-commit Linter**: Lint-staged runs Biome on pre-commit. Ensure no lint errors before committing.
- **Git Author & Account**: Always ensure author and active GitHub CLI account is `dklinh05` (`dklinh05@gmail.com`).
- **Terraform Exclusion**: TUYỆT ĐỐI KHÔNG commit hoặc push các thư mục/tập tin hạ tầng `infra/terraform/` lên git trừ khi được yêu cầu rõ ràng.
- **Conflict Resolution Principle (Không Xóa Logic Đồng Đội)**:
  - Khi resolve merge conflict (đặc biệt khi kéo/merge `origin/develop` vào nhánh tính năng), **TUYỆT ĐỐI KHÔNG tự ý xóa (remove) logic/code của người khác**.
  - Nếu logic không chồng chéo hoặc mâu thuẫn trực tiếp lên nhau (ví dụ: cùng thêm hàm seed mới, cùng thêm route, cùng import module, cùng thêm DTO/type), **BẮT BUỘC ưu tiên giữ cả hai** (hợp nhất đầy đủ cả logic của đồng đội lẫn logic mới của mình).
  - Chỉ thay đổi code của người khác khi có mâu thuẫn không thể dung hòa về mặt kiến trúc, và bắt buộc chạy lại toàn bộ test suite để đảm bảo không làm hỏng tính năng của người khác.
- **Pull Request Creation & Screenshot Evidence Protocol**:
  - Chụp ảnh giao diện thực tế kiểm thử bằng headless browser (Playwright) và lưu tạm thời **bên ngoài thư mục source code** của dự án.
  - **TUYỆT ĐỐI KHÔNG** upload ảnh bằng chứng PR lên Cloudinary của dự án (Cloudinary chỉ dành riêng cho runtime media của hệ thống: tour, campsite, avatar, reviews).
  - Cung cấp ảnh chụp để kéo thả trực tiếp vào ô soạn thảo Pull Request trên giao diện Web của GitHub (để GitHub tự upload lên CDN `user-attachments` miễn phí).
  - **Dọn dẹp file tạm**: Ngay sau khi ảnh đã được gắn vào PR, BẮT BUỘC xóa ngay lập tức file ảnh tạm trên máy cục bộ để không rác bộ nhớ.
  - Sau khi tạo PR, giải quyết merge conflict với `develop` nếu có, rồi merge vào nhánh `develop`.

