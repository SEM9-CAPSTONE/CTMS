import 'package:intl/intl.dart';

import '../../../core/api/api_exception.dart';

final _money = NumberFormat('#,###', 'vi_VN');
final _dateTime = DateFormat('HH:mm dd/MM/yyyy');

String formatVnd(double amount) => '${_money.format(amount.round())} đ';

String formatDateTime(DateTime value) => _dateTime.format(value.toLocal());

final _vietnamese = RegExp(r'[À-ỹđĐ]');

/// The API answers some errors in English. Keep Vietnamese server messages
/// (bank account checks, refund window...) and replace the rest with copy
/// the Camper understands.
String bookingErrorText(Object error, {String? fallback}) {
  if (error is ApiException) {
    final message = error.message.trim();
    if (error.kind != ApiExceptionKind.response) return message;
    if (_vietnamese.hasMatch(message)) return message;
    final lower = message.toLowerCase();
    if (lower.contains('not bookable') || lower.contains('seat') || lower.contains('capacity')) {
      return 'Chuyến đi đã hết chỗ hoặc đã đóng đăng ký.';
    }
    if (lower.contains('already') && lower.contains('booking')) {
      return 'Bạn đã có đơn đặt chỗ cho chuyến đi này. Xem lại trong tab Chuyến đi.';
    }
    if (lower.contains('not available') || lower.contains('insufficient') || lower.contains('stock')) {
      return 'Thiết bị không còn đủ số lượng. Vui lòng giảm số lượng hoặc chọn thiết bị khác.';
    }
    if (lower.contains('payable') || lower.contains('expired')) {
      return 'Đơn đặt chỗ đã hết hạn giữ chỗ hoặc không còn thanh toán được.';
    }
    return switch (error.statusCode) {
      401 => 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      403 => 'Bạn không có quyền thực hiện thao tác này.',
      404 => 'Không tìm thấy dữ liệu. Vui lòng tải lại.',
      409 => fallback ?? 'Thao tác không thực hiện được ở trạng thái hiện tại.',
      422 || 400 => 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
      _ => fallback ?? 'Đã xảy ra lỗi. Vui lòng thử lại.',
    };
  }
  return fallback ?? 'Đã xảy ra lỗi. Vui lòng thử lại.';
}
