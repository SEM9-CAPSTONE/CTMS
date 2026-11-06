import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/features/sos/data/sos_api.dart';
import 'package:mobile/features/sos/data/sos_store.dart';
import 'package:mobile/features/sos/domain/sos_alert.dart';
import 'package:mobile/features/sos/presentation/sos_active_screen.dart';
import 'package:mobile/features/sos/presentation/sos_safety_guidance_card.dart';

class _FakeSosApi implements SosApi {
  @override
  Future<List<SosAlert>> list(String tripId) async => [];
  @override
  Future<SosAlert> cancel(String tripId, String sosId, String reason) => throw UnimplementedError();
  @override
  Future<SosAlert> acknowledge(String tripId, String sosId) => throw UnimplementedError();
  @override
  Future<SosAlert> close(String tripId, String sosId, String resolutionNote) => throw UnimplementedError();
  @override
  Future<SosAlert> create(
    String tripId, {
    String? id,
    required String emergencyType,
    String? notes,
    double? latitude,
    double? longitude,
    int? batteryLevel,
    DateTime? eventTime,
  }) => throw UnimplementedError();
}

void main() {
  const tripId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  testWidgets('SosActiveScreen displays offline pending badge and immediate safety guidance (PB AC-3, BR-256)', (tester) async {
    final alert = SosAlert(
      id: 'sos-1234',
      tripId: tripId,
      senderId: 'user-1',
      emergencyType: 'medical',
      status: 'active',
      isLocalPending: true,
      eventTime: DateTime.parse('2026-10-27T08:00:00.000Z'),
      notes: 'Sốt cao, co giật',
    );

    final fakeStore = InMemorySosStore();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sosApiProvider.overrideWithValue(_FakeSosApi()),
          sosStoreProvider.overrideWithValue(fakeStore),
        ],
        child: MaterialApp(
          home: SosActiveScreen(
            tripId: tripId,
            alert: alert,
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    // Verify offline header and badge
    expect(find.text('TÍN HIỆU SOS ĐÃ LƯU TRÊN MÁY'), findsOneWidget);
    expect(find.text('Chờ đồng bộ ngoại tuyến'), findsOneWidget);

    // Verify immediate safety guidance card is rendered with first-aid steps
    expect(find.byType(SosSafetyGuidanceCard), findsOneWidget);
    expect(find.text('Hướng dẫn sơ cứu y tế khẩn cấp'), findsOneWidget);
    expect(find.textContaining('Kiểm tra nhịp thở và tri giác'), findsOneWidget);
  });

  testWidgets('SosActiveScreen displays natural hazard survival guidance when emergencyType is natural_hazard', (tester) async {
    final alert = SosAlert(
      id: 'sos-5678',
      tripId: tripId,
      senderId: 'user-1',
      emergencyType: 'natural_hazard',
      status: 'active',
      isLocalPending: false,
      eventTime: DateTime.now(),
    );

    final fakeStore = InMemorySosStore();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sosApiProvider.overrideWithValue(_FakeSosApi()),
          sosStoreProvider.overrideWithValue(fakeStore),
        ],
        child: MaterialApp(
          home: SosActiveScreen(
            tripId: tripId,
            alert: alert,
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('TÍN HIỆU SOS ĐANG PHÁT'), findsOneWidget);
    expect(find.byType(SosSafetyGuidanceCard), findsOneWidget);
    expect(find.text('Phòng tránh thiên tai, sạt lở & lũ quét'), findsOneWidget);
    expect(find.textContaining('Khẩn trương di chuyển lên vị trí đất cao'), findsOneWidget);
  });
}
