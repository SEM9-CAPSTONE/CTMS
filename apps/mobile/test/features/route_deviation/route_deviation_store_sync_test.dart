import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/route_deviation/application/safety_event_sync.dart';
import 'package:mobile/features/route_deviation/data/route_deviation_store.dart';
import 'package:mobile/features/route_deviation/domain/route_deviation_models.dart';

import 'route_deviation_fakes.dart';

void main() {
  final now = DateTime.utc(2026, 10, 31, 3);

  group('LocalSafetyEvent payload', () {
    test('sends UTC timestamps with offset and omits absent context (BR-188)', () {
      final degraded = LocalSafetyEvent(
        id: '44444444-4444-4444-8444-444444444444',
        tripId: tripId,
        type: SafetyEventType.gpsDegraded,
        eventTime: DateTime.parse('2026-10-31T10:02:00+07:00'),
        noValidSampleSince: DateTime.parse('2026-10-31T10:00:00+07:00'),
        detectedOffline: true,
        routeVersion: 'route-v1',
        configVersion: 'v3',
      );
      expect(degraded.toPayload(), {
        'id': '44444444-4444-4444-8444-444444444444',
        'eventType': 'GPS_DEGRADED',
        'eventTime': '2026-10-31T03:02:00.000Z',
        'noValidSampleSince': '2026-10-31T03:00:00.000Z',
        'detectedOffline': true,
        'routeVersion': 'route-v1',
        'configVersion': 'v3',
      });
    });
  });

  group('FileRouteDeviationStore', () {
    late Directory root;
    setUp(() => root = Directory.systemTemp.createTempSync('ctms-route-'));
    tearDown(() => root.deleteSync(recursive: true));

    test('persists state, context and events together per account (BR-386)', () async {
      await FileRouteDeviationStore('user-a', root: root).update(
        tripId,
        (current) => current.copyWith(
          context: routeContext(),
          navigation: RouteNavigationState.offRoute,
          events: [offRouteEvent(now)],
        ),
      );

      final reloaded = await FileRouteDeviationStore('user-a', root: root).read(tripId);
      expect(reloaded.navigation, RouteNavigationState.offRoute);
      expect(reloaded.context?.routeVersion, 'route-v1');
      expect(reloaded.context?.coordinates, routeCoordinates);
      expect(reloaded.events.single.type, SafetyEventType.offRoute);
      expect(reloaded.events.single.distanceToRouteMeters, 65);
      expect((await FileRouteDeviationStore('user-b', root: root).read(tripId)).events, isEmpty);
    });

    test('serializes concurrent updates so no event is lost', () async {
      final store = FileRouteDeviationStore('user-a', root: root);
      await Future.wait([
        for (var i = 0; i < 20; i++)
          store.update(
            tripId,
            (current) => current.copyWith(
              events: [
                ...current.events,
                offRouteEvent(now, id: '33333333-3333-4333-8333-${i.toString().padLeft(12, '0')}'),
              ],
            ),
          ),
      ]);
      expect((await store.read(tripId)).events, hasLength(20));
    });

    test('rejects a malformed trip identity', () async {
      await expectLater(
        FileRouteDeviationStore('user-a', root: root).read('../escape'),
        throwsArgumentError,
      );
    });
  });

  group('synchronizeSafetyEvents', () {
    test('marks accepted/duplicate events synced and rejected ones failed with reason', () async {
      final store = MemoryRouteDeviationStore();
      final api = FakeRouteDeviationApi();
      final accepted = offRouteEvent(now, id: '00000000-0000-4000-8000-000000000001');
      final duplicate = offRouteEvent(now, id: '00000000-0000-4000-8000-000000000002');
      final rejected = offRouteEvent(now, id: '00000000-0000-4000-8000-000000000003');
      store.records[tripId] = RouteDeviationRecord(events: [accepted, duplicate, rejected]);
      api.outcomes[duplicate.id] = (status: 'duplicate', reason: null);
      api.outcomes[rejected.id] = (status: 'rejected', reason: 'ROUTE_VERSION_MISMATCH');

      final result = await synchronizeSafetyEvents(tripId: tripId, store: store, api: api, now: now);

      final byId = {for (final event in result.events) event.id: event};
      expect(byId[accepted.id]!.syncState, SafetyEventSyncState.synced);
      expect(byId[duplicate.id]!.syncState, SafetyEventSyncState.synced);
      expect(byId[rejected.id]!.syncState, SafetyEventSyncState.failed);
      expect(byId[rejected.id]!.rejectionReason, 'ROUTE_VERSION_MISMATCH');
    });

    test('keeps events pending with backoff while offline and retries when due (BR-245)', () async {
      final store = MemoryRouteDeviationStore();
      final api = FakeRouteDeviationApi()..uploadError = offline();
      store.records[tripId] = RouteDeviationRecord(events: [offRouteEvent(now)]);

      final first = await synchronizeSafetyEvents(tripId: tripId, store: store, api: api, now: now);
      expect(first.events.single.syncState, SafetyEventSyncState.pending);
      expect(first.events.single.nextAttemptAt, now.add(const Duration(seconds: 5)));

      api.uploadError = null;
      await synchronizeSafetyEvents(tripId: tripId, store: store, api: api, now: now);
      expect(api.uploads, hasLength(1), reason: 'not due yet');

      final later = await synchronizeSafetyEvents(
        tripId: tripId,
        store: store,
        api: api,
        now: now.add(const Duration(seconds: 6)),
      );
      expect(later.events.single.syncState, SafetyEventSyncState.synced);
    });

    test('fails events on a non-retryable error such as 422', () async {
      final store = MemoryRouteDeviationStore();
      final api = FakeRouteDeviationApi()..uploadError = httpError(422);
      store.records[tripId] = RouteDeviationRecord(events: [offRouteEvent(now)]);

      final result = await synchronizeSafetyEvents(tripId: tripId, store: store, api: api, now: now);
      expect(result.events.single.syncState, SafetyEventSyncState.failed);
    });

    test('keeps the navigation state when recording upload results', () async {
      final store = MemoryRouteDeviationStore();
      store.records[tripId] = RouteDeviationRecord(
        navigation: RouteNavigationState.offRoute,
        events: [offRouteEvent(now)],
      );
      final result = await synchronizeSafetyEvents(
        tripId: tripId,
        store: store,
        api: FakeRouteDeviationApi(),
        now: now,
      );
      expect(result.navigation, RouteNavigationState.offRoute);
    });
  });
}
