import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/gps_tracking/application/gps_location_source.dart';
import 'package:mobile/features/gps_tracking/application/gps_tracking_controller.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';

import 'gps_fakes.dart';

void main() {
  late FakeGpsTrackingApi api;
  late MemoryGpsLogStore store;
  late FakeLocationSource location;
  late DateTime now;

  GpsTrackingController build() => GpsTrackingController(
    tripId: tripId,
    api: api,
    store: store,
    location: location,
    clock: () => now,
    autoStart: false,
  );

  setUp(() {
    api = FakeGpsTrackingApi();
    store = MemoryGpsLogStore();
    location = FakeLocationSource();
    now = DateTime.utc(2026, 10, 25, 1, 0, 0);
  });

  test('starts sampling only for an eligible participant with permission (BR-237)', () async {
    location.next = sampleAt(now);
    final controller = build();
    await controller.start();

    expect(controller.status, GpsTrackingStatus.active);
    expect(controller.isTracking, isTrue);
    expect(location.sampleCalls, 1, reason: 'first sample taken immediately');
    expect(controller.context!.samplingIntervalSeconds, 10);
    expect(controller.context!.loggingIntervalSeconds, 30);
    controller.dispose();
  });

  test('does not track when the server says the caller is not eligible', () async {
    api.contextResult = () => trackingContext(eligible: false, reason: 'TRIP_NOT_ONGOING');
    final controller = build();
    await controller.start();

    expect(controller.status, GpsTrackingStatus.notEligible);
    expect(controller.isTracking, isFalse);
    expect(location.sampleCalls, 0);
    controller.dispose();
  });

  test('does not track without location permission and starts after it is granted', () async {
    location
      ..permission = GpsPermissionState.denied
      ..afterRequest = GpsPermissionState.granted
      ..next = sampleAt(now);
    final controller = build();
    await controller.start();
    expect(controller.status, GpsTrackingStatus.permissionDenied);
    expect(controller.isTracking, isFalse);

    await controller.requestPermission();
    expect(controller.status, GpsTrackingStatus.active);
    expect(controller.isTracking, isTrue);
    controller.dispose();
  });

  test('logs the fresh sample at the boundary with its own capture time and config', () async {
    location.next = sampleAt(now.add(const Duration(seconds: 20)), latitude: 11.6);
    final controller = build();
    await controller.start();
    now = now.add(const Duration(seconds: 30));

    await controller.logBoundary();

    final log = controller.logs.single;
    expect(log.eventTime, DateTime.utc(2026, 10, 25, 1, 0, 20));
    expect(log.latitude, 11.6);
    expect(log.configVersion, 'v3');
    expect(log.syncState, GpsLogSyncState.synced, reason: 'uploaded right after persisting');
    expect(api.uploads.single.single.id, log.id);
    controller.dispose();
  });

  test('creates no log when there is no new sample, instead of copying the old one (BR-396)', () async {
    location.next = sampleAt(now.add(const Duration(seconds: 5)));
    final controller = build();
    await controller.start();
    now = now.add(const Duration(seconds: 30));
    await controller.logBoundary();
    expect(controller.logs, hasLength(1));

    // GPS loses the fix: later samples fail, the last sample stays old.
    location.sampleError = StateError('no fix');
    await controller.sampleNow();
    now = now.add(const Duration(seconds: 30));
    await controller.logBoundary();

    expect(controller.logs, hasLength(1));
    expect(controller.lastBoundarySkipped, isTrue);
    expect(controller.lastSampleFailureAt, isNotNull);
    controller.dispose();
  });

  test('keeps logs locally while offline and uploads them later', () async {
    location.next = sampleAt(now.add(const Duration(seconds: 10)));
    api.uploadError = offline();
    final controller = build();
    await controller.start();
    now = now.add(const Duration(seconds: 30));
    await controller.logBoundary();

    expect(controller.pendingCount, 1);
    expect((await store.read(tripId)).single.syncState, GpsLogSyncState.pending);

    api.uploadError = null;
    await controller.syncNow(force: true);
    expect(controller.pendingCount, 0);
    expect(controller.syncedCount, 1);
    controller.dispose();
  });

  test('stops when location permission is revoked while sampling', () async {
    location.next = sampleAt(now);
    final controller = build();
    await controller.start();

    location
      ..sampleError = StateError('denied')
      ..permission = GpsPermissionState.denied;
    await controller.sampleNow();

    expect(controller.status, GpsTrackingStatus.permissionDenied);
    expect(controller.isTracking, isFalse);
    now = now.add(const Duration(seconds: 30));
    await controller.logBoundary();
    expect(controller.logs, isEmpty);
    controller.dispose();
  });

  test('stops when a later eligibility check says the Trip is no longer trackable', () async {
    location.next = sampleAt(now);
    final controller = build();
    await controller.start();
    expect(controller.isTracking, isTrue);

    api.contextResult = () => trackingContext(eligible: false, reason: 'TRIP_NOT_ONGOING');
    await controller.refreshEligibility();

    expect(controller.status, GpsTrackingStatus.notEligible);
    expect(controller.isTracking, isFalse);
    controller.dispose();
  });

  test('keeps the last decision when a recheck fails offline, but needs one confirmation to start', () async {
    api.contextError = offline();
    final fresh = build();
    await fresh.start();
    expect(fresh.status, GpsTrackingStatus.unavailable);
    expect(fresh.isTracking, isFalse);
    fresh.dispose();

    api.contextError = null;
    location.next = sampleAt(now);
    final controller = build();
    await controller.start();
    api.contextError = offline();
    await controller.refreshEligibility();
    expect(controller.status, GpsTrackingStatus.active);
    expect(controller.isTracking, isTrue);
    controller.dispose();
  });

  test('loads previously buffered logs on start', () async {
    final existing = LocalGpsLog.fromSample(
      id: newGpsLogId(),
      tripId: tripId,
      sample: sampleAt(now.subtract(const Duration(minutes: 5))),
      configVersion: 'v3',
    );
    store.logs[tripId] = [existing];
    api.contextResult = () => trackingContext(eligible: false, reason: 'TRIP_NOT_ONGOING');
    final controller = build();
    await controller.start();
    expect(controller.logs.single.id, existing.id);
    expect(controller.pendingCount, 1);
    controller.dispose();
  });
}
