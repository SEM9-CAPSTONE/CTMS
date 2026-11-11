import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/route_recovery/application/recovery_controller.dart';
import 'package:mobile/features/route_recovery/data/recovery_api.dart';
import 'package:mobile/features/route_recovery/data/recovery_cache.dart';
import 'package:mobile/features/route_recovery/domain/recovery_state.dart';
import 'recovery_fixtures.dart';

class MemoryRecoveryCache implements RecoveryCache {
  final values = <String, String>{};
  @override
  Future<String?> read(String key) async => values[key];
  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }
}

class FakeRecoveryApi implements RecoveryApi {
  RecoveryEvidence evidence = RecoveryEvidence.available;
  Object? error;
  Completer<RecoveryConfirmation>? pending;
  int calls = 0;
  @override
  Future<RecoveryConfirmation> check(RecoveryBinding binding) async {
    calls++;
    if (error != null) throw error!;
    return pending?.future ??
        Future.value(RecoveryConfirmation(evidence, recoveryNow));
  }
}

class RecoveryInputs extends ChangeNotifier {
  RecoveryInput value = recoveryInput();
  void change(RecoveryInput next) {
    value = next;
    notifyListeners();
  }
}

void main() {
  late FakeRecoveryApi api;
  late MemoryRecoveryCache cache;
  late RecoveryInputs inputs;
  late RecoveryController controller;
  late DateTime now;
  Future<void> settle() async {
    await Future<void>.delayed(const Duration(milliseconds: 5));
  }

  RecoveryController create() => RecoveryController(
    tripId: 'trip',
    api: api,
    cache: cache,
    inputs: inputs,
    readInput: () => inputs.value,
    clock: () => now,
    autoStart: false,
  );
  setUp(() {
    api = FakeRecoveryApi();
    cache = MemoryRecoveryCache();
    inputs = RecoveryInputs();
    now = recoveryNow;
    controller = create();
  });
  tearDown(() {
    controller.dispose();
    inputs.dispose();
  });
  test(
    'sub-metre return hides guidance without changing detector state',
    () async {
      inputs.change(recoveryInput(latitude: .000001));
      controller.update();
      await settle();
      expect(controller.view.display, RecoveryDisplay.notOffRoute);
      expect(controller.view.target, isNull);
      expect(inputs.value.offRoute, isTrue);
    },
  );
  test(
    'legacy malformed fingerprint is missing route data, not identity mismatch',
    () {
      inputs.change(
        recoveryInput(
          context: recoveryContext(routeFingerprint: 'legacy-demo'),
        ),
      );
      controller.update();
      expect(controller.view.display, RecoveryDisplay.artifactInvalid);
      expect(controller.view.target, isNull);
      expect(api.calls, 0);
    },
  );
  test(
    'confirmed route guidance is read-only against detector/checkpoint inputs',
    () async {
      final before = inputs.value;
      controller.update();
      await settle();
      expect(controller.view.display, RecoveryDisplay.ready);
      expect(controller.view.target!.distanceMeters, closeTo(111.195, .1));
      expect(identical(inputs.value, before), isTrue);
      expect(inputs.value.offRoute, isTrue);
      expect(inputs.value.map.context!.checkpoints, isEmpty);
    },
  );
  test(
    'network timeout restores only exact previously confirmed package with offline label',
    () async {
      controller.update();
      await settle();
      api.error = ApiException('offline', kind: ApiExceptionKind.timeout);
      await controller.refresh();
      expect(controller.view.display, RecoveryDisplay.offlineReady);
      expect(controller.view.observedAt, recoveryNow);
    },
  );
  test('first-ever offline request is unverified and has no target', () async {
    api.error = ApiException('offline', kind: ApiExceptionKind.network);
    controller.update();
    await settle();
    expect(controller.view.display, RecoveryDisplay.unverified);
    expect(controller.view.target, isNull);
  });
  test('5xx does not become an offline success', () async {
    controller.update();
    await settle();
    api.error = ApiException(
      'server',
      statusCode: 503,
      kind: ApiExceptionKind.response,
    );
    await controller.refresh();
    expect(controller.view.display, RecoveryDisplay.serverError);
    expect(controller.view.target, isNull);
    api.error = ApiException('offline', kind: ApiExceptionKind.network);
    await controller.refresh();
    expect(controller.view.display, RecoveryDisplay.unverified);
  });
  for (final code in [401, 403, 404]) {
    test(
      '$code is sticky across recreation and network outage until fresh success',
      () async {
        controller.update();
        await settle();
        api.error = ApiException(
          'denied',
          statusCode: code,
          kind: ApiExceptionKind.response,
        );
        await controller.refresh();
        expect(controller.view.display, RecoveryDisplay.restricted);
        controller.dispose();
        controller = create();
        api.error = ApiException('offline', kind: ApiExceptionKind.network);
        controller.update();
        await settle();
        expect(controller.view.display, RecoveryDisplay.restricted);
        api.error = null;
        await controller.refresh();
        expect(controller.view.display, RecoveryDisplay.ready);
      },
    );
  }
  test(
    'STALE is hidden and cannot revive prior approval when offline',
    () async {
      controller.update();
      await settle();
      api.evidence = RecoveryEvidence.stale;
      await controller.refresh();
      expect(controller.view.display, RecoveryDisplay.staleRoute);
      expect(controller.view.target, isNull);
      api.error = ApiException('offline', kind: ApiExceptionKind.network);
      await controller.refresh();
      expect(controller.view.display, RecoveryDisplay.staleRoute);
    },
  );
  test(
    'switching package invalidates old target and ignores late response',
    () async {
      api.pending = Completer();
      final oldRequest = api.pending!;
      controller.update();
      api.pending = Completer();
      inputs.change(recoveryInput(context: recoveryContext(version: 2)));
      expect(controller.view.target, isNull);
      expect(controller.view.display, RecoveryDisplay.loading);
      oldRequest.complete(
        RecoveryConfirmation(RecoveryEvidence.available, recoveryNow),
      );
      await settle();
      expect(controller.view.display, RecoveryDisplay.loading);
      expect(controller.view.target, isNull);
      expect(
        cache.values.containsKey(RecoveryBinding(recoveryContext()).key),
        isFalse,
      );
      api.pending!.complete(
        RecoveryConfirmation(RecoveryEvidence.stale, recoveryNow),
      );
      await settle();
      expect(controller.view.display, RecoveryDisplay.staleRoute);
      expect(api.calls, 2);
    },
  );
  test(
    'package switch while offline never inherits other version approval',
    () async {
      controller.update();
      await settle();
      api.error = ApiException('offline', kind: ApiExceptionKind.network);
      inputs.change(recoveryInput(context: recoveryContext(version: 2)));
      await settle();
      expect(controller.view.display, RecoveryDisplay.unverified);
      expect(controller.view.target, isNull);
    },
  );
  test(
    'TTL refresh clears visible guidance and GPS ageing hides immediately',
    () async {
      controller.update();
      await settle();
      expect(api.calls, 1);
      now = now.add(const Duration(seconds: 31));
      controller.update();
      expect(controller.view.display, RecoveryDisplay.gpsStale);
      now = now.add(const Duration(seconds: 30));
      controller.update();
      await settle();
      expect(api.calls, 2);
    },
  );
  test(
    'stationary updates reuse computed target and never write source state',
    () async {
      controller.update();
      await settle();
      final target = controller.view.target;
      now = now.add(const Duration(seconds: 2));
      inputs.change(recoveryInput(at: now));
      expect(identical(controller.view.target, target), isTrue);
      expect(api.calls, 1);
    },
  );
}
