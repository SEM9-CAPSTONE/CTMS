import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/emergency_broadcasts/application/emergency_broadcasts_controller.dart';
import 'package:mobile/features/emergency_broadcasts/data/emergency_broadcast_seen_store.dart';
import 'package:mobile/features/emergency_broadcasts/data/emergency_broadcasts_api.dart';
import 'package:mobile/features/missed_alerts/missed_alerts_controller.dart';
import 'package:mobile/features/missed_alerts/missed_alerts_panel.dart';

class BroadcastApi implements EmergencyBroadcastsApi {
  @override
  Future<List<EmergencyBroadcast>> fetch(String tripId) async => [
    EmergencyBroadcast(
      id: 'one',
      tripId: tripId,
      alertType: 'other',
      content: 'Dừng tại điểm nghỉ.',
      createdAt: DateTime.utc(2026, 11, 17),
    ),
  ];
}

void main() {
  testWidgets(
    'keeps loading inline, shows an error and retry, and deduplicates the existing broadcast',
    (tester) async {
      final request = Completer<MissedAlertsPage>();
      var calls = 0;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            missedAlertsControllerProvider.overrideWith(
              (ref) => MissedAlertsController((_) {
                calls++;
                if (calls == 1) return request.future;
                return Future.value(
                  MissedAlertsPage({
                    'items': [
                      {
                        'source': 'broadcast',
                        'sourceId': 'one',
                        'dedupKey': 'broadcast:one',
                        'occurredAt': '2026-11-17T00:00:00Z',
                        'details': {'content': 'Dừng tại điểm nghỉ.'},
                      },
                    ],
                    'nextCursor': null,
                    'failedSources': [],
                  }),
                );
              }, const Stream.empty()),
            ),
            emergencyBroadcastsControllerProvider('trip').overrideWith(
              (ref) => EmergencyBroadcastsController(
                tripId: 'trip',
                api: BroadcastApi(),
                seenStore: InMemoryEmergencyBroadcastSeenStore(),
                connectivity: const Stream.empty(),
                refreshInterval: const Duration(hours: 1),
              ),
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(body: MissedAlertsPanel(tripId: 'trip')),
          ),
        ),
      );
      expect(find.text('Đang khôi phục cảnh báo…'), findsOneWidget);
      request.completeError(Exception('offline'));
      await tester.pumpAndSettle();
      expect(find.text('Chưa tải được cảnh báo.'), findsOneWidget);
      await tester.tap(find.text('Thử lại'));
      await tester.pumpAndSettle();
      expect(find.text('Dừng tại điểm nghỉ.'), findsNothing);
      expect(
        find.text(
          'Các cảnh báo khẩn của chuyến đã có trong danh sách phía trên.',
        ),
        findsNothing,
      );
      expect(find.text('Chưa đọc'), findsNothing);
      expect(find.text('Cảnh báo đã bỏ lỡ'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
