import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/gps_tracking/data/cached_gps_tracking_api.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';
import 'package:mobile/features/gps_tracking/application/gps_tracking_controller.dart';
import 'gps_fakes.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeGpsTrackingApi remote;
  late DateTime now;
  CachedGpsTrackingApi api([String user = 'camper']) =>
      CachedGpsTrackingApi(remote, user, clock: () => now);
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    now = DateTime.utc(2026, 11, 10, 10);
    remote = FakeGpsTrackingApi()
      ..contextResult = () => GpsTrackingContext(
        tripId: tripId,
        eligible: true,
        reason: null,
        participantRole: 'camper',
        samplingIntervalSeconds: 10,
        loggingIntervalSeconds: 30,
        configVersion: 'v3',
        startsAt: now.subtract(const Duration(hours: 1)),
        endsAt: now.add(const Duration(hours: 2)),
      );
  });

  test(
    'recreated offline controller samples and stores pending logs',
    () async {
      await api().context(tripId);
      remote.contextError = offline();
      remote.uploadError = offline();
      final location = FakeLocationSource()..next = sampleAt(now);
      final store = MemoryGpsLogStore();
      final controller = GpsTrackingController(
        tripId: tripId,
        api: api(),
        store: store,
        location: location,
        clock: () => now,
        autoStart: false,
      );
      addTearDown(controller.dispose);
      await controller.start();
      expect(controller.status, GpsTrackingStatus.active);
      expect(location.sampleCalls, 1);
      await controller.logBoundary();
      expect(controller.pendingCount, 1);
      expect((await store.read(tripId)).length, 1);
      expect(controller.isTracking, isTrue);
    },
  );

  test('never uses another account decision or an expired trip', () async {
    await api().context(tripId);
    remote.contextError = offline();
    await expectLater(
      api('other-user').context(tripId),
      throwsA(isA<ApiException>()),
    );
    now = now.add(const Duration(hours: 3));
    await expectLater(api().context(tripId), throwsA(isA<ApiException>()));
  });

  test(
    'authoritative denial clears cached approval and stops an active controller',
    () async {
      final controller = GpsTrackingController(
        tripId: tripId,
        api: api(),
        store: MemoryGpsLogStore(),
        location: FakeLocationSource()..next = sampleAt(now),
        clock: () => now,
        autoStart: false,
      );
      addTearDown(controller.dispose);
      await controller.start();
      remote.contextError = ApiException(
        'revoked',
        statusCode: 403,
        kind: ApiExceptionKind.response,
      );
      await controller.refreshEligibility();
      expect(controller.isTracking, isFalse);
      expect(controller.context, isNull);
      remote.contextError = offline();
      await expectLater(api().context(tripId), throwsA(isA<ApiException>()));
    },
  );

  test('fresh ineligible response replaces previous approval', () async {
    await api().context(tripId);
    remote.contextResult = () => trackingContext(eligible: false);
    expect((await api().context(tripId)).eligible, isFalse);
    remote.contextError = offline();
    await expectLater(api().context(tripId), throwsA(isA<ApiException>()));
  });
}
