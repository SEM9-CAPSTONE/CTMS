import 'package:intl/intl.dart';

class ReviewReputation {
  const ReviewReputation(this.ratingAverage, this.ratingCount);
  final num? ratingAverage;
  final int ratingCount;

  static ReviewReputation? fromJson(Object? value) {
    if (value is! Map) return null;
    final average = value['ratingAverage'];
    final count = value['ratingCount'];
    if (count is! int || count < 0) return null;
    if (average == null && count == 0) return const ReviewReputation(null, 0);
    if (average is! num ||
        !average.isFinite ||
        average < 1 ||
        average > 5 ||
        count == 0) {
      return null;
    }
    return ReviewReputation(average, count);
  }

  String get ratingLabel {
    final parts = ratingAverage.toString().split('.');
    final fraction = parts.length > 1 ? parts[1] : '';
    final tenths =
        int.parse(parts[0]) * 10 +
        (fraction.isEmpty ? 0 : int.parse(fraction[0])) +
        (fraction.length > 1 && int.parse(fraction[1]) >= 5 ? 1 : 0);
    return '${tenths ~/ 10},${tenths % 10}';
  }

  String get countLabel =>
      NumberFormat.decimalPattern('vi_VN').format(ratingCount);
  String get label => ratingAverage == null
      ? ReputationStrings.empty
      : '$ratingLabel/5 · $countLabel đánh giá';
  String get semantics => ratingAverage == null
      ? ReputationStrings.empty
      : 'Điểm uy tín $ratingLabel trên 5, $countLabel đánh giá';
}

abstract final class ReputationStrings {
  static const empty = 'Chưa có đánh giá';
  static const host = 'Chủ chuyến';
  static const missingName = 'Chưa cập nhật tên chủ chuyến';
  static const loading = 'Đang tải uy tín';
  static const failed = 'Chưa tải được uy tín.';
  static const stale = 'Chưa cập nhật';
  static const unavailable =
      'Nội dung không còn khả dụng hoặc bạn không còn quyền xem.';
  static const retry = 'Thử lại';
  static const refresh = 'Cập nhật uy tín';
}
