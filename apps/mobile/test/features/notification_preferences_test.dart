import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/notification_preferences/notification_preferences_api.dart';
import 'package:mobile/features/notification_preferences/notification_preferences_card.dart';
import 'package:mobile/features/notification_preferences/notification_preferences_controller.dart';

NotificationPreferences snapshot({int version = 0, bool booking = true}) =>
    NotificationPreferences({
      'version': version,
      'categories': [
        for (final (id, label, configurable) in [
          ('booking', 'Đặt chỗ', true),
          ('weather', 'Thời tiết', true),
          ('sos', 'Cứu trợ khẩn cấp', false),
          ('emergency', 'Cảnh báo khẩn của chuyến', false),
        ])
          {
            'category': id,
            'label': label,
            'configurable': configurable,
            'enabled': id == 'booking' ? booking : true,
            'effectiveEnabled': id == 'booking' ? booking : true,
            if (id == 'weather') 'mandatoryOverride': 'red_weather',
          },
      ],
    });

class FakeApi implements NotificationPreferencesApi {
  NotificationPreferences value = snapshot();
  Object? failure;
  Completer<NotificationPreferences>? pending;
  int writes = 0;
  Map<String, bool>? sent;
  bool disposed = false;
  @override
  Future<NotificationPreferences> load() async {
    if (pending != null) return pending!.future;
    if (failure != null) throw failure!;
    return value;
  }

  @override
  Future<NotificationPreferences> save(
    int version,
    Map<String, bool> changes,
  ) async {
    writes++;
    sent = changes;
    if (pending != null) return pending!.future;
    if (failure != null) throw failure!;
    return value = snapshot(
      version: version + 1,
      booking: changes['booking'] ?? true,
    );
  }

  @override
  void dispose() {
    disposed = true;
  }
}

void main() {
  Future<NotificationPreferencesController> setup(FakeApi api) async {
    final controller = NotificationPreferencesController(api);
    addTearDown(controller.dispose);
    await Future<void>.delayed(Duration.zero);
    return controller;
  }

  test('unchanged and locked categories never submit', () async {
    final api = FakeApi();
    final c = await setup(api);
    c.change(c.current!.categories[2], false);
    expect(await c.save(), PreferenceSaveResult.ignored);
    expect(api.writes, 0);
  });

  test('partial save uses confirmed snapshot and clears dirty draft', () async {
    final api = FakeApi();
    final c = await setup(api);
    c.change(c.current!.categories.first, false);
    expect(await c.save(), PreferenceSaveResult.saved);
    expect(api.sent, {'booking': false});
    expect(c.current!.version, 1);
    expect(c.dirty, false);
    expect(c.value(c.current!.categories.first), false);
  });

  test('duplicate save and toggle during write are ignored', () async {
    final api = FakeApi();
    final c = await setup(api);
    c.change(c.current!.categories.first, false);
    api.pending = Completer();
    final saving = c.save();
    c.change(c.current!.categories.first, true);
    expect(await c.save(), PreferenceSaveResult.ignored);
    expect(c.value(c.current!.categories.first), false);
    api.pending!.complete(snapshot(version: 1, booking: false));
    await saving;
    expect(api.writes, 1);
  });

  test(
    '409 requires reload, preserves draft and uses new version on explicit save',
    () async {
      final api = FakeApi();
      final c = await setup(api);
      c.change(c.current!.categories.first, false);
      api.failure = ApiException('technical error', statusCode: 409);
      expect(await c.save(), PreferenceSaveResult.failed);
      expect(c.needsReload, true);
      expect(await c.save(), PreferenceSaveResult.ignored);
      api.failure = null;
      api.value = snapshot(version: 3);
      await c.load();
      expect(c.value(c.current!.categories.first), false);
      expect(c.dirty, true);
      expect(c.current!.version, 3);
      expect(await c.save(), PreferenceSaveResult.saved);
      expect(c.current!.version, 4);
    },
  );

  test(
    'failed save retains draft and maps technical errors to Vietnamese',
    () async {
      final api = FakeApi();
      final c = await setup(api);
      c.change(c.current!.categories.first, false);
      api.failure = Exception('English internal error');
      await c.save();
      expect(c.dirty, true);
      expect(c.error, contains('Chưa lưu được'));
      expect(c.error, isNot(contains('English')));
    },
  );

  test('disposed account discards pending save response', () async {
    final api = FakeApi();
    final c = NotificationPreferencesController(api);
    await Future<void>.delayed(Duration.zero);
    c.change(c.current!.categories.first, false);
    api.pending = Completer();
    final request = c.save();
    c.dispose();
    api.pending!.complete(snapshot(version: 1, booking: false));
    expect(await request, PreferenceSaveResult.ignored);
    expect(api.disposed, true);
  });

  testWidgets(
    'locked types, weather exception and save action are accessible',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(440, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final api = FakeApi();
      final c = NotificationPreferencesController(api);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [notificationPreferencesProvider.overrideWith((ref) => c)],
          child: const MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(child: NotificationPreferencesCard()),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('thời tiết đỏ luôn'), findsOneWidget);
      final locked = tester.widget<SwitchListTile>(
        find.byKey(const ValueKey('preference-sos')),
      );
      expect(locked.value, true);
      expect(locked.onChanged, isNull);
      await tester.tap(find.byKey(const ValueKey('preference-booking')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Lưu tùy chọn'));
      await tester.pumpAndSettle();
      expect(find.text('Đã lưu cài đặt thông báo.'), findsOneWidget);
      expect(api.sent, {'booking': false});
    },
  );

  testWidgets('initial error shows retry with no fabricated switches', (
    tester,
  ) async {
    final api = FakeApi()..failure = Exception('offline');
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          notificationPreferencesProvider.overrideWith(
            (ref) => NotificationPreferencesController(api),
          ),
        ],
        child: const MaterialApp(
          home: Scaffold(body: NotificationPreferencesCard()),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(SwitchListTile), findsNothing);
    expect(find.text('Thử lại'), findsOneWidget);
    api.failure = null;
    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(find.byType(SwitchListTile), findsNWidgets(4));
  });
}
