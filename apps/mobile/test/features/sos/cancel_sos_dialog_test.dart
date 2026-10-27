import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/sos/application/sos_controller.dart';
import 'package:mobile/features/sos/data/sos_api.dart';
import 'package:mobile/features/sos/domain/sos_alert.dart';
import 'package:mobile/features/sos/presentation/cancel_sos_dialog.dart';

class _FakeSosApi implements SosApi {
  String? cancelledReason;
  String? cancelledSosId;

  @override
  Future<List<SosAlert>> list(String tripId) async => [];

  @override
  Future<SosAlert> cancel(String tripId, String sosId, String reason) async {
    cancelledSosId = sosId;
    cancelledReason = reason;
    return SosAlert(
      id: sosId,
      tripId: tripId,
      senderId: 'sender-1',
      emergencyType: 'other',
      status: 'cancelled',
      eventTime: DateTime.now(),
      cancelledBy: 'sender-1',
      cancelledAt: DateTime.now(),
      cancellationReason: reason,
    );
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
    throw UnimplementedError();
  }
}

void main() {
  group('CancelSosDialog Widget', () {
    const tripId = 'a1736fee-62be-4991-9478-a62288e9b80a';
    late _FakeSosApi fakeApi;

    final sampleAlert = SosAlert(
      id: 'sos-1',
      tripId: tripId,
      senderId: 'sender-1',
      emergencyType: 'other',
      status: 'active',
      eventTime: DateTime.now(),
    );

    setUp(() {
      fakeApi = _FakeSosApi();
    });

    testWidgets('renders dialog header, quick chips, and reason input', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sosApiProvider.overrideWithValue(fakeApi),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: CancelSosDialog(tripId: tripId, alert: sampleAlert),
            ),
          ),
        ),
      );

      expect(find.text('HỦY BÁO ĐỘNG SOS'), findsOneWidget);
      expect(find.text('Cấn nút điện thoại khi chụp ảnh / xem bản đồ'), findsOneWidget);
      expect(find.text('Trượt tay bấm nhầm nút khẩn cấp'), findsOneWidget);
      expect(find.text('XÁC NHẬN HỦY SOS'), findsOneWidget);
    });

    testWidgets('tapping quick chip populates text field and submitting cancels SOS', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sosApiProvider.overrideWithValue(fakeApi),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: CancelSosDialog(tripId: tripId, alert: sampleAlert),
            ),
          ),
        ),
      );

      // Tap quick chip
      final chip = find.text('Trượt tay bấm nhầm nút khẩn cấp');
      await tester.tap(chip);
      await tester.pump();

      // Verify textfield now has that text
      expect(find.text('Trượt tay bấm nhầm nút khẩn cấp'), findsNWidgets(2)); // chip and textfield

      // Tap Confirm
      final confirmBtn = find.text('XÁC NHẬN HỦY SOS');
      await tester.ensureVisible(confirmBtn);
      await tester.tap(confirmBtn);
      await tester.pumpAndSettle();

      expect(fakeApi.cancelledSosId, 'sos-1');
      expect(fakeApi.cancelledReason, 'Trượt tay bấm nhầm nút khẩn cấp');
    });

    testWidgets('shows validation error when submitting with empty reason', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sosApiProvider.overrideWithValue(fakeApi),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: CancelSosDialog(tripId: tripId, alert: sampleAlert),
            ),
          ),
        ),
      );

      // Tap Confirm without entering text
      final confirmBtn = find.text('XÁC NHẬN HỦY SOS');
      await tester.ensureVisible(confirmBtn);
      await tester.tap(confirmBtn);
      await tester.pump();

      expect(find.text('Vui lòng cung cấp lý do hủy báo động'), findsOneWidget);
      expect(fakeApi.cancelledSosId, isNull);
    });
  });
}
