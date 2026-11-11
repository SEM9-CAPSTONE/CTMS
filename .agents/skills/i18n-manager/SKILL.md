---
name: i18n-manager
description: >
  Manages internationalization (i18n) for both frontend (react-i18next) and backend (nestjs-i18n).
  Use when adding new features, adding translations, or auditing i18n completeness.
  Creates translation keys in both en/vi, registers namespaces, ensures no hardcoded text.
---

# i18n Manager Skill

## Purpose

Manage i18n (internationalization) across the ehub monorepo, ensuring all user-facing
text is translated in both English and Vietnamese, with proper namespace registration
and no hardcoded strings.

## Trigger

Use this skill when:
- User asks to add translations for a new feature
- User asks to check for missing translations
- User asks to add a new language
- Creating a new feature module (frontend or backend)
- Auditing i18n coverage

## Frontend i18n (react-i18next)

### Architecture

```
ehub-reactjs-fe/src/core/i18n/
├── index.ts                    # i18n setup, namespace registration
└── locales/
    ├── en/
    │   ├── common.json         # Shared translations
    │   ├── auth.json           # Auth feature translations
    │   ├── prCycles.json       # PR Cycles feature
    │   └── <featureName>.json  # One per feature
    └── vi/
        ├── common.json
        ├── auth.json
        ├── prCycles.json
        └── <featureName>.json
```

### Adding a New Feature Namespace

#### Step 1 — Create translation files

**English** (`core/i18n/locales/en/<featureName>.json`):
```json
{
  "title": "Feature Title",
  "description": "Feature description",
  "actions": {
    "create": "Create",
    "edit": "Edit",
    "delete": "Delete",
    "save": "Save",
    "cancel": "Cancel"
  },
  "fields": {
    "name": "Name",
    "status": "Status",
    "createdAt": "Created At"
  },
  "status": {
    "draft": "Draft",
    "active": "Active",
    "archived": "Archived"
  },
  "messages": {
    "createSuccess": "Created successfully",
    "updateSuccess": "Updated successfully",
    "deleteSuccess": "Deleted successfully",
    "deleteConfirm": "Are you sure you want to delete this item?"
  },
  "errors": {
    "notFound": "Item not found",
    "loadFailed": "Failed to load data"
  },
  "empty": {
    "title": "No items found",
    "description": "Create your first item to get started"
  }
}
```

**Vietnamese** (`core/i18n/locales/vi/<featureName>.json`):
```json
{
  "title": "Tiêu đề tính năng",
  "description": "Mô tả tính năng",
  "actions": {
    "create": "Tạo mới",
    "edit": "Chỉnh sửa",
    "delete": "Xóa",
    "save": "Lưu",
    "cancel": "Hủy"
  },
  "fields": {
    "name": "Tên",
    "status": "Trạng thái",
    "createdAt": "Ngày tạo"
  },
  "status": {
    "draft": "Nháp",
    "active": "Hoạt động",
    "archived": "Lưu trữ"
  },
  "messages": {
    "createSuccess": "Tạo thành công",
    "updateSuccess": "Cập nhật thành công",
    "deleteSuccess": "Xóa thành công",
    "deleteConfirm": "Bạn có chắc chắn muốn xóa mục này không?"
  },
  "errors": {
    "notFound": "Không tìm thấy mục",
    "loadFailed": "Tải dữ liệu thất bại"
  },
  "empty": {
    "title": "Không có mục nào",
    "description": "Tạo mục đầu tiên để bắt đầu"
  }
}
```

#### Step 2 — Register in `core/i18n/index.ts`

Follow the existing import pattern exactly:

```typescript
// Add to EN imports section
import featureNameEn from "./locales/en/featureName.json";

// Add to VI imports section
import featureNameVi from "./locales/vi/featureName.json";

// Add to resources.en object
export const resources = {
  en: {
    // ... existing entries
    featureName: featureNameEn,
  },
  vi: {
    // ... existing entries
    featureName: featureNameVi,
  },
} as const;
```

#### Step 3 — Usage in Components

```typescript
import { useTranslation } from "react-i18next";

function FeatureComponent() {
  const { t } = useTranslation("featureName");

  return (
    <div>
      <h1>{t("title")}</h1>
      <p>{t("description")}</p>
      <Button>{t("actions.create")}</Button>
    </div>
  );
}
```

## Backend i18n (nestjs-i18n)

### Architecture

```
ehub-nestjs-be/src/i18n/
├── en/
│   ├── common.json
│   ├── errors.json
│   ├── notifications.json
│   └── <feature-name>.json
└── vi/
    ├── common.json
    ├── errors.json
    ├── notifications.json
    └── <feature-name>.json
```

### Adding Backend Translations

#### Step 1 — Create translation files

**English** (`src/i18n/en/<feature-name>.json`):
```json
{
  "RETRIEVED_SUCCESS": "{{entity}} retrieved successfully",
  "CREATED_SUCCESS": "{{entity}} created successfully",
  "UPDATED_SUCCESS": "{{entity}} updated successfully",
  "DELETED_SUCCESS": "{{entity}} deleted successfully",
  "NOT_FOUND": "{{entity}} not found",
  "ALREADY_EXISTS": "{{entity}} already exists"
}
```

**Vietnamese** (`src/i18n/vi/<feature-name>.json`):
```json
{
  "RETRIEVED_SUCCESS": "Lấy {{entity}} thành công",
  "CREATED_SUCCESS": "Tạo {{entity}} thành công",
  "UPDATED_SUCCESS": "Cập nhật {{entity}} thành công",
  "DELETED_SUCCESS": "Xóa {{entity}} thành công",
  "NOT_FOUND": "Không tìm thấy {{entity}}",
  "ALREADY_EXISTS": "{{entity}} đã tồn tại"
}
```

#### Step 2 — Usage in Controllers

```typescript
import { I18n, I18nContext } from "nestjs-i18n";

@Get()
@UseGuards(AuthGuard)
async findAll(
  @Query() query: GetFeatureQueryDto,
  @I18n() i18n: I18nContext,
) {
  const result = await this.featureService.findAll(query);
  return BaseResponse.ok(
    result.data,
    i18n.t("feature-name.RETRIEVED_SUCCESS", { args: { entity: "Feature" } }),
  );
}
```

## i18n Audit Process

When auditing, check:
1. **Every user-facing string** in components uses `t()`
2. **Every response message** in controllers uses `i18n.t()`
3. **Both en and vi** files have matching keys
4. **No hardcoded text** in JSX or response objects
5. **Namespaces registered** in i18n config

Report format:
```
## i18n Audit Report

### Missing Translations
- feature.json:vi missing key: "newFeature.title"
- feature.json:en missing key: "status.pending"

### Hardcoded Text Found
- FeaturePage.tsx:45 → "Loading..." (should use t("common.loading"))
- feature.controller.ts:30 → "Success" (should use i18n.t())

### Coverage
- EN: 98% (2 missing keys)
- VI: 95% (5 missing keys)
```
