import 'dart:math';

import '../../gps_tracking/domain/gps_tracking_models.dart';
import 'checkpoint_arrival_models.dart';

/// Kết quả phát hiện một lượt đến điểm kiểm tra vừa được xác nhận.
class DetectedCheckpointArrival {
  const DetectedCheckpointArrival({
    required this.checkpoint,
    required this.samples,
    required this.detectedAt,
  });

  final RouteCheckpoint checkpoint;
  final List<GpsSample> samples;
  final DateTime detectedAt; // Lấy từ sample[2].capturedAt.toUtc()
}

/// Tính khoảng cách Haversine (R = 6,371,000m) làm tròn đến milimét (khớp 100% BE).
double calculateHaversineDistanceMeters({
  required double lat1,
  required double lon1,
  required double lat2,
  required double lon2,
}) {
  const radians = pi / 180.0;
  final dLat = (lat2 - lat1) * radians;
  final dLon = (lon2 - lon1) * radians;
  final haversine =
      pow(sin(dLat / 2), 2) +
      cos(lat1 * radians) * cos(lat2 * radians) * pow(sin(dLon / 2), 2);
  final rawDistance = 6371000.0 * 2.0 * asin(sqrt(min(1.0, haversine)));
  return (rawDistance * 1000.0).roundToDouble() / 1000.0;
}

/// On-device Checkpoint Arrival Detector (CTMS-061 / BR-239).
/// Quản lý bộ đếm riêng cho từng Checkpoint, bảo đảm quy tắc 3 mẫu VALID liên tiếp <=20m.
class CheckpointArrivalDetector {
  CheckpointArrivalDetector({
    required this.context,
    Set<String>? initialReachedCheckpointIds,
    this.checkedInAt,
  }) : _reachedCheckpointIds = {...?initialReachedCheckpointIds};

  final CheckpointArrivalContext context;
  final DateTime? checkedInAt;

  final Set<String> _reachedCheckpointIds;
  final Map<String, List<GpsSample>> _candidateSamples = {};
  final Map<String, double> _lastDistances = {};

  Set<String> get reachedCheckpointIds => Set.unmodifiable(_reachedCheckpointIds);
  double? lastDistanceTo(String checkpointId) => _lastDistances[checkpointId];
  int candidateCountFor(String checkpointId) =>
      _candidateSamples[checkpointId]?.length ?? 0;

  bool isReached(String checkpointId) => _reachedCheckpointIds.contains(checkpointId);

  /// Xử lý một mẫu GPS thô 10 giây từ phần cứng (Position.timestamp).
  /// Trả về danh sách các Checkpoint vừa đạt ngưỡng (thường là 0 hoặc 1).
  List<DetectedCheckpointArrival> onSample(GpsSample sample) {
    // 1. Kiểm tra điều kiện thời gian check-in của chuyến đi
    if (checkedInAt != null && sample.capturedAt.isBefore(checkedInAt!)) {
      return const [];
    }

    // 2. Kiểm tra tính hợp lệ của mẫu GPS (PB AC-2)
    final isGpsValid =
        sample.accuracyMeters >= 0 &&
        sample.accuracyMeters <= validSampleMaxAccuracyMeters &&
        sample.latitude.abs() <= 90.0 &&
        sample.longitude.abs() <= 180.0;

    final newlyReached = <DetectedCheckpointArrival>[];

    for (final cp in context.checkpoints) {
      // Nếu checkpoint đã được xác nhận đến trước đó -> bỏ qua vĩnh viễn (BR-239 / Immutability)
      if (_reachedCheckpointIds.contains(cp.id)) {
        continue;
      }

      final dist = calculateHaversineDistanceMeters(
        lat1: sample.latitude,
        lon1: sample.longitude,
        lat2: cp.latitude,
        lon2: cp.longitude,
      );
      _lastDistances[cp.id] = dist;

      // Nếu mẫu GPS không hợp lệ hoặc khoảng cách > 20m -> reset bộ đếm liên tiếp của checkpoint này
      if (!isGpsValid || dist > checkpointArrivalDistanceMeters) {
        _candidateSamples[cp.id]?.clear();
        continue;
      }

      final candidates = _candidateSamples.putIfAbsent(cp.id, () => []);

      // Kiểm tra chuỗi thời gian đối với các mẫu trước đó
      if (candidates.isNotEmpty) {
        final previous = candidates.last;
        final deltaMs = sample.capturedAt.difference(previous.capturedAt).inMilliseconds;

        // Timestamp phải tăng nghiêm ngặt, cách nhau từ 1s đến 180s
        if (deltaMs < 1000 || deltaMs > 180000) {
          candidates.clear();
          candidates.add(sample);
          continue;
        }

        // Tổng thời gian từ mẫu đầu tiên đến mẫu này không vượt quá 600s (10 phút)
        final totalSpanMs = sample.capturedAt.difference(candidates.first.capturedAt).inMilliseconds;
        if (totalSpanMs > 600000) {
          candidates.clear();
          candidates.add(sample);
          continue;
        }
      }

      candidates.add(sample);

      // Đạt đúng 3 mẫu liên tiếp -> Xác nhận CHECKPOINT_REACHED (PB AC-3)
      if (candidates.length == checkpointArrivalSampleCount) {
        _reachedCheckpointIds.add(cp.id);
        final confirmingSamples = List<GpsSample>.from(candidates);
        candidates.clear();

        newlyReached.add(
          DetectedCheckpointArrival(
            checkpoint: cp,
            samples: confirmingSamples,
            detectedAt: confirmingSamples.last.capturedAt.toUtc(),
          ),
        );
      }
    }

    return newlyReached;
  }
}

