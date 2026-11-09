import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../domain/checkpoint_arrival_models.dart';

/// Kết quả phản hồi của từng bản ghi trong batch đồng bộ từ Server.
class CheckpointArrivalResultItem {
  const CheckpointArrivalResultItem({
    required this.id,
    required this.clientId,
    required this.status,
    required this.retryable,
    this.reason,
    this.visitId,
    this.receivedAt,
  });

  final String id;
  final String clientId;
  final String status; // 'accepted', 'duplicate', 'rejected'
  final bool retryable; // Mặc định true nếu server không gửi hoặc lỗi không xác định
  final CheckpointArrivalRejection? reason;
  final String? visitId;
  final DateTime? receivedAt;

  bool get isAccepted => status == 'accepted';
  bool get isDuplicate => status == 'duplicate';
  bool get isRejected => status == 'rejected';

  factory CheckpointArrivalResultItem.fromJson(Map<String, Object?> json) {
    // Nếu BE thiếu retryable, mặc định coi là true để bảo vệ dữ liệu (an toàn là trên hết)
    final rawRetryable = json['retryable'];
    final retryable = rawRetryable is bool ? rawRetryable : true;

    return CheckpointArrivalResultItem(
      id: (json['id'] as String?) ?? '',
      clientId: (json['clientId'] as String?) ?? (json['id'] as String? ?? ''),
      status: (json['status'] as String?) ?? 'rejected',
      retryable: retryable,
      reason: CheckpointArrivalRejection.fromWire(json['reason'] as String?),
      visitId: json['visitId'] as String?,
      receivedAt: json['receivedAt'] == null
          ? null
          : DateTime.tryParse(json['receivedAt'] as String),
    );
  }
}

/// DTO phản hồi cả lô từ Server.
class CheckpointArrivalSyncResponse {
  const CheckpointArrivalSyncResponse({required this.results});

  final List<CheckpointArrivalResultItem> results;

  factory CheckpointArrivalSyncResponse.fromJson(Map<String, Object?> json) {
    final list = json['results'] as List<dynamic>? ?? [];
    return CheckpointArrivalSyncResponse(
      results: [
        for (final item in list)
          CheckpointArrivalResultItem.fromJson(Map<String, Object?>.from(item as Map)),
      ],
    );
  }
}

/// Ngoại lệ khi Server trả về 409 (Chưa có package context đã ghim).
class CheckpointContextNotReadyException implements Exception {
  const CheckpointContextNotReadyException(this.message);
  final String message;
  @override
  String toString() => 'CheckpointContextNotReadyException: $message';
}

/// API Client gửi batch lượt đến lên server (POST /api/trips/:tripId/automatic-checkpoint-arrivals).
class CheckpointArrivalApi {
  CheckpointArrivalApi(this._client);

  final ApiClient _client;

  /// Đồng bộ một lô (tối đa 100 bản ghi) lên backend.
  Future<CheckpointArrivalSyncResponse> syncBatch({
    required String tripId,
    required List<LocalCheckpointArrival> arrivals,
  }) async {
    if (arrivals.isEmpty) {
      return const CheckpointArrivalSyncResponse(results: []);
    }

    final payload = {
      'arrivals': [for (final a in arrivals.take(checkpointArrivalBatchSize)) a.toServerPayload()],
    };

    try {
      final endpoint = '/trips/$tripId/automatic-checkpoint-arrivals';
      final response = await _client.post<Map<String, dynamic>>(
        endpoint,
        data: payload,
      );

      final data = response.data;
      if (data == null) {
        throw ApiException('Phản hồi rỗng từ máy chủ');
      }

      return CheckpointArrivalSyncResponse.fromJson(data);
    } on ApiException catch (e) {
      if (e.statusCode == 409) {
        throw const CheckpointContextNotReadyException(
          'Ngữ cảnh điểm kiểm tra chưa sẵn sàng trên máy chủ.',
        );
      }
      rethrow;
    }
  }
}
