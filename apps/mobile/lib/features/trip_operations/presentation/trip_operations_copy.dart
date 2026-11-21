import '../../../core/api/api_exception.dart';
import '../../offline_packages/presentation/package_policy_copy.dart';

String lifecycleReason(String? code) => switch (code) {
  'TRIP_START_TOO_EARLY' => 'Chưa đến giờ khởi hành dự kiến.',
  'TRIP_START_SCHEDULE_ENDED' =>
    'Đã qua lịch chuyến đi. Hãy liên hệ chủ chuyến để kiểm tra.',
  'TRIP_WEATHER_PAUSED' => 'Chuyến đang tạm dừng do thời tiết.',
  'TRIP_ROUTE_UNAVAILABLE' => 'Tuyến đường hiện chưa cho phép khởi hành.',
  'TRIP_INSUFFICIENT_PARTICIPANTS' =>
    'Chưa đủ số khách đã xác nhận để khởi hành.',
  'TRIP_LIFECYCLE_INVALID_STATE' =>
    'Trạng thái chuyến đã thay đổi. Vui lòng tải lại.',
  _ => packageReasonLabel(code),
};

String lifecycleError(Object error) {
  if (error is! ApiException) {
    return 'Chưa thể cập nhật chuyến đi. Vui lòng thử lại.';
  }
  if (error.kind == ApiExceptionKind.network ||
      error.kind == ApiExceptionKind.timeout) {
    return 'Cần kết nối mạng để xác nhận. Hãy tải lại trạng thái trước khi thử lại.';
  }
  if (error.statusCode == 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  if (error.statusCode == 403 || error.statusCode == 404) {
    return 'Bạn không còn được phân công phụ trách chuyến này.';
  }
  final body = error.errorData;
  if (body is Map && body['code'] is String) {
    return lifecycleReason(body['code'] as String);
  }
  return 'Chưa thể cập nhật chuyến đi. Vui lòng tải lại và thử lại.';
}
