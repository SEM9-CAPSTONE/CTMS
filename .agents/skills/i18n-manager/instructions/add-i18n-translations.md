# Instruction: Thêm i18n cho Feature (Frontend + Backend)

## Mục tiêu
Hướng dẫn step-by-step thêm i18n đầy đủ cho một feature mới hoặc bổ sung translations cho feature hiện có.

---

## Bước 1: Xác định Feature Namespace

- **Frontend**: camelCase matching folder name → `featureName`
- **Backend**: kebab-case matching folder name → `feature-name`

Ví dụ: Feature `bilateral-meetings`:
- FE namespace: `bilateralMeetings`
- BE namespace: `bilateral-meetings`

---

## Bước 2: Tạo i18n Files cho Frontend

### 2a. English File

Tạo `ehub-reactjs-fe/src/core/i18n/locales/en/<featureName>.json`:

```json
{
	"title": "Feature Title",
	"subtitle": "Feature subtitle or description",
	"actions": {
		"create": "Create New",
		"edit": "Edit",
		"delete": "Delete",
		"save": "Save",
		"saveDraft": "Save as Draft",
		"publish": "Publish",
		"cancel": "Cancel",
		"confirm": "Confirm",
		"back": "Back",
		"search": "Search...",
		"filter": "Filter",
		"clearFilters": "Clear Filters",
		"viewDetail": "View Details",
		"export": "Export"
	},
	"fields": {
		"name": "Name",
		"description": "Description",
		"status": "Status",
		"createdAt": "Created At",
		"updatedAt": "Updated At",
		"createdBy": "Created By",
		"category": "Category"
	},
	"status": {
		"draft": "Draft",
		"active": "Active",
		"published": "Published",
		"archived": "Archived",
		"completed": "Completed",
		"pending": "Pending"
	},
	"messages": {
		"createSuccess": "Created successfully",
		"updateSuccess": "Updated successfully",
		"deleteSuccess": "Deleted successfully",
		"publishSuccess": "Published successfully",
		"saveDraftSuccess": "Draft saved successfully",
		"loadError": "Failed to load data",
		"saveError": "Failed to save",
		"deleteError": "Failed to delete"
	},
	"confirm": {
		"deleteTitle": "Delete Item",
		"deleteDescription": "Are you sure you want to delete this item? This action cannot be undone.",
		"publishTitle": "Publish Item",
		"publishDescription": "Are you sure you want to publish? This action cannot be undone."
	},
	"empty": {
		"title": "No Items Found",
		"description": "Create your first item to get started.",
		"filtered": "No items match your current filters."
	},
	"table": {
		"noData": "No data available",
		"showing": "Showing {{from}} to {{to}} of {{total}} results"
	},
	"validation": {
		"nameRequired": "Name is required",
		"nameMaxLength": "Name must be less than {{max}} characters",
		"descriptionMaxLength": "Description must be less than {{max}} characters"
	}
}
```

### 2b. Vietnamese File

Tạo `ehub-reactjs-fe/src/core/i18n/locales/vi/<featureName>.json`:

```json
{
	"title": "Tiêu đề tính năng",
	"subtitle": "Phụ đề hoặc mô tả tính năng",
	"actions": {
		"create": "Tạo mới",
		"edit": "Chỉnh sửa",
		"delete": "Xóa",
		"save": "Lưu",
		"saveDraft": "Lưu nháp",
		"publish": "Xuất bản",
		"cancel": "Hủy",
		"confirm": "Xác nhận",
		"back": "Quay lại",
		"search": "Tìm kiếm...",
		"filter": "Lọc",
		"clearFilters": "Xóa bộ lọc",
		"viewDetail": "Xem chi tiết",
		"export": "Xuất"
	},
	"fields": {
		"name": "Tên",
		"description": "Mô tả",
		"status": "Trạng thái",
		"createdAt": "Ngày tạo",
		"updatedAt": "Ngày cập nhật",
		"createdBy": "Người tạo",
		"category": "Danh mục"
	},
	"status": {
		"draft": "Nháp",
		"active": "Hoạt động",
		"published": "Đã xuất bản",
		"archived": "Lưu trữ",
		"completed": "Hoàn thành",
		"pending": "Chờ xử lý"
	},
	"messages": {
		"createSuccess": "Tạo thành công",
		"updateSuccess": "Cập nhật thành công",
		"deleteSuccess": "Xóa thành công",
		"publishSuccess": "Xuất bản thành công",
		"saveDraftSuccess": "Lưu nháp thành công",
		"loadError": "Tải dữ liệu thất bại",
		"saveError": "Lưu thất bại",
		"deleteError": "Xóa thất bại"
	},
	"confirm": {
		"deleteTitle": "Xóa mục",
		"deleteDescription": "Bạn có chắc chắn muốn xóa mục này? Hành động này không thể hoàn tác.",
		"publishTitle": "Xuất bản",
		"publishDescription": "Bạn có chắc chắn muốn xuất bản? Hành động này không thể hoàn tác."
	},
	"empty": {
		"title": "Không có mục nào",
		"description": "Tạo mục đầu tiên để bắt đầu.",
		"filtered": "Không có mục nào phù hợp với bộ lọc hiện tại."
	},
	"table": {
		"noData": "Không có dữ liệu",
		"showing": "Hiển thị {{from}} đến {{to}} trong tổng số {{total}} kết quả"
	},
	"validation": {
		"nameRequired": "Tên là bắt buộc",
		"nameMaxLength": "Tên phải ít hơn {{max}} ký tự",
		"descriptionMaxLength": "Mô tả phải ít hơn {{max}} ký tự"
	}
}
```

### 2c. Đăng ký Namespace

Mở [core/i18n/index.ts](file:///c:/Users/ASUS/Desktop/ehub-befe/ehub-reactjs-fe/src/core/i18n/index.ts) và thêm theo thứ tự alphabetical:

```typescript
// Thêm imports (theo thứ tự alpha)
import featureNameEn from "./locales/en/featureName.json";
// ... (vị trí alpha trong khối EN imports)
import featureNameVi from "./locales/vi/featureName.json";
// ... (vị trí alpha trong khối VI imports)

// Thêm vào resources object
export const resources = {
	en: {
		// ... existing entries (thêm theo thứ tự alpha)
		featureName: featureNameEn,
	},
	vi: {
		// ... existing entries (thêm theo thứ tự alpha)
		featureName: featureNameVi,
	},
} as const;
```

---

## Bước 3: Tạo i18n Files cho Backend

### 3a. English File

Tạo `ehub-nestjs-be/src/i18n/en/<feature-name>.json`:

```json
{
	"RETRIEVED_SUCCESS": "{{entity}} retrieved successfully",
	"CREATED_SUCCESS": "{{entity}} created successfully",
	"UPDATED_SUCCESS": "{{entity}} updated successfully",
	"DELETED_SUCCESS": "{{entity}} deleted successfully",
	"PUBLISHED_SUCCESS": "{{entity}} published successfully",
	"NOT_FOUND": "{{entity}} not found",
	"ALREADY_EXISTS": "{{entity}} already exists",
	"INVALID_STATUS_TRANSITION": "Cannot change status from {{from}} to {{to}}",
	"UNAUTHORIZED_ACTION": "You are not authorized to perform this action"
}
```

### 3b. Vietnamese File

Tạo `ehub-nestjs-be/src/i18n/vi/<feature-name>.json`:

```json
{
	"RETRIEVED_SUCCESS": "Lấy {{entity}} thành công",
	"CREATED_SUCCESS": "Tạo {{entity}} thành công",
	"UPDATED_SUCCESS": "Cập nhật {{entity}} thành công",
	"DELETED_SUCCESS": "Xóa {{entity}} thành công",
	"PUBLISHED_SUCCESS": "Xuất bản {{entity}} thành công",
	"NOT_FOUND": "Không tìm thấy {{entity}}",
	"ALREADY_EXISTS": "{{entity}} đã tồn tại",
	"INVALID_STATUS_TRANSITION": "Không thể chuyển trạng thái từ {{from}} sang {{to}}",
	"UNAUTHORIZED_ACTION": "Bạn không có quyền thực hiện hành động này"
}
```

---

## Bước 4: Sử dụng trong Code

### Frontend — Components

```typescript
import { useTranslation } from "react-i18next";

function FeatureComponent() {
	// Chỉ định namespace
	const { t } = useTranslation("featureName");

	return (
		<div>
			<h1>{t("title")}</h1>
			<Button>{t("actions.create")}</Button>

			{/* Dùng interpolation */}
			<p>{t("table.showing", { from: 1, to: 10, total: 100 })}</p>

			{/* Dùng namespace khác (common) */}
			<p>{t("common:loading")}</p>
		</div>
	);
}
```

### Frontend — Hooks (Toast messages)

```typescript
import i18n from "@/core/i18n";

// Trong mutation onSuccess
toast.success(i18n.t("featureName.messages.createSuccess"));
toast.error(i18n.t("featureName.messages.saveError"));
```

### Backend — Controllers

```typescript
import { I18n, I18nContext } from "nestjs-i18n";

@Get()
async findAll(
	@Query() query: GetFeatureQueryDto,
	@I18n() i18n: I18nContext,
) {
	const result = await this.featureService.findAll(query);
	return BaseResponse.ok(
		result.data,
		i18n.t("feature-name.RETRIEVED_SUCCESS", {
			args: { entity: "Feature" },
		}),
	);
}
```

---

## Bước 5: Audit i18n Coverage

### Tìm hardcoded text (FE)

```bash
# Tìm text trong JSX không dùng t()
grep -rn ">[A-Z][a-z]" --include="*.tsx" src/features/<feature-name>/ | grep -v "{t("
```

### Tìm hardcoded messages (BE)

```bash
# Tìm BaseResponse không dùng i18n
grep -rn "BaseResponse.ok" --include="*.ts" src/features/<feature-name>/ | grep -v "i18n.t"
```

### So sánh keys EN vs VI

```bash
# Liệt kê keys EN
node -e "const f=require('./src/i18n/en/feature-name.json'); console.log(Object.keys(f).join('\n'))"

# Liệt kê keys VI
node -e "const f=require('./src/i18n/vi/feature-name.json'); console.log(Object.keys(f).join('\n'))"
```

---

## Checklist Cuối

### Frontend
- [ ] File `en/<featureName>.json` tạo xong
- [ ] File `vi/<featureName>.json` tạo xong, keys khớp EN
- [ ] Namespace đăng ký trong `core/i18n/index.ts`
- [ ] Tất cả text UI dùng `t("featureName.key")`
- [ ] Toast messages dùng `i18n.t("featureName.messages.key")`
- [ ] Validation messages dùng `t("featureName.validation.key")`
- [ ] Không còn hardcoded strings trong JSX

### Backend
- [ ] File `en/<feature-name>.json` tạo xong
- [ ] File `vi/<feature-name>.json` tạo xong, keys khớp EN
- [ ] Controller methods inject `@I18n() i18n: I18nContext`
- [ ] Response messages dùng `i18n.t("feature-name.KEY")`
- [ ] Error messages dùng i18n keys
- [ ] Không còn hardcoded response messages
