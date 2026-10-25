import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';

import 'gps_fakes.dart';

void main() {
  final boundary = DateTime.utc(2026, 10, 25, 1, 0, 30);
  const interval = Duration(seconds: 30);

  group('selectBoundarySample (BR-396)', () {
    test('uses the latest sample captured since the previous boundary', () {
      final sample = sampleAt(DateTime.utc(2026, 10, 25, 1, 0, 20));
      expect(
        selectBoundarySample(
          latest: sample,
          previousBoundary: DateTime.utc(2026, 10, 25, 1, 0, 0),
          boundary: boundary,
          loggingInterval: interval,
        ),
        same(sample),
      );
    });

    test('never re-logs a sample already older than the previous boundary', () {
      final stale = sampleAt(DateTime.utc(2026, 10, 25, 0, 59, 55));
      expect(
        selectBoundarySample(
          latest: stale,
          previousBoundary: DateTime.utc(2026, 10, 25, 1, 0, 0),
          boundary: boundary,
          loggingInterval: interval,
        ),
        isNull,
      );
    });

    test('uses one logging interval as the window for the first boundary', () {
      expect(
        selectBoundarySample(
          latest: sampleAt(DateTime.utc(2026, 10, 25, 0, 59, 50)),
          previousBoundary: null,
          boundary: boundary,
          loggingInterval: interval,
        ),
        isNull,
      );
      expect(
        selectBoundarySample(
          latest: sampleAt(DateTime.utc(2026, 10, 25, 1, 0, 5)),
          previousBoundary: null,
          boundary: boundary,
          loggingInterval: interval,
        ),
        isNotNull,
      );
    });

    test('returns null without any sample', () {
      expect(
        selectBoundarySample(
          latest: null,
          previousBoundary: null,
          boundary: boundary,
          loggingInterval: interval,
        ),
        isNull,
      );
    });
  });

  group('LocalGpsLog', () {
    test('keeps the capture time and context, and sends a UTC timestamp with offset (BR-188)', () {
      final log = LocalGpsLog.fromSample(
        id: newGpsLogId(),
        tripId: tripId,
        sample: sampleAt(DateTime.parse('2026-10-25T08:00:20+07:00')),
        configVersion: 'v3',
      );
      final payload = log.toPayload();
      expect(payload['eventTime'], '2026-10-25T01:00:20.000Z');
      expect(payload['configVersion'], 'v3');
      expect(payload['accuracyMeters'], 8);
      expect(payload['altitudeMeters'], 1100);
      expect(payload.containsKey('batteryLevel'), isFalse);
      expect(log.syncState, GpsLogSyncState.pending);
    });

    test('round-trips through local JSON', () {
      final log = LocalGpsLog.fromSample(
        id: newGpsLogId(),
        tripId: tripId,
        sample: sampleAt(DateTime.utc(2026, 10, 25, 1)),
        configVersion: 'v3',
      ).delivery(syncState: GpsLogSyncState.failed, rejectionReason: 'ID_CONFLICT', attempts: 2);
      final restored = LocalGpsLog.fromJson(log.toJson());
      expect(restored.id, log.id);
      expect(restored.eventTime, log.eventTime);
      expect(restored.syncState, GpsLogSyncState.failed);
      expect(restored.rejectionReason, 'ID_CONFLICT');
      expect(restored.attempts, 2);
    });

    test('generates distinct RFC 4122 v4 identities', () {
      final ids = {for (var i = 0; i < 200; i++) newGpsLogId()};
      expect(ids, hasLength(200));
      for (final id in ids) {
        expect(
          RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$').hasMatch(id),
          isTrue,
        );
      }
    });
  });
}
