import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../domain/danger_zone_report.dart';

/// Lỗi GPS do ứng dụng xác định; [message] đã là câu tiếng Việt hiển thị được.
class ReportGpsException implements Exception {
  const ReportGpsException(this.message);
  final String message;

  @override
  String toString() => message;
}

typedef ReportGpsReader = Future<ReportJson> Function();
final reportGpsReaderProvider = Provider<ReportGpsReader>(
  (ref) => () async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const ReportGpsException('Hãy bật GPS để ghi nhận vị trí.');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw const ReportGpsException(
        'Hãy cấp quyền vị trí trong cài đặt ứng dụng rồi thử lại.',
      );
    }
    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 15),
      ),
    );
    if (!position.latitude.isFinite ||
        !position.longitude.isFinite ||
        !position.accuracy.isFinite ||
        position.accuracy < 0 ||
        DateTime.now().difference(position.timestamp).abs() >
            const Duration(seconds: 30)) {
      throw const ReportGpsException(
        'Chưa lấy được vị trí mới. Vui lòng thử lại GPS.',
      );
    }
    return {
      'latitude': position.latitude,
      'longitude': position.longitude,
      'accuracyMeters': position.accuracy,
      'capturedAt': position.timestamp.toUtc().toIso8601String(),
    };
  },
);
