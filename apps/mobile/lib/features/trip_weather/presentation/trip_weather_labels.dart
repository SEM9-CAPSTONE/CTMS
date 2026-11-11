import '../../../core/api/api_exception.dart';
import '../../../core/widgets/ctms_status_badge.dart';

/// Same wording as the web (`apps/web/src/features/weather/utils/weather-risk.ts`).
const weatherRiskLabels = {
  'green': 'An toàn (Xanh)',
  'yellow': 'Cảnh báo (Vàng)',
  'red': 'Nguy hiểm (Đỏ)',
};

/// Short value for the "THỜI TIẾT" highlight box of the Trip screen.
const weatherRiskShortLabels = {
  'green': 'An toàn',
  'yellow': 'Cảnh báo',
  'red': 'Nguy hiểm',
};

const weatherNoForecastShortLabel = 'Chưa có dự báo';

CtmsStatus weatherRiskStatus(String? level) => switch (level) {
  'green' => CtmsStatus.success,
  'yellow' => CtmsStatus.warning,
  'red' => CtmsStatus.danger,
  _ => CtmsStatus.neutral,
};

String weatherRiskLabel(String? level) =>
    weatherRiskLabels[level] ?? 'Chưa có dự báo';

/// How much the forecast can be relied on from the time left before departure
/// (policy §2, same as the web `trip-forecast-reliability.ts`).
({String label, String description, CtmsStatus status}) forecastReliability(
  DateTime tripStartsAt,
  DateTime now,
) {
  final left = tripStartsAt.difference(now);
  if (left <= const Duration(days: 3)) {
    return (
      label: 'Độ tin cậy cao',
      description:
          'Còn 3 ngày trở xuống: dự báo đủ tin cậy để làm căn cứ quyết định.',
      status: CtmsStatus.success,
    );
  }
  if (left <= const Duration(days: 7)) {
    return (
      label: 'Cảnh báo sớm',
      description:
          'Còn 4–7 ngày: dự báo dùng để cảnh báo sớm, vẫn có thể thay đổi.',
      status: CtmsStatus.warning,
    );
  }
  return (
    label: 'Dự báo xa, có thể thay đổi',
    description:
        'Còn hơn 7 ngày: chỉ để tham khảo, hệ thống sẽ cập nhật bản mới khi gần ngày đi.',
    status: CtmsStatus.neutral,
  );
}

String _serverText(ApiException error) {
  final data = error.errorData;
  if (data is Map) {
    final message = data['message'];
    if (message is String) return message;
    if (message is List) return message.join(' ');
  }
  return error.message;
}

/// Same messages as the web `tripDatesWeatherErrorMessage`.
String tripWeatherErrorMessage(Object error) {
  const fallback = 'Không tải được dự báo thời tiết. Vui lòng thử lại.';
  if (error is! ApiException) return fallback;
  return switch (error.statusCode) {
    404 => 'Chuyến đi không còn mở để xem dự báo thời tiết.',
    409 =>
      'Chuyến đi đã kết thúc hoặc hệ thống chưa cấu hình quy tắc rủi ro thời tiết.',
    422 => 'Chuyến đi chưa có tuyến hoặc thời gian để dự báo thời tiết.',
    503 => 'Dịch vụ thời tiết tạm thời không khả dụng. Vui lòng thử lại sau.',
    _ => fallback,
  };
}

final _rescheduleMessages = <(RegExp, String)>[
  (
    RegExp('not rescheduled because of the weather', caseSensitive: false),
    'Lần dời lịch này không phải vì thời tiết nên không áp dụng hoàn 100%. Vui lòng liên hệ Host.',
  ),
  (
    RegExp('not waiting for a reschedule answer', caseSensitive: false),
    'Đơn đặt chỗ này không còn chờ bạn trả lời.',
  ),
  (
    RegExp('no longer open for a reschedule answer', caseSensitive: false),
    'Trip không còn nhận trả lời về lịch mới.',
  ),
];

/// Same messages as the web `weatherDecisionErrorMessage` for the reschedule answer.
String weatherRescheduleErrorMessage(Object error) {
  const fallback = 'Không gửi được yêu cầu. Vui lòng thử lại.';
  if (error is! ApiException) return fallback;
  final text = _serverText(error);
  for (final (pattern, vietnamese) in _rescheduleMessages) {
    if (pattern.hasMatch(text)) return vietnamese;
  }
  return switch (error.statusCode) {
    403 => 'Bạn không có quyền thực hiện thao tác này.',
    404 => 'Không tìm thấy Trip hoặc đơn đặt chỗ.',
    409 => 'Trạng thái Trip đã thay đổi. Vui lòng tải lại.',
    _ => fallback,
  };
}

String formatWeatherTime(DateTime value) {
  final local = value.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(local.hour)}:${two(local.minute)} ${two(local.day)}/${two(local.month)}/${local.year}';
}

String formatWeatherDate(DateTime value) {
  final local = value.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(local.day)}/${two(local.month)}/${local.year}';
}

String _trim(double value) => value == value.roundToDouble()
    ? value.toStringAsFixed(0)
    : value.toStringAsFixed(1);

String formatRainfall(double mm) => '${_trim(mm)} mm';
String formatWind(double kph) => '${_trim(kph)} km/h';
String formatTemperature(double c) => '${_trim(c)}°C';
String formatVisibility(double m) =>
    m >= 1000 ? '${_trim(m / 1000)} km' : '${_trim(m)} m';
