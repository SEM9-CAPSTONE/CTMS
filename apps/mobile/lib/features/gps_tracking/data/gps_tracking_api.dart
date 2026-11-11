import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/gps_tracking_models.dart';

/// Per-log outcome of an upload: `accepted`, `duplicate` or `rejected` (BR-244).
class GpsLogUploadResult {
  const GpsLogUploadResult({required this.id, required this.status, this.reason});
  final String id;
  final String status;
  final String? reason;

  factory GpsLogUploadResult.fromJson(Map<String, Object?> json) => GpsLogUploadResult(
    id: json['id'] as String,
    status: json['status'] as String,
    reason: json['reason'] as String?,
  );
}

abstract interface class GpsTrackingApi {
  Future<GpsTrackingContext> context(String tripId);
  Future<List<GpsLogUploadResult>> upload(String tripId, List<LocalGpsLog> logs);
}

class HttpGpsTrackingApi implements GpsTrackingApi {
  HttpGpsTrackingApi(this.client);
  final ApiClient client;

  @override
  Future<GpsTrackingContext> context(String tripId) async {
    final response = await client.get<Map<String, Object?>>(
      ApiEndpoints.trips.gpsTrackingContext(tripId),
    );
    return GpsTrackingContext.fromJson(response.data!);
  }

  @override
  Future<List<GpsLogUploadResult>> upload(String tripId, List<LocalGpsLog> logs) async {
    final response = await client.post<Map<String, Object?>>(
      ApiEndpoints.trips.gpsLogs(tripId),
      data: {'logs': logs.map((log) => log.toPayload()).toList()},
    );
    return (response.data!['results'] as List)
        .map((item) => GpsLogUploadResult.fromJson(Map<String, Object?>.from(item as Map)))
        .toList();
  }
}
