import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/operational_trip.dart';

abstract interface class TripOperationsApi {
  Future<List<OperationalTrip>> assigned(String accountId);
  Future<TripLifecycle> context(String accountId, String tripId);
  Future<TripLifecycle> transition(
    String accountId,
    String tripId, {
    required bool start,
  });
}

class HttpTripOperationsApi implements TripOperationsApi {
  HttpTripOperationsApi(this.client);
  final ApiClient client;

  @override
  Future<List<OperationalTrip>> assigned(String accountId) async {
    final response = await client.get<List<Object?>>(
      ApiEndpoints.trips.assigned,
      expectedUserId: accountId,
    );
    return response.data!
        .map(
          (item) =>
              OperationalTrip.fromJson(Map<String, Object?>.from(item as Map)),
        )
        .toList();
  }

  @override
  Future<TripLifecycle> context(String accountId, String tripId) async {
    final response = await client.get<Map<String, Object?>>(
      ApiEndpoints.trips.lifecycle(tripId),
      expectedUserId: accountId,
    );
    return TripLifecycle.fromJson(response.data!);
  }

  @override
  Future<TripLifecycle> transition(
    String accountId,
    String tripId, {
    required bool start,
  }) async {
    final response = await client.post<Map<String, Object?>>(
      start ? ApiEndpoints.trips.start(tripId) : ApiEndpoints.trips.end(tripId),
      expectedUserId: accountId,
    );
    return TripLifecycle.fromJson(response.data!);
  }
}

final tripOperationsApiProvider = Provider<TripOperationsApi>(
  (ref) => HttpTripOperationsApi(ref.watch(apiClientProvider)),
);
