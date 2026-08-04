# Prompt cho Claude Code (VS Code) — Dựng UI Flutter đồng bộ Figma

> **Cách dùng:** mở VS Code tại `D:\Do_an_tot_nghiep\CTMS`, gõ `/clear`, rồi dán **PROMPT 0** trước.
> Sau khi PROMPT 0 xong mới chạy PROMPT 1, 2, … Mỗi prompt là một phiên làm việc gọn để Claude không mất context.

---

## PROMPT 0 — Đồng bộ design system (chạy TRƯỚC TIÊN, chỉ 1 lần)

```
Đọc hai file sau trước khi làm bất cứ điều gì:
- docs/design/CTMS-DESIGN-SYSTEM.md
- docs/design/FIGMA-SCREEN-INVENTORY.md

Đây là bản trích xuất từ Figma và là source of truth cho UI của cả apps/web lẫn apps/mobile.

Nhiệm vụ: đồng bộ theme của apps/mobile (Flutter) với design system đó.

1. Sửa apps/mobile/lib/core/theme/app_colors.dart:
   - trailGreen hiện là #2F6D4F -> SAI. Đổi primary thành #164027 (khớp --brand-primary
     trong apps/web/src/index.css và khớp Figma).
   - Bổ sung đầy đủ token theo mục 1 của CTMS-DESIGN-SYSTEM.md: brand (primary/secondary/
     accent/light/bg/dark), status (success/warning/danger/info/neutral), neutral
     (surface/surfaceMuted/border/borderStrong/textPrimary/textSecondary/textMuted),
     role accent (porterClay #A85F28, camperLake #2C6E8E).
   - Dùng `static const Color`, đặt tên camelCase, có doc comment ngắn cho từng nhóm.

2. Tạo apps/mobile/lib/core/theme/app_typography.dart theo bảng typography mục 1.5
   (display/h1/h2/h3/body/bodyStrong/caption/label). Trả về `TextStyle` const.

3. Tạo apps/mobile/lib/core/theme/app_spacing.dart và app_radius.dart theo mục 1.6
   (spacing 4/8/12/16/20/24/32/40; radius card 12, control 10, pill 999).

4. Viết lại apps/mobile/lib/core/theme/app_theme.dart:
   - Giữ Material 3.
   - KHÔNG dùng ColorScheme.fromSeed nữa (seed làm lệch màu so với Figma).
     Khai báo ColorScheme.light/dark thủ công từ AppColors.
   - scaffoldBackgroundColor = AppColors.brandBg.
   - Cấu hình sẵn: appBarTheme, cardTheme (radius 12, elevation 0, border #E5EAE6),
     elevatedButtonTheme (primary, radius 10, height 40),
     outlinedButtonTheme, textButtonTheme, inputDecorationTheme (radius 10,
     filled trắng, border #E5EAE6, focus #164027), chipTheme, dividerTheme,
     navigationBarTheme (indicator #EEF7F0), textTheme map từ AppTypography.

5. Tạo thư mục apps/mobile/lib/core/widgets/ với các widget dùng chung, mỗi widget
   1 file, có ví dụ trong dartdoc:
   - CtmsButton (variant: primary/secondary/ghost/danger; size: md/lg; isLoading; icon)
   - CtmsStatusBadge (variant: soft/solid; status: success/warning/danger/info/neutral;
     nhận label + optional icon/dot)
   - CtmsStatCard (label, value, optional delta, optional icon, valueColor)
   - CtmsSectionCard (title, optional trailing action, child) — card trắng radius 12
   - CtmsAlertBanner (severity: info/warning/danger/emergency; title, message,
     timestamp, actions) — border trái 4px theo mục 2.9
   - CtmsChecklistItem + CtmsProgressBar
   - CtmsFilterChipRow
   - CtmsEmptyState, CtmsErrorState, CtmsLoadingState

Ràng buộc:
- KHÔNG hardcode màu/size ở bất kỳ đâu ngoài 4 file theme. Luôn đi qua AppColors/
  AppTypography/AppSpacing/AppRadius.
- Không thêm package mới ngoài những gì đã có trong pubspec.yaml.
- Chạy `flutter analyze` và sửa hết warning trước khi kết thúc.
- Cuối cùng in ra bảng mapping token: tên Dart <-> hex <-> tên CSS variable bên web.
```

---

## PROMPT 1 — Shell + điều hướng (Camper & Porter)

```
Đọc docs/design/CTMS-DESIGN-SYSTEM.md (mục 2.1, 2.2, 3) và
docs/design/FIGMA-SCREEN-INVENTORY.md (mục D và E).

Bối cảnh: Figma vẽ ở khổ desktop có sidebar 240px. apps/mobile là app điện thoại và
theo apps/mobile/lib/core/router/app_router.dart thì Flutter chỉ phục vụ Camper và
Porter (Host/Admin dùng web). Vì vậy phải CHUYỂN THỂ layout, không copy nguyên.

Quy tắc chuyển thể desktop -> mobile (áp dụng cho MỌI màn sau này):
- Sidebar 240px  -> NavigationBar dưới cùng (Material 3). Nếu > 5 mục thì 4 mục
  chính + mục "Thêm" mở bottom sheet.
- AppHeader      -> AppBar: title là tên trang, actions là icon chuông (có badge) +
  pill trạng thái kết nối thu nhỏ thành chấm màu. Bỏ breadcrumb.
- PageHeader     -> AppBar title + subtitle nhỏ dưới title (hoặc SliverAppBar.large).
  Nút hành động chính -> FloatingActionButton hoặc nút full-width cuối màn.
- KPI row 6 cột  -> GridView 2 cột (hoặc ListView ngang cuộn nếu > 4 chỉ số).
- DataTable      -> ListView các card; mỗi hàng bảng thành 1 card:
  dòng 1 = mã + badge trạng thái, dòng 2 = tiêu đề chính, dòng 3+ = cặp label/value.
  Bấm card -> mở trang chi tiết.
- Rail phải 320px-> các section xếp tiếp bên dưới nội dung chính, hoặc DraggableScroll
  ableSheet nếu là panel chi tiết ngữ cảnh (SOS, chi tiết thành viên...).
- FilterBar      -> nút "Bộ lọc" mở bottom sheet + hàng chip cuộn ngang.
- BulkActionBar  -> BottomAppBar hiện khi có lựa chọn.

Nhiệm vụ:
1. Tạo apps/mobile/lib/features/camper/presentation/camper_shell_screen.dart (thay thế
   file placeholder) với NavigationBar 5 mục: Tổng quan, Khám phá, Chuyến đi, Trợ lý AI,
   Hồ sơ. (Mục "Đơn đặt chỗ" đưa vào tab Chuyến đi dưới dạng tab con.)
2. Tạo apps/mobile/lib/features/porter/presentation/porter_shell_screen.dart với
   NavigationBar 5 mục: Tổng quan, Lịch, Bản đồ, Cảnh báo, Thêm
   (bottom sheet "Thêm" chứa: Thành viên đoàn, Sự cố, Hồ sơ & cài đặt).
3. Chuyển router sang StatefulShellRoute.indexedStack của go_router để giữ state
   từng tab. Cập nhật apps/mobile/lib/core/router/app_router.dart, giữ nguyên logic
   redirect theo role hiện có.
4. Tạo file placeholder cho từng tab, dùng CtmsEmptyState với đúng tiêu đề tiếng Việt
   lấy từ FIGMA-SCREEN-INVENTORY.md. Chưa gọi API.
5. Tạo apps/mobile/lib/core/widgets/ctms_scaffold.dart: scaffold chuẩn nhận
   title, subtitle, actions, body, floatingActionButton — dùng lại ở mọi màn.

Ràng buộc: chỉ dùng token từ core/theme. Chạy flutter analyze sạch. Không đụng
apps/web hay services/api.
```

---

## PROMPT 2..N — Từng màn hình

Lặp lại mẫu dưới đây, mỗi lần **1 màn**. Thứ tự đề xuất:
`Porter Tổng quan → Porter Lịch phân công → Porter Cảnh báo → Porter Thành viên đoàn → Porter Sự cố → Porter Bản đồ → Camper Tổng quan → Camper Chuyến đi của tôi → Camper Khám phá → Camper Trợ lý AI → Camper Hồ sơ`

```
Đọc docs/design/CTMS-DESIGN-SYSTEM.md và mục "<SỐ>. <TÊN FRAME>" trong
docs/design/FIGMA-SCREEN-INVENTORY.md.

Dựng màn <TÊN MÀN> cho apps/mobile theo đúng nội dung, thứ tự section, nhãn tiếng Việt
và badge trạng thái mô tả trong file inventory. Áp dụng quy tắc chuyển thể
desktop -> mobile đã thống nhất ở PROMPT 1.

Cấu trúc file (feature-first, khớp cấu trúc auth hiện có):
  lib/features/<role>/<feature>/
    domain/<feature>_models.dart      # freezed + json_serializable
    data/<feature>_api.dart           # dio, endpoint khai báo trong core/api/api_endpoints.dart
    data/<feature>_repository.dart
    application/<feature>_controller.dart   # riverpod_annotation, AsyncValue
    presentation/<feature>_screen.dart
    presentation/widgets/*.dart       # mỗi widget con 1 file, < 150 dòng

Yêu cầu:
- Dùng dữ liệu mẫu (mock) đúng như số liệu trong file inventory để dựng UI trước;
  đặt trong data/<feature>_mock.dart và đánh dấu rõ // TODO(api): thay bằng API thật.
- Xử lý đủ 3 trạng thái: loading (skeleton/shimmer đơn giản), error (CtmsErrorState
  có nút thử lại), empty (CtmsEmptyState).
- Mọi chuỗi hiển thị gom vào <feature>_strings.dart (chuẩn bị cho i18n sau).
- Định dạng số/tiền/ngày theo mục 4 của design system, dùng package intl đã có.
- KHÔNG hardcode màu, size, radius — chỉ dùng AppColors/AppTypography/AppSpacing/AppRadius.
- Tái sử dụng widget trong core/widgets; nếu cần widget dùng chung mới thì thêm vào
  core/widgets thay vì viết cục bộ.
- Sau khi xong: chạy `flutter analyze`, sửa hết issue, rồi liệt kê các widget mới
  đã thêm vào core/widgets.
```

---

## Gợi ý thêm

**Nên tạo `CLAUDE.md` ở gốc repo.** File `.agents/AGENTS.md` hiện tại đang mô tả dự án
**E-Hub** (React 19, Shadcn, TanStack Query, Zustand, NestJS+Prisma) — không khớp CTMS
(`apps/web` chỉ có React 18 + Vite + Tailwind v4 + lucide + leaflet + socket.io, không có
Shadcn/TanStack/Zustand). Claude Code đọc nhầm file này sẽ sinh code sai stack. Prompt gợi ý:

```
Tạo CLAUDE.md ở gốc repo mô tả đúng CTMS:
- apps/web: React 18 + Vite 6 + TS + Tailwind v4 + lucide-react + leaflet + socket.io-client.
  Cấu trúc feature-first: src/features/<name>/{components,hooks,services,pages,constants,types.ts}
  + src/core/{api,layout,assets} + src/shared + src/routes.
- apps/mobile: Flutter + Riverpod (riverpod_annotation) + go_router + dio + freezed +
  json_serializable + flutter_secure_storage + intl. Cấu trúc lib/core/* và
  lib/features/<name>/{domain,data,application,presentation}.
- services/api: NestJS.
- UI source of truth: docs/design/CTMS-DESIGN-SYSTEM.md.
Ghi rõ .agents/AGENTS.md là tài liệu của dự án khác, không áp dụng cho CTMS
(hoặc xoá/đổi tên nếu không còn dùng).
```
