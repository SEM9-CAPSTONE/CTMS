/// All copy for "Tổng quan — Camper Hub", gathered ahead of i18n. Wording
/// follows `docs/design/FIGMA-SCREEN-INVENTORY.md` #23 verbatim where it
/// gives literal labels; section titles/button copy are already fixed
/// there, so there's little left to author freely on this screen.
class CamperOverviewStrings {
  CamperOverviewStrings._();

  static const appBarTitle = 'Tổng quan';

  static String greeting(String timeOfDay, String name) => 'Chào buổi $timeOfDay, $name!';
  static const heroDescription =
      'Hành trình tiếp theo của bạn đang chờ — kiểm tra lịch trình và chuẩn bị sẵn sàng.';
  static const exploreCta = 'Khám phá địa điểm';
  static const viewTripsCta = 'Xem chuyến đi';

  static const noticesTitle = 'Thông báo quan trọng';
  static const noticesSeeAll = 'Tất cả';

  static const upcomingTripTitle = 'Chuyến đi sắp tới';
  static const memberCountLabel = 'Thành viên';
  static const difficultyLabel = 'Độ khó';
  static const porterInChargeLabel = 'Porter phụ trách';
  static const weatherRiskLabel = 'Rủi ro thời tiết';
  static const viewTripDetailCta = 'Xem chi tiết chuyến đi';

  static String preparationTitle(int percent) => 'Chuẩn bị trước chuyến đi $percent%';

  static const quickActionGuideCenter = 'Trung tâm cẩm nang';
  static const quickActionMyTrips = 'Xem chuyến đi';
  static const quickActionAiSupport = 'Hỗ trợ AI';
  static const quickActionUpdateProfile = 'Cập nhật hồ sơ';

  static const weatherCardTitle = 'Rủi ro thời tiết';
  static const rainChanceLabel = 'Khả năng mưa';
  static const windSpeedLabel = 'Sức gió';
  static const temperatureLabel = 'Nhiệt độ';
  static const visibilityLabel = 'Tầm nhìn';
  static const weatherDetailCta = 'Xem chi tiết';

  static const transactionsTitle = 'Giao dịch gần đây';
  static const transactionsSeeAll = 'Xem tất cả ›';
  static const transactionLocationLabel = 'Địa điểm';
  static const transactionStayDateLabel = 'Ngày lưu trú';
  static const transactionGuestsLabel = 'Khách';
  static const transactionAmountLabel = 'Tổng tiền';

  static const suggestionsTitle = 'Gợi ý dành cho bạn';
  static const perPersonSuffix = ' / người';

  static const emptyUpcomingTripTitle = 'Chưa có chuyến đi sắp tới';
  static const emptyUpcomingTripMessage = 'Khám phá địa điểm mới để lên kế hoạch chuyến đi.';
  static const emptyTransactionsTitle = 'Chưa có giao dịch nào';
  static const emptySuggestionsTitle = 'Chưa có gợi ý phù hợp';

  static const errorMessage = 'Không thể tải dữ liệu tổng quan.';

  static String guestCount(int count) => '$count khách';
}
