import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/core/widgets/ctms_scaffold.dart';
import 'package:mobile/features/camper_notifications/camper_notification_bell.dart';
import 'package:mobile/features/camper_notifications/camper_notifications_controller.dart';
import 'package:mobile/features/missed_alerts/missed_alerts_controller.dart';

final now = DateTime.utc(2026, 11, 20, 10);

Map<String, dynamic> broadcast(
  String id,
  Duration ago, {
  String content = 'Sương mù dày, cả đoàn dừng tại điểm nghỉ',
}) => {
  'source': 'broadcast',
  'sourceId': id,
  'dedupKey': 'broadcast:$id',
  'occurredAt': now.subtract(ago).toIso8601String(),
  'details': {
    'tripId': 't-1',
    'alertType': 'severe_weather',
    'content': content,
  },
};

Map<String, dynamic> sos(String id, String transition, Duration ago) => {
  'source': 'sos',
  'sourceId': id,
  'dedupKey': 'sos:$id',
  'occurredAt': now.subtract(ago).toIso8601String(),
  'details': {'sosId': 's-1', 'transition': transition},
};

MissedAlertsPage page(List<Map<String, dynamic>> items) => MissedAlertsPage({
  'items': items,
  'nextCursor': null,
  'failedSources': <String>[],
});

class MemoryStore implements BellSeenStore {
  DateTime? seenAt;

  @override
  Future<DateTime?> read(String accountId) async => seenAt;

  @override
  Future<void> write(String accountId, DateTime value) async => seenAt = value;
}

Future<CamperNotificationsController> pumpBell(
  WidgetTester tester, {
  required List<Map<String, dynamic>> Function() items,
  MemoryStore? store,
  Widget? screen,
}) async {
  late CamperNotificationsController controller;
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        camperNotificationsControllerProvider.overrideWith((ref) {
          controller = CamperNotificationsController(
            accountId: 'camper-1',
            fetch: (_) async => page(items()),
            store: store ?? MemoryStore(),
            interval: const Duration(seconds: 30),
            now: () => now,
          );
          return controller;
        }),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        builder: (context, child) => CamperNotificationBellScope(child: child!),
        home:
            screen ?? const CtmsScaffold(title: 'Chuyến đi', body: SizedBox()),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return controller;
}

void main() {
  testWidgets('the bell counts new Host alerts and lists them when opened', (
    tester,
  ) async {
    final store = MemoryStore()
      ..seenAt = now.subtract(const Duration(hours: 1));
    await pumpBell(
      tester,
      store: store,
      items: () => [
        broadcast('b-new', const Duration(minutes: 5)),
        broadcast(
          'b-old',
          const Duration(hours: 3),
          content: 'Đường trơn, đi chậm',
        ),
        sos('s-cancel', 'SOS_CANCELLED', const Duration(minutes: 2)),
      ],
    );

    // Only the broadcast after the last visit counts; the Camper's own SOS cancel never rings.
    expect(find.text('1'), findsOneWidget);

    await tester.tap(find.byTooltip('Thông báo'));
    await tester.pumpAndSettle();

    expect(find.text('Cảnh báo khẩn: Thời tiết nguy hiểm'), findsNWidgets(2));
    expect(
      find.text('Sương mù dày, cả đoàn dừng tại điểm nghỉ'),
      findsOneWidget,
    );
    expect(find.text('Đường trơn, đi chậm'), findsOneWidget);
    expect(find.text('Đã hủy yêu cầu cứu trợ'), findsOneWidget);
    expect(find.text('Mới'), findsOneWidget);
    expect(store.seenAt, now);

    Navigator.of(tester.element(find.text('Thông báo').first)).pop();
    await tester.pumpAndSettle();
    expect(find.text('1'), findsNothing);
  });

  testWidgets('a broadcast sent later shows up on the next refresh', (
    tester,
  ) async {
    final items = <Map<String, dynamic>>[];
    final controller = await pumpBell(
      tester,
      store: MemoryStore()..seenAt = now,
      items: () => items,
    );
    expect(find.text('1'), findsNothing);

    items.add(broadcast('b-1', const Duration(minutes: -1)));
    await tester.pump(const Duration(seconds: 30));
    await tester.pumpAndSettle();

    expect(controller.unreadCount, 1);
    expect(find.text('1'), findsOneWidget);
  });

  testWidgets('empty list explains there is nothing yet', (tester) async {
    await pumpBell(tester, items: () => []);
    await tester.tap(find.byTooltip('Thông báo'));
    await tester.pumpAndSettle();
    expect(
      find.text('Chưa có thông báo nào trong 24 giờ qua.'),
      findsOneWidget,
    );
  });

  testWidgets('a screen that wires its own bell keeps it', (tester) async {
    var tapped = false;
    await pumpBell(
      tester,
      items: () => [broadcast('b-1', const Duration(minutes: 1))],
      screen: CtmsScaffold(
        title: 'Porter',
        unreadNotifications: 4,
        onNotificationsTap: () => tapped = true,
        body: const SizedBox(),
      ),
    );
    expect(find.text('4'), findsOneWidget);
    await tester.tap(find.byTooltip('Thông báo'));
    await tester.pumpAndSettle();
    expect(tapped, isTrue);
    expect(find.text('Cảnh báo khẩn: Thời tiết nguy hiểm'), findsNothing);
  });

  testWidgets('without a Camper scope the bell stays as before', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: const CtmsScaffold(title: 'Porter', body: SizedBox()),
      ),
    );
    expect(find.byTooltip('Thông báo'), findsOneWidget);
    await tester.tap(find.byTooltip('Thông báo'));
    await tester.pumpAndSettle();
    expect(find.text('Thông báo'), findsNothing);
  });
}
