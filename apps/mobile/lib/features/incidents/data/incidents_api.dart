import 'dart:typed_data';
import 'package:dio/dio.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/trip_incident.dart';

abstract interface class IncidentsApi {
  Future<List<IncidentTrip>> assignedTrips();
  Future<List<IncidentJson>> list(String tripId);
  Future<IncidentJson> report(String tripId, IncidentJson payload);
  Future<IncidentJson> upload(String tripId, String id, Uint8List bytes);
}

class HttpIncidentsApi implements IncidentsApi {
  HttpIncidentsApi(this.client);
  final ApiClient client;
  @override
  Future<List<IncidentTrip>> assignedTrips() async {
    final response = await client.get<List<Object?>>(
      ApiEndpoints.trips.assigned,
    );
    return response.data!
        .map((v) => IncidentTrip.fromJson(Map<String, Object?>.from(v as Map)))
        .toList();
  }

  @override
  Future<List<IncidentJson>> list(String tripId) async {
    final response = await client.get<IncidentJson>(
      ApiEndpoints.trips.incidents(tripId),
    );
    return (response.data!['items'] as List)
        .map((v) => Map<String, Object?>.from(v as Map))
        .toList();
  }

  @override
  Future<IncidentJson> report(String tripId, IncidentJson payload) async {
    final response = await client.post<IncidentJson>(
      ApiEndpoints.trips.incidents(tripId),
      data: payload,
    );
    return Map<String, Object?>.from(response.data!['incident'] as Map);
  }

  @override
  Future<IncidentJson> upload(String tripId, String id, Uint8List bytes) async {
    final response = await client.put<IncidentJson>(
      ApiEndpoints.trips.incidentMedia(tripId, id),
      data: FormData.fromMap({
        'file': MultipartFile.fromBytes(bytes, filename: 'incident.jpg'),
      }),
    );
    return response.data!;
  }
}
