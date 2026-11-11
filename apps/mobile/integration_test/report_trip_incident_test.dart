// Native E2E only: real application entry point, file queue, HTTP, and Postgres.
// Run both phases using scripts/run-incident-e2e.ps1. No provider/API/store mocks.
import 'dart:io' show pid;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/app.dart';
import 'package:mobile/main.dart' as app;
import 'package:mobile/core/env/env.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/application/auth_controller.dart';
import 'package:mobile/features/auth/data/auth_api.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/incidents/data/incident_store.dart';
import 'package:mobile/features/incidents/domain/trip_incident.dart';

const _directApi = String.fromEnvironment(
  'E2E_DIRECT_API',
  defaultValue: 'http://127.0.0.1:3002/api',
);
const _proxy = String.fromEnvironment(
  'E2E_PROXY',
  defaultValue: 'http://127.0.0.1:3003',
);

Future<void> waitFor(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 90),
}) async {
  final end = DateTime.now().add(timeout);
  while (finder.evaluate().isEmpty && DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 250));
  }
  expect(finder, findsWidgets);
}

int _instantMs(Object? value) =>
    DateTime.parse(value! as String).toUtc().millisecondsSinceEpoch;

Future<void> tap(WidgetTester tester, Finder finder) async {
  await waitFor(tester, finder);
  await tester.ensureVisible(finder.first);
  await tester.pump(const Duration(milliseconds: 300));
  await tester.tap(finder.first);
  await tester.pump(const Duration(milliseconds: 500));
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('CTMS49: offline incident persists and synchronizes once', (
    tester,
  ) async {
    final control = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
      ),
    );
    addTearDown(control.close);
    final response = await tester.runAsync(
      () => control.get<Map<String, Object?>>('$_proxy/__e2e/scenario'),
    );
    final scenario = response!.data!;
    final phase = scenario['phase'] as String;
    final fixture = Map<String, Object?>.from(scenario['fixture'] as Map);
    final tripId = fixture['tripId'] as String;
    final userId = fixture['porterId'] as String;
    final description = 'Native offline incident $tripId';
    // The runner reads these markers from logcat to compare both phases.
    debugPrint('CTMS49_PROCESS phase=$phase pid=$pid');
    final storage = TokenStorage(const FlutterSecureStorage());
    expect(
      Env.apiBaseUrl,
      '$_proxy/api',
      reason: 'The app must use the same proxy that the test controls.',
    );
    final health = await tester.runAsync(
      () => control.get<String>('$_proxy/__e2e/health'),
    );
    expect(
      health?.statusCode,
      200,
      reason:
          'The Android device cannot reach the test proxy. Check adb reverse.',
    );
    if (phase == 'capture') {
      // Authentication is fixture setup, not a login-screen regression test.
      // Use the real repository, HTTP API and secure storage without overrides.
      await tester.runAsync(() async {
        await storage.clear();
        final authClient = ApiClient(storage);
        try {
          final user = await AuthRepository(AuthApi(authClient), storage).login(
            identifier: fixture['porterEmail'] as String,
            password: fixture['password'] as String,
          );
          expect(user.id, userId);
        } finally {
          authClient.dio.close();
        }
      });
    } else {
      // A genuine restart: the runner force-stopped the capture process and
      // launched a new one, so this test must run in a different OS process.
      final previousPid = scenario['previousPid'] as int?;
      expect(previousPid, isNotNull, reason: 'Runner must pass the capture PID.');
      expect(
        pid,
        isNot(previousPid),
        reason: 'Recover must run in a new application process, not a rebuild.',
      );
      final cached = await tester.runAsync(storage.readCachedUser);
      expect(
        cached?.id,
        userId,
        reason:
            'Capture session was erased before recover. Do not uninstall between phases.',
      );
      final persisted = await tester.runAsync(
        () => FileIncidentStore(userId).read(),
      );
      expect(
        persisted?.where(
          (record) => record.payload['description'] == description,
        ),
        hasLength(1),
        reason:
            'The incident must survive the application process restart on disk.',
      );
    }
    app.main();
    await tester.pump();
    final container = ProviderScope.containerOf(
      tester.element(find.byType(CtmsApp)),
      listen: false,
    );
    final authDeadline = DateTime.now().add(const Duration(seconds: 40));
    while (container.read(authControllerProvider).valueOrNull == null &&
        DateTime.now().isBefore(authDeadline)) {
      final state = container.read(authControllerProvider);
      if (state.hasError) fail('Session restore failed: ${state.error}');
      await tester.pump(const Duration(milliseconds: 250));
    }
    expect(
      container.read(authControllerProvider).valueOrNull?.id,
      userId,
      reason: 'The app did not restore the real Porter session.',
    );
    await tap(tester, find.text('Thêm'));
    await tap(tester, find.text('Sự cố'));
    // Wait for the real cached/server assignment list before opening the selector.
    final dropdown = find.byType(DropdownButtonFormField<String>);
    await waitFor(tester, dropdown);
    final selector = find.descendant(
      of: dropdown,
      matching: find.byType(DropdownButton<String>),
    );
    final end = DateTime.now().add(const Duration(seconds: 60));
    while (tester.widget<DropdownButton<String>>(selector).items!.isEmpty &&
        DateTime.now().isBefore(end)) {
      await tester.pump(const Duration(milliseconds: 250));
    }
    await tap(tester, dropdown);
    await tap(tester, find.text(fixture['title'] as String).last);
    if (phase == 'capture') {
      await tester.runAsync(
        () => control.post<Object>(
          '$_proxy/__e2e/network',
          data: {'online': false},
        ),
      );
      await tap(tester, find.text('Báo cáo sự cố'));
      await waitFor(tester, find.byType(TextFormField));
      await tester.enterText(find.byType(TextFormField), description);
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pump();
      await tester.scrollUntilVisible(
        find.text('Lưu sự cố trên thiết bị'),
        250,
        scrollable: find.byType(Scrollable).last,
      );
      final saveButton = find.ancestor(
        of: find.text('Lưu sự cố trên thiết bị'),
        matching: find.byType(FilledButton),
      );
      final locationDeadline = DateTime.now().add(const Duration(seconds: 30));
      while (tester.widget<FilledButton>(saveButton).onPressed == null &&
          DateTime.now().isBefore(locationDeadline)) {
        await tester.pump(const Duration(milliseconds: 250));
      }
      expect(tester.widget<FilledButton>(saveButton).onPressed, isNotNull);
      await tap(tester, find.text('Lưu sự cố trên thiết bị'));
      await waitFor(tester, find.text('Chờ đồng bộ · Đã lưu trên thiết bị'));
      expect(find.text('Đã đồng bộ'), findsNothing);
      final local = await tester.runAsync(
        () => FileIncidentStore(userId).read(),
      );
      final record = local!.singleWhere(
        (v) => v.payload['description'] == description,
      );
      expect(record.syncState, IncidentSyncState.pending);
      debugPrint('CTMS49_INCIDENT phase=capture id=${record.id}');
      final token = await storage.readAccessToken();
      final response = await tester.runAsync(
        () => control.get<Map<String, Object?>>(
          '$_directApi/trips/$tripId/incidents',
          options: Options(headers: {'Authorization': 'Bearer $token'}),
        ),
      );
      expect(response!.data!['items'], isEmpty);
    } else {
      // This is a second native test process: no ProviderContainer or in-memory
      // queue survives from capture. The proxy remains offline until this point.
      await waitFor(tester, find.text('Chờ đồng bộ · Đã lưu trên thiết bị'));
      final local = await tester.runAsync(
        () => FileIncidentStore(userId).read(),
      );
      final original = local!.singleWhere(
        (v) => v.payload['description'] == description,
      );
      expect(original.syncState, IncidentSyncState.pending);
      debugPrint('CTMS49_INCIDENT phase=recover id=${original.id}');
      await tester.runAsync(
        () => control.post<Object>(
          '$_proxy/__e2e/network',
          data: {'online': true},
        ),
      );
      await tap(tester, find.byTooltip('Đồng bộ'));
      await waitFor(tester, find.text('Đã đồng bộ'));
      final token = await storage.readAccessToken();
      final headers = Options(headers: {'Authorization': 'Bearer $token'});
      final response = await tester.runAsync(
        () => control.get<Map<String, Object?>>(
          '$_directApi/trips/$tripId/incidents',
          options: headers,
        ),
      );
      final items = response!.data!['items'] as List;
      expect(items, hasLength(1));
      final authoritative = Map<String, Object?>.from(items.single as Map);
      expect(authoritative['id'], original.id);
      // The API serializes timestamps at millisecond precision; the device keeps
      // microseconds. Compare the same instant, not the string formatting.
      expect(
        _instantMs(authoritative['occurredAt']),
        _instantMs(original.payload['occurredAt']),
      );
      final serverLocation = Map<String, Object?>.from(
        authoritative['location']! as Map,
      );
      final localLocation = Map<String, Object?>.from(
        original.payload['location']! as Map,
      );
      for (final field in ['latitude', 'longitude', 'accuracyMeters']) {
        expect(
          (serverLocation[field]! as num).toDouble(),
          (localLocation[field]! as num).toDouble(),
          reason: 'location.$field must be preserved',
        );
      }
      expect(
        _instantMs(serverLocation['capturedAt']),
        _instantMs(localLocation['capturedAt']),
      );
      final replay = await tester.runAsync(
        () => control.post<Map<String, Object?>>(
          '$_directApi/trips/$tripId/incidents',
          data: original.payload,
          options: headers,
        ),
      );
      expect(replay!.data!['outcome'], 'duplicate');
      final confirmed = await tester.runAsync(
        () => control.get<Map<String, Object?>>(
          '$_directApi/trips/$tripId/incidents',
          options: headers,
        ),
      );
      expect(confirmed!.data!['items'], hasLength(1));
      final restored = await tester.runAsync(
        () => FileIncidentStore(userId).read(),
      );
      expect(
        restored!.singleWhere((v) => v.id == original.id).syncState,
        IncidentSyncState.synced,
      );
    }
  });
}
