import '../domain/camper_overview_models.dart';

/// Mock payload for "Tổng quan — Camper Hub" — numbers/copy match
/// `docs/design/FIGMA-SCREEN-INVENTORY.md` #23 where the frame gives
/// literal values (68% prep, weather stats, the 3 suggestion badges);
/// everything else (trip name, transaction codes...) is authored to fit.
// TODO(api): replace with a GET to a future `/campers/me/overview`-style
// endpoint — CamperOverviewRepository is the only place that needs to
// change, see camper_overview_repository.dart.
final mockCamperOverviewSnapshot = CamperOverviewSnapshot(
  notices: const [
    OverviewNotice(message: 'Cập nhật hồ sơ cá nhân của bạn', severity: OverviewSeverity.warning),
    OverviewNotice(
      message: 'Số liệu ngoại tuyến đã sẵn sàng để tải xuống',
      severity: OverviewSeverity.info,
    ),
    OverviewNotice(
      message: 'Danh sách vật dụng cho chuyến sắp tới',
      severity: OverviewSeverity.success,
    ),
  ],
  upcomingTrip: UpcomingTrip(
    name: 'Trekking Tà Năng – Phan Dũng',
    statusLabel: 'Đã xác nhận',
    startDate: DateTime(2026, 7, 28),
    durationDays: 3,
    memberCount: 8,
    difficulty: 'Trung bình',
    porterName: 'Anh Minh',
    weatherRiskLabel: 'An toàn',
  ),
  preparationProgress: 0.68,
  preparationItems: const [
    PreparationItem(
      label: 'Danh sách thành viên',
      statusLabel: 'Xong',
      severity: OverviewSeverity.success,
    ),
    PreparationItem(
      label: 'Dụng cụ cá nhân',
      statusLabel: 'Xong',
      severity: OverviewSeverity.success,
    ),
    PreparationItem(
      label: 'Thiết bị cắm trại',
      statusLabel: 'Đã tải',
      severity: OverviewSeverity.success,
    ),
    PreparationItem(
      label: 'Dữ liệu ngoại tuyến',
      statusLabel: 'Chưa tải',
      severity: OverviewSeverity.danger,
    ),
    PreparationItem(
      label: 'Xác nhận lịch trình',
      statusLabel: 'Chưa xác nhận',
      severity: OverviewSeverity.neutral,
    ),
  ],
  weatherRisk: const WeatherRiskSnapshot(
    badgeLabel: 'Cần chú ý',
    rainChancePercent: 45,
    windSpeedKmh: 12,
    temperatureRangeLabel: '24-26°C',
    visibilityKm: 10,
    note: 'Nên mang theo áo mưa và kiểm tra lại lịch trình trước khi khởi hành.',
  ),
  recentTransactions: [
    RecentTransaction(
      code: 'BK-88219',
      location: 'Tà Năng – Phan Dũng',
      stayDate: DateTime(2026, 7, 20),
      guestCount: 4,
      amountVnd: 2450000,
      statusLabel: 'Đã thanh toán',
      severity: OverviewSeverity.success,
    ),
    RecentTransaction(
      code: 'BK-88034',
      location: 'Bidoup Núi Bà',
      stayDate: DateTime(2026, 6, 15),
      guestCount: 2,
      amountVnd: 1200000,
      statusLabel: 'Đã hoàn thành',
      severity: OverviewSeverity.neutral,
    ),
    RecentTransaction(
      code: 'BK-87990',
      location: 'LangBiang',
      stayDate: DateTime(2026, 5, 10),
      guestCount: 6,
      amountVnd: 3100000,
      statusLabel: 'Chờ xác nhận',
      severity: OverviewSeverity.warning,
    ),
  ],
  suggestions: const [
    SuggestedCampsite(
      name: 'Bãi Đá Đen Basecamp',
      location: 'Tà Năng, Lâm Đồng',
      pricePerPersonVnd: 350000,
      badgeLabel: 'Còn 4 chỗ',
      badgeSeverity: OverviewSeverity.warning,
    ),
    SuggestedCampsite(
      name: 'LangBiang Camping',
      location: 'Đà Lạt, Lâm Đồng',
      pricePerPersonVnd: 280000,
      badgeLabel: 'Sắp kín chỗ',
      badgeSeverity: OverviewSeverity.danger,
    ),
    SuggestedCampsite(
      name: 'Bidoup Núi Bà',
      location: 'Lạc Dương, Lâm Đồng',
      pricePerPersonVnd: 420000,
      badgeLabel: 'Còn 12 chỗ',
      badgeSeverity: OverviewSeverity.success,
    ),
  ],
);
