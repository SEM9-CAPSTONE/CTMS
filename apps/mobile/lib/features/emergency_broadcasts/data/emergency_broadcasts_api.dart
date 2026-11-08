import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';

/// CTMS-081 alert types (API enum `emergency_alert_type`, spec §12).
const emergencyAlertTypeLabels = {
  'severe_weather': 'Thời tiết nguy hiểm',
  'evacuation': 'Sơ tán',
  'route_hazard': 'Nguy hiểm trên tuyến',
  'medical': 'Y tế',
  'security': 'An ninh',
  'other': 'Khác',
};

String emergencyAlertTypeLabel(String type) =>
    emergencyAlertTypeLabels[type] ?? 'Khẩn cấp';

/// One emergency alert the Host broadcast to a Trip (CTMS-361 `GET .../emergency-broadcasts`).
class EmergencyBroadcast {
  const EmergencyBroadcast({
    required this.id,
    required this.tripId,
    required this.alertType,
    required this.content,
    required this.createdAt,
  });

  factory EmergencyBroadcast.fromJson(Map<String, Object?> json) =>
      EmergencyBroadcast(
        id: json['id'] as String,
        tripId: json['tripId'] as String,
        alertType: json['alertType'] as String,
        content: json['content'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  final String id;
  final String tripId;
  final String alertType;
  final String content;
  final DateTime createdAt;
}

abstract interface class EmergencyBroadcastsApi {
  /// Broadcasts of the Trip that addressed the caller, newest first.
  Future<List<EmergencyBroadcast>> fetch(String tripId);
}

class HttpEmergencyBroadcastsApi implements EmergencyBroadcastsApi {
  HttpEmergencyBroadcastsApi(this.client);
  final ApiClient client;

  @override
  Future<List<EmergencyBroadcast>> fetch(String tripId) async {
    final response = await client.get<List<dynamic>>(
      ApiEndpoints.trips.emergencyBroadcasts(tripId),
    );
    return [
      for (final item in response.data ?? const [])
        EmergencyBroadcast.fromJson((item as Map).cast<String, Object?>()),
    ];
  }
}
