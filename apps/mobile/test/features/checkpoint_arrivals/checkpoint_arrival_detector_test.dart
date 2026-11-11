import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/checkpoint_arrivals/domain/checkpoint_arrival_detector.dart';
import 'package:mobile/features/checkpoint_arrivals/domain/checkpoint_arrival_models.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';

void main() {
  const context = CheckpointArrivalContext(
    tripId: '11111111-1111-4111-8111-111111111111',
    routeId: '22222222-2222-4222-8222-222222222222',
    routeVersion: 'route-v1',
    packageId: '33333333-3333-4333-8333-333333333333',
    packageVersion: 'package-v1',
    checkpoints: [
      RouteCheckpoint(
        id: 'cp-01',
        name: 'Trạm 1 - Suối Mơ',
        latitude: 0.0,
        longitude: 0.0,
      ),
      RouteCheckpoint(
        id: 'cp-02',
        name: 'Trạm 2 - Đỉnh Gió',
        latitude: 0.001, // Cách cp-01 ~111m
        longitude: 0.0,
      ),
    ],
  );

  /// Chuyển đổi khoảng cách mét dọc theo kinh tuyến thành vĩ độ (khớp test helper BE).
  double latitudeForDistance(double distanceMeters) =>
      (distanceMeters / 6371000.0) * (180.0 / pi);

  GpsSample createSample({
    required double distanceMeters,
    required DateTime time,
    double accuracy = 15.0,
  }) => GpsSample(
    capturedAt: time,
    latitude: latitudeForDistance(distanceMeters),
    longitude: 0.0,
    accuracyMeters: accuracy,
  );

  group('Haversine Distance Metric & Shared BE Test Vectors', () {
    test('validates boundary distances: 19.99m and 20.0m pass, 20.001m fails (vector khớp BE)', () {
      final lat1999 = latitudeForDistance(19.99);
      final lat2000 = latitudeForDistance(20.0);
      final lat2001 = latitudeForDistance(20.001);

      final dist1999 = calculateHaversineDistanceMeters(lat1: lat1999, lon1: 0, lat2: 0, lon2: 0);
      final dist2000 = calculateHaversineDistanceMeters(lat1: lat2000, lon1: 0, lat2: 0, lon2: 0);
      final dist2001 = calculateHaversineDistanceMeters(lat1: lat2001, lon1: 0, lat2: 0, lon2: 0);

      expect(dist1999, equals(19.99));
      expect(dist1999 <= 20.0, isTrue);

      expect(dist2000, equals(20.0));
      expect(dist2000 <= 20.0, isTrue);

      expect(dist2001, equals(20.001));
      expect(dist2001 <= 20.0, isFalse);
    });
  });

  group('CheckpointArrivalDetector Detection Logic (BR-239 & PB AC-1..7)', () {
    late CheckpointArrivalDetector detector;
    final baseTime = DateTime.utc(2026, 10, 26, 8, 0, 0);

    setUp(() {
      detector = CheckpointArrivalDetector(context: context);
    });

    test('PB AC-3: confirms CHECKPOINT_REACHED after 3 consecutive VALID samples <= 20m', () {
      final s1 = createSample(distanceMeters: 18.0, time: baseTime);
      final s2 = createSample(distanceMeters: 19.0, time: baseTime.add(const Duration(seconds: 10)));
      final s3 = createSample(distanceMeters: 20.0, time: baseTime.add(const Duration(seconds: 20)));

      expect(detector.onSample(s1), isEmpty);
      expect(detector.candidateCountFor('cp-01'), equals(1));
      expect(detector.isReached('cp-01'), isFalse);

      expect(detector.onSample(s2), isEmpty);
      expect(detector.candidateCountFor('cp-01'), equals(2));
      expect(detector.isReached('cp-01'), isFalse);

      final reached = detector.onSample(s3);
      expect(reached, hasLength(1));
      expect(reached.first.checkpoint.id, equals('cp-01'));
      expect(reached.first.samples, hasLength(3));
      expect(reached.first.detectedAt, equals(s3.capturedAt.toUtc()));
      expect(detector.isReached('cp-01'), isTrue);
    });

    test('only 2 qualifying samples do not confirm reached', () {
      final s1 = createSample(distanceMeters: 15.0, time: baseTime);
      final s2 = createSample(distanceMeters: 18.0, time: baseTime.add(const Duration(seconds: 10)));

      detector.onSample(s1);
      final reached = detector.onSample(s2);

      expect(reached, isEmpty);
      expect(detector.isReached('cp-01'), isFalse);
      expect(detector.candidateCountFor('cp-01'), equals(2));
    });

    test('resets counter when a sample exceeds 20m threshold (18m, 21m, 18m)', () {
      final s1 = createSample(distanceMeters: 18.0, time: baseTime);
      final s2 = createSample(distanceMeters: 21.0, time: baseTime.add(const Duration(seconds: 10)));
      final s3 = createSample(distanceMeters: 18.0, time: baseTime.add(const Duration(seconds: 20)));

      detector.onSample(s1);
      expect(detector.candidateCountFor('cp-01'), equals(1));

      detector.onSample(s2);
      expect(detector.candidateCountFor('cp-01'), equals(0)); // Reset!

      detector.onSample(s3);
      expect(detector.candidateCountFor('cp-01'), equals(1)); // Start new count
      expect(detector.isReached('cp-01'), isFalse);
    });

    test('resets counter when GPS sample accuracy exceeds 20m (PB AC-2)', () {
      final s1 = createSample(distanceMeters: 15.0, time: baseTime, accuracy: 10.0);
      final s2Degraded = createSample(distanceMeters: 15.0, time: baseTime.add(const Duration(seconds: 10)), accuracy: 25.0);
      final s3 = createSample(distanceMeters: 15.0, time: baseTime.add(const Duration(seconds: 20)), accuracy: 10.0);

      detector.onSample(s1);
      expect(detector.candidateCountFor('cp-01'), equals(1));

      detector.onSample(s2Degraded);
      expect(detector.candidateCountFor('cp-01'), equals(0)); // Reset do accuracy > 20m

      detector.onSample(s3);
      expect(detector.candidateCountFor('cp-01'), equals(1));
      expect(detector.isReached('cp-01'), isFalse);
    });

    test('resets sequence when samples are closer than 1s or farther than 180s', () {
      final s1 = createSample(distanceMeters: 15.0, time: baseTime);
      // Quá gần: 500ms
      final s2TooClose = createSample(distanceMeters: 15.0, time: baseTime.add(const Duration(milliseconds: 500)));
      // Quá xa: 200s
      final s3TooFar = createSample(distanceMeters: 15.0, time: baseTime.add(const Duration(seconds: 200)));

      detector.onSample(s1);
      expect(detector.candidateCountFor('cp-01'), equals(1));

      detector.onSample(s2TooClose);
      expect(detector.candidateCountFor('cp-01'), equals(1)); // Sequence reset, start anew with s2

      detector.onSample(s3TooFar);
      expect(detector.candidateCountFor('cp-01'), equals(1)); // Sequence reset, start anew with s3
    });

    test('resets sequence when total span of 3 samples exceeds 600s (10 minutes)', () {
      final s1 = createSample(distanceMeters: 15.0, time: baseTime);
      final s2 = createSample(distanceMeters: 15.0, time: baseTime.add(const Duration(seconds: 150)));
      final s3TooLate = createSample(distanceMeters: 15.0, time: baseTime.add(const Duration(seconds: 650)));

      detector.onSample(s1);
      detector.onSample(s2);
      expect(detector.candidateCountFor('cp-01'), equals(2));

      detector.onSample(s3TooLate);
      expect(detector.candidateCountFor('cp-01'), equals(1)); // Reset and started over with s3
      expect(detector.isReached('cp-01'), isFalse);
    });

    test('maintains independent counters for different checkpoints', () {
      // sA cách cp-01 10m, nhưng cách cp-02 (~111m) hơn 20m
      final sA = createSample(distanceMeters: 10.0, time: baseTime);
      detector.onSample(sA);

      expect(detector.candidateCountFor('cp-01'), equals(1));
      expect(detector.candidateCountFor('cp-02'), equals(0));
    });

    test('can detect multiple adjacent checkpoints if both are within 20m radius', () {
      const adjacentContext = CheckpointArrivalContext(
        tripId: '11111111-1111-4111-8111-111111111111',
        routeId: '22222222-2222-4222-8222-222222222222',
        routeVersion: 'route-v1',
        packageId: '33333333-3333-4333-8333-333333333333',
        packageVersion: 'package-v1',
        checkpoints: [
          RouteCheckpoint(id: 'cp-near-1', latitude: 0.0, longitude: 0.0),
          RouteCheckpoint(id: 'cp-near-2', latitude: 0.0001, longitude: 0.0), // Cách ~11m
        ],
      );
      final adjacentDetector = CheckpointArrivalDetector(context: adjacentContext);

      // Điểm giữa: cách cp-near-1 5m và cách cp-near-2 6m (cả 2 đều <= 20m)
      final midLat = latitudeForDistance(5.0);
      final s1 = GpsSample(capturedAt: baseTime, latitude: midLat, longitude: 0, accuracyMeters: 10);
      final s2 = GpsSample(capturedAt: baseTime.add(const Duration(seconds: 10)), latitude: midLat, longitude: 0, accuracyMeters: 10);
      final s3 = GpsSample(capturedAt: baseTime.add(const Duration(seconds: 20)), latitude: midLat, longitude: 0, accuracyMeters: 10);

      adjacentDetector.onSample(s1);
      adjacentDetector.onSample(s2);
      final bothReached = adjacentDetector.onSample(s3);

      expect(bothReached, hasLength(2));
      expect(bothReached.map((e) => e.checkpoint.id), containsAll(['cp-near-1', 'cp-near-2']));
    });

    test('immutability: confirmed checkpoint never triggers again on subsequent samples', () {
      final s1 = createSample(distanceMeters: 15.0, time: baseTime);
      final s2 = createSample(distanceMeters: 15.0, time: baseTime.add(const Duration(seconds: 10)));
      final s3 = createSample(distanceMeters: 15.0, time: baseTime.add(const Duration(seconds: 20)));
      final s4 = createSample(distanceMeters: 15.0, time: baseTime.add(const Duration(seconds: 30)));

      detector.onSample(s1);
      detector.onSample(s2);
      final reachedFirst = detector.onSample(s3);
      expect(reachedFirst, hasLength(1));

      // Mẫu thứ 4 tiếp tục rơi vào bán kính 15m
      final reachedSecond = detector.onSample(s4);
      expect(reachedSecond, isEmpty); // Tuyệt đối không tạo lượt đến thứ hai!
    });

    test('restores reached checkpoints from persistence without re-detecting', () {
      final restoredDetector = CheckpointArrivalDetector(
        context: context,
        initialReachedCheckpointIds: {'cp-01'},
      );

      final s1 = createSample(distanceMeters: 15.0, time: baseTime);
      final s2 = createSample(distanceMeters: 15.0, time: baseTime.add(const Duration(seconds: 10)));
      final s3 = createSample(distanceMeters: 15.0, time: baseTime.add(const Duration(seconds: 20)));

      restoredDetector.onSample(s1);
      restoredDetector.onSample(s2);
      final result = restoredDetector.onSample(s3);

      expect(result, isEmpty);
      expect(restoredDetector.isReached('cp-01'), isTrue);
    });

    test('ignores samples before check-in time', () {
      final checkInTime = baseTime.add(const Duration(minutes: 5));
      final detectorWithCheckIn = CheckpointArrivalDetector(
        context: context,
        checkedInAt: checkInTime,
      );

      // Mẫu trước check-in: bị loại bỏ
      final preCheckInSample = createSample(distanceMeters: 10.0, time: baseTime);
      final result = detectorWithCheckIn.onSample(preCheckInSample);

      expect(result, isEmpty);
      expect(detectorWithCheckIn.candidateCountFor('cp-01'), equals(0));
    });
  });
}
