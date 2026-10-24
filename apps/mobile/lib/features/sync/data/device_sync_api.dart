import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';

abstract interface class DeviceSyncApi {
  Future<Map<String, Object?>> getStatus(String tripId);
}

class HttpDeviceSyncApi implements DeviceSyncApi {
  HttpDeviceSyncApi(this.client);
  final ApiClient client;

  @override
  Future<Map<String, Object?>> getStatus(String tripId) async {
    final response = await client.get<Map<String, Object?>>(
      ApiEndpoints.trips.deviceSyncStatus(tripId),
    );
    return response.data!;
  }
}
