import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/emergency_broadcasts/application/emergency_broadcasts_controller.dart';
import 'package:mobile/features/emergency_broadcasts/data/emergency_broadcast_seen_store.dart';
import 'package:mobile/features/emergency_broadcasts/data/emergency_broadcasts_api.dart';
import 'package:mobile/features/emergency_broadcasts/presentation/emergency_broadcasts_panel.dart';

const tripId = '77777777-7777-4777-8777-777777777777';

EmergencyBroadcast broadcast(
  String id,
  String content, {
  String type = 'evacuation',
  int minute = 0,
}) => EmergencyBroadcast.fromJson({
  'id': id,
  'tripId': tripId,
  'hostId': 'host-1',
  'alertType': type,
  'content': content,
  'recipientCount': null,
  'createdAt': DateTime.utc(2026, 11, 8, 3, minute).toIso8601String(),
});

class FakeApi implements EmergencyBroadcastsApi {
  final List<Object> responses = [];
  int calls = 0;

  @override
  Future<List<EmergencyBroadcast>> fetch(String tripId) async {
    calls++;
    final next = responses.length > 1 ? responses.removeAt(0) : responses.first;
    if (next is Exception) throw next;
    return next as List<EmergencyBroadcast>;
  }
}

EmergencyBroadcastsController controller(
  FakeApi api,
  EmergencyBroadcastSeenStore store, {
  Duration interval = const Duration(hours: 1),
  Stream<List<ConnectivityResult>>? connectivity,
}) => EmergencyBroadcastsController(
  tripId: tripId,
  api: api,
  seenStore: store,
  refreshInterval: interval,
  connectivity: connectivity ?? const Stream.empty(),
);

Future<void> pumpPanel(
  WidgetTester tester,
  FakeApi api,
  EmergencyBroadcastSeenStore store,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        emergencyBroadcastsControllerProvider(
          tripId,
        ).overrideWith((ref) => controller(api, store)),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const Scaffold(
          body: SingleChildScrollView(
            child: EmergencyBroadcastsPanel(tripId: tripId),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('shows nothing while the Host has not broadcast anything', (
    tester,
  ) async {
    final api = FakeApi()..responses.add(<EmergencyBroadcast>[]);
    await pumpPanel(tester, api, InMemoryEmergencyBroadcastSeenStore());

    expect(find.byKey(const Key('emergency-broadcasts-panel')), findsNothing);
    expect(api.calls, 1);
  });

  testWidgets(
    'highlights the newest unseen alert and lists older ones, newest first',
    (tester) async {
      final api = FakeApi()
        ..responses.add([
          broadcast('b-1', 'Đường trơn, đi chậm.', type: 'route_hazard'),
          broadcast('b-2', 'Cả đoàn quay về điểm xuất phát.', minute: 30),
        ]);
      await pumpPanel(tester, api, InMemoryEmergencyBroadcastSeenStore());

      final banner = find.byKey(const Key('emergency-broadcast-unseen'));
      expect(banner, findsOneWidget);
      expect(
        find.descendant(
          of: banner,
          matching: find.text('Cả đoàn quay về điểm xuất phát.'),
        ),
        findsOneWidget,
      );
      expect(find.text('Cảnh báo khẩn từ Host · Sơ tán'), findsOneWidget);
      expect(find.text('Đã xem (2)'), findsOneWidget);
      expect(find.byKey(const Key('emergency-broadcast-b-1')), findsOneWidget);
      expect(find.text('Nguy hiểm trên tuyến'), findsOneWidget);
    },
  );

  testWidgets('"Đã xem" hides the banner and remembers it on this device', (
    tester,
  ) async {
    final store = InMemoryEmergencyBroadcastSeenStore();
    final api = FakeApi()..responses.add([broadcast('b-1', 'Dừng lại chờ.')]);
    await pumpPanel(tester, api, store);

    await tester.tap(find.text('Đã xem'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('emergency-broadcast-unseen')), findsNothing);
    expect(find.byKey(const Key('emergency-broadcasts-panel')), findsOneWidget);
    expect(await store.read(tripId), {'b-1'});

    await tester.pumpWidget(const SizedBox());
    await pumpPanel(tester, api, store);
    expect(find.byKey(const Key('emergency-broadcast-unseen')), findsNothing);
  });

  testWidgets('a failed refresh keeps the last list and says so', (
    tester,
  ) async {
    final api = FakeApi()
      ..responses.addAll([
        [broadcast('b-1', 'Mưa lớn sắp tới.')],
        ApiException('offline'),
      ]);
    final store = InMemoryEmergencyBroadcastSeenStore();
    late EmergencyBroadcastsController current;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          emergencyBroadcastsControllerProvider(tripId).overrideWith((ref) {
            current = controller(api, store);
            return current;
          }),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(
            body: SingleChildScrollView(
              child: EmergencyBroadcastsPanel(tripId: tripId),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await current.refresh();
    await tester.pumpAndSettle();

    expect(find.text('Mưa lớn sắp tới.'), findsWidgets);
    expect(find.byKey(const Key('emergency-broadcasts-stale')), findsOneWidget);
  });

  test('polls the server on its interval', () async {
    final network = StreamController<List<ConnectivityResult>>();
    final api = FakeApi()..responses.add(<EmergencyBroadcast>[]);
    final subject = controller(
      api,
      InMemoryEmergencyBroadcastSeenStore(),
      interval: const Duration(milliseconds: 20),
      connectivity: network.stream,
    );
    await Future<void>.delayed(const Duration(milliseconds: 70));
    expect(api.calls, greaterThanOrEqualTo(3));

    subject.dispose();
    await network.close();
  });

  test(
    'refreshes when connectivity is restored, not when it is lost',
    () async {
      final network = StreamController<List<ConnectivityResult>>();
      final api = FakeApi()..responses.add(<EmergencyBroadcast>[]);
      final subject = controller(
        api,
        InMemoryEmergencyBroadcastSeenStore(),
        connectivity: network.stream,
      );
      await Future<void>.delayed(Duration.zero);
      final initial = api.calls;
      network.add([ConnectivityResult.none]);
      await Future<void>.delayed(Duration.zero);
      expect(api.calls, initial);
      network.add([ConnectivityResult.wifi]);
      await Future<void>.delayed(Duration.zero);
      expect(api.calls, initial + 1);

      subject.dispose();
      await network.close();
    },
  );
}
