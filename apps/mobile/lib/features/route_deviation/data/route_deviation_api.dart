import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/route_deviation_models.dart';

/// Per-event outcome of an upload: `accepted`, `duplicate` or `rejected` (BR-244).
class SafetyEventUploadResult {
  const SafetyEventUploadResult({required this.id, required this.status, this.reason});
  final String id;
  final String status;
  final String? reason;

  factory SafetyEventUploadResult.fromJson(Map<String, Object?> json) => SafetyEventUploadResult(
    id: json['id'] as String,
    status: json['status'] as String,
    reason: json['reason'] as String?,
  );
}

abstract interface class RouteDeviationApi {
  Future<RouteDeviationContext> context(String tripId);
  Future<List<SafetyEventUploadResult>> upload(String tripId, List<LocalSafetyEvent> events);
}

class HttpRouteDeviationApi implements RouteDeviationApi {
  HttpRouteDeviationApi(this.client);
  final ApiClient client;

  @override
  Future<RouteDeviationContext> context(String tripId) async {
    final response = await client.get<Map<String, Object?>>(
      ApiEndpoints.trips.routeDeviationContext(tripId),
    );
    return RouteDeviationContext.fromJson(response.data!);
  }

  @override
  Future<List<SafetyEventUploadResult>> upload(
    String tripId,
    List<LocalSafetyEvent> events,
  ) async {
    final response = await client.post<Map<String, Object?>>(
      ApiEndpoints.trips.safetyEvents(tripId),
      data: {'events': events.map((event) => event.toPayload()).toList()},
    );
    return (response.data!['results'] as List)
        .map((item) => SafetyEventUploadResult.fromJson(Map<String, Object?>.from(item as Map)))
        .toList();
  }
}
