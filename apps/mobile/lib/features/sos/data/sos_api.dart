import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/sos_alert.dart';

abstract interface class SosApi {
  Future<List<SosAlert>> list(String tripId);
  Future<SosAlert> cancel(String tripId, String sosId, String reason);
  Future<SosAlert> create(
    String tripId, {
    required String emergencyType,
    String? notes,
    double? latitude,
    double? longitude,
    int? batteryLevel,
  });
}

class HttpSosApi implements SosApi {
  const HttpSosApi(this.client);

  final ApiClient client;

  @override
  Future<List<SosAlert>> list(String tripId) async {
    final response = await client.get<dynamic>(
      ApiEndpoints.sos.tripSos(tripId),
    );
    final data = response.data;
    if (data is List) {
      return data
          .map((item) => SosAlert.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList();
    }
    return [];
  }

  @override
  Future<SosAlert> cancel(String tripId, String sosId, String reason) async {
    final response = await client.patch<dynamic>(
      ApiEndpoints.sos.cancel(tripId, sosId),
      data: {'reason': reason},
    );
    return SosAlert.fromJson(Map<String, dynamic>.from(response.data as Map));
  }

  @override
  Future<SosAlert> create(
    String tripId, {
    required String emergencyType,
    String? notes,
    double? latitude,
    double? longitude,
    int? batteryLevel,
  }) async {
    final body = <String, dynamic>{
      'emergencyType': emergencyType,
      if (notes != null) 'notes': notes,
      if (latitude != null && longitude != null)
        'location': {'latitude': latitude, 'longitude': longitude},
      if (batteryLevel != null) 'batteryLevel': batteryLevel,
    };

    final response = await client.post<dynamic>(
      ApiEndpoints.sos.tripSos(tripId),
      data: body,
    );
    return SosAlert.fromJson(Map<String, dynamic>.from(response.data as Map));
  }
}
