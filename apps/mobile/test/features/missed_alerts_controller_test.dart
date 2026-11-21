import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/missed_alerts/missed_alerts_controller.dart';

Map<String, dynamic> alert(String key) => {
  'dedupKey': key,
  'source': key.split(':').first,
  'occurredAt': '2026-11-17T01:00:00Z',
  'details': <String, dynamic>{},
};
MissedAlertsPage page(
  List<String> keys, {
  String? next,
  List<String> failed = const [],
}) => MissedAlertsPage({
  'items': keys.map(alert).toList(),
  'nextCursor': next,
  'failedSources': failed,
});

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('retries a partial page without duplicating SOS transitions', (
    tester,
  ) async {
    final requests = <String?>[];
    final responses = [
      page(['sos:a'], next: 'second'),
      page(['sos:b'], failed: ['broadcast']),
      page(['sos:b', 'sos:c']),
    ];
    final controller = MissedAlertsController((cursor) async {
      requests.add(cursor);
      return responses.removeAt(0);
    }, const Stream.empty());
    addTearDown(controller.dispose);
    await tester.pump();
    await controller.loadMore();
    expect(controller.failed, isTrue);
    expect(controller.canLoadMore, isFalse);
    await controller.retry();
    expect(requests, [null, 'second', 'second']);
    expect(controller.items.map((item) => item.key), [
      'sos:a',
      'sos:b',
      'sos:c',
    ]);
    expect(controller.items.every((item) => !item.unread), isTrue);
  });

  testWidgets('expired cursor restarts while keeping displayed alerts', (
    tester,
  ) async {
    final requests = <String?>[];
    final controller = MissedAlertsController((cursor) async {
      requests.add(cursor);
      if (cursor != null) throw ApiException('expired', statusCode: 422);
      return requests.length == 1
          ? page(['sos:a'], next: 'expired')
          : page(['sos:b']);
    }, const Stream.empty());
    addTearDown(controller.dispose);
    await tester.pump();
    await controller.loadMore();
    expect(requests, [null, 'expired', null]);
    expect(controller.items.map((item) => item.key), ['sos:a', 'sos:b']);
  });

  testWidgets('stages new alerts on reconnect and clears revoked broadcasts', (
    tester,
  ) async {
    final network = StreamController<List<ConnectivityResult>>();
    var calls = 0;
    final controller = MissedAlertsController((_) async {
      calls++;
      return calls == 1
          ? page(['broadcast:a', 'sos:a'])
          : page(['sos:a', 'sos:b']);
    }, network.stream);
    addTearDown(() async {
      controller.dispose();
      await network.close();
    });
    await tester.pump();
    network.add([ConnectivityResult.none]);
    await tester.pump();
    network.add([ConnectivityResult.wifi]);
    await tester.pump();
    expect(controller.items.map((item) => item.key), ['sos:a']);
    expect(controller.hasNew, isTrue);
    controller.showNew();
    expect(controller.items.map((item) => item.key), ['sos:a', 'sos:b']);
    await controller.refresh();
    expect(calls, 2);
  });

  testWidgets(
    'drops in-flight results when the account controller is disposed',
    (tester) async {
      final request = Completer<MissedAlertsPage>();
      final controller = MissedAlertsController(
        (_) => request.future,
        const Stream.empty(),
      );
      controller.dispose();
      request.complete(page(['broadcast:a']));
      await tester.pump();
      expect(controller.items, isEmpty);
    },
  );
}
