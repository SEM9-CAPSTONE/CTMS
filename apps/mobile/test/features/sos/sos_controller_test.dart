import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/sos/application/sos_controller.dart';
import 'package:mobile/features/sos/data/sos_api.dart';
import 'package:mobile/features/sos/domain/sos_alert.dart';

class _MockSosApi implements SosApi {
  List<SosAlert> alerts = [];
  bool shouldThrow = false;
  String errorMessage = 'Lỗi kết nối';

  @override
  Future<List<SosAlert>> list(String tripId) async {
    if (shouldThrow) throw ApiException(errorMessage);
    return alerts;
  }

  @override
  Future<SosAlert> cancel(String tripId, String sosId, String reason) async {
    if (shouldThrow) throw ApiException(errorMessage);
    final alert = alerts.firstWhere((a) => a.id == sosId);
    final updated = SosAlert(
      id: alert.id,
      tripId: alert.tripId,
      senderId: alert.senderId,
      emergencyType: alert.emergencyType,
      status: 'cancelled',
      eventTime: alert.eventTime,
      cancelledBy: alert.senderId,
      cancelledAt: DateTime.now(),
      cancellationReason: reason,
    );
    alerts = alerts.map((a) => a.id == sosId ? updated : a).toList();
    return updated;
  }

  @override
  Future<SosAlert> create(
    String tripId, {
    required String emergencyType,
    String? notes,
    double? latitude,
    double? longitude,
    int? batteryLevel,
  }) async {
    if (shouldThrow) throw ApiException(errorMessage);
    final newAlert = SosAlert(
      id: 'new-sos',
      tripId: tripId,
      senderId: 'sender-1',
      emergencyType: emergencyType,
      status: 'active',
      eventTime: DateTime.now(),
      notes: notes,
    );
    alerts = [newAlert, ...alerts];
    return newAlert;
  }
}

void main() {
  group('SosController', () {
    const tripId = 'a1736fee-62be-4991-9478-a62288e9b80a';
    late _MockSosApi mockApi;
    late SosController controller;

    final sampleActive = SosAlert(
      id: 'sos-1',
      tripId: tripId,
      senderId: 'sender-1',
      emergencyType: 'medical',
      status: 'active',
      eventTime: DateTime.now(),
    );

    setUp(() {
      mockApi = _MockSosApi();
      mockApi.alerts = [sampleActive];
      controller = SosController(tripId: tripId, api: mockApi);
    });

    test('loads alerts and identifies active alert', () async {
      await controller.load();
      expect(controller.alerts.length, 1);
      expect(controller.activeAlert?.id, 'sos-1');
      expect(controller.activeAlert?.isActive, isTrue);
    });

    test('cancel validates empty reason', () async {
      await controller.load();
      final res = await controller.cancel(sosId: 'sos-1', reason: '   ');
      expect(res, isNull);
      expect(controller.error, 'Vui lòng nhập lý do hủy cảnh báo SOS');
      expect(controller.activeAlert?.id, 'sos-1'); // remains active
    });

    test('cancel validates reason longer than 500 characters', () async {
      await controller.load();
      final longReason = 'A' * 501;
      final res = await controller.cancel(sosId: 'sos-1', reason: longReason);
      expect(res, isNull);
      expect(controller.error, 'Lý do hủy không được vượt quá 500 ký tự');
    });

    test('cancel successfully transitions active SOS to cancelled', () async {
      await controller.load();
      final res = await controller.cancel(
        sosId: 'sos-1',
        reason: 'Cấn nút điện thoại',
      );
      expect(res, isNotNull);
      expect(res?.status, 'cancelled');
      expect(res?.cancellationReason, 'Cấn nút điện thoại');
      expect(controller.activeAlert, isNull); // no longer active
      expect(controller.alerts.first.isCancelled, isTrue);
    });

    test('surfaces error message when cancellation fails', () async {
      await controller.load();
      mockApi.shouldThrow = true;
      mockApi.errorMessage = 'Chỉ có thể hủy SOS khi đang ở trạng thái active';

      final res = await controller.cancel(
        sosId: 'sos-1',
        reason: 'Cấn nút điện thoại',
      );
      expect(res, isNull);
      expect(
        controller.error,
        'Chỉ có thể hủy SOS khi đang ở trạng thái active',
      );
    });
  });
}
