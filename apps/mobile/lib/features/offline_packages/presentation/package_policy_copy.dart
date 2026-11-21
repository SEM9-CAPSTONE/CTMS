import 'package:intl/intl.dart';
import 'package:timezone/data/latest.dart' as data;
import 'package:timezone/timezone.dart' as tz;

final _vietnam = (() {
  data.initializeTimeZones();
  return tz.getLocation('Asia/Ho_Chi_Minh');
})();

/// Presentation only: never use formatted device time for freshness decisions.
String packageTime(String value, {bool timeOnly = false}) {
  final instant = DateTime.tryParse(value);
  if (instant == null) return 'Chưa xác định';
  return DateFormat(
    timeOnly ? 'HH:mm' : 'dd/MM/yyyy HH:mm',
  ).format(tz.TZDateTime.from(instant, _vietnam));
}

const packageReasonLabels = <String, String>{
  'PACKAGE_TRIP_MISMATCH': 'Gói không thuộc chuyến này.',
  'PACKAGE_HASH_MISMATCH': 'Gói bị lỗi. Hãy tải lại.',
  'PACKAGE_ARTIFACT_UNAVAILABLE': 'Chưa có gói dùng được. Liên hệ chủ chuyến.',
  'PACKAGE_UPDATE_REQUIRED': 'Cần tải bản bắt buộc trước.',
  'PACKAGE_VERSION_LOCKED': 'Đang dùng bản đã khóa cho chuyến này.',
  'PACKAGE_TRIP_NOT_PUBLISHED': 'Chuyến này không còn cho phép thay gói.',
  'DEPARTURE_RESPONSIBLE_PORTER_REQUIRED':
      'Chỉ người hỗ trợ được phân công mới được xác nhận.',
  'PACKAGE_ACTIVATION_REQUIRED': 'Cần kích hoạt gói trên thiết bị trước.',
  'PACKAGE_DEPARTURE_NOT_READY': 'Người hỗ trợ cần xác nhận gói trước khi đi.',
  'SOURCE_FRESHNESS_UNAVAILABLE': 'Chưa biết dữ liệu có còn mới không.',
  'PACKAGE_SOURCE_EXPIRED': 'Dữ liệu đã hết hạn. Liên hệ chủ chuyến.',
  'NO_REQUIRED_PACKAGE': 'Chuyến này không yêu cầu gói bắt buộc.',
  'PACKAGE_DEPARTURE_READY': 'Thiết bị phụ trách đã được xác nhận.',
};
String packageReasonLabel(String? code) =>
    packageReasonLabels[code] ??
    'Chưa thể khởi hành, vui lòng liên hệ chủ chuyến.';
