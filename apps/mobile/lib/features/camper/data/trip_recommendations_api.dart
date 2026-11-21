import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../core/api/api_exception.dart';
import '../../auth/application/auth_controller.dart';
import '../domain/trip_recommendation.dart';

/// The signed-in account. Watching it makes the providers below rebuild (and drop the previous
/// account's data) whenever the session changes.
final recommendationAccountProvider = Provider<String?>(
  (ref) => ref.watch(
    authControllerProvider.select((state) => state.asData?.value?.id),
  ),
);

class TripRecommendationsController
    extends AutoDisposeAsyncNotifier<TripRecommendations> {
  int _requestId = 0;

  @override
  Future<TripRecommendations> build() async {
    _requestId++;
    ref.onDispose(() => _requestId++);
    if (ref.watch(recommendationAccountProvider) == null) {
      throw StateError('Chưa đăng nhập');
    }
    final client = ref.watch(apiClientProvider);
    final response = await client.get<Map<String, Object?>>(
      ApiEndpoints.trips.recommendations,
    );
    return TripRecommendations.fromJson(response.data!);
  }

  Future<bool> regenerate() async {
    if (state.isLoading) return false;
    final account = ref.read(recommendationAccountProvider);
    if (account == null) return false;
    final requestId = ++_requestId;
    final client = ref.read(apiClientProvider);
    // Discard the old results while checking the current persisted consent/profile.
    state = const AsyncLoading();
    final result = await AsyncValue.guard(() async {
      final response = await client.post<Map<String, Object?>>(
        ApiEndpoints.trips.regenerateRecommendations,
      );
      return TripRecommendations.fromJson(response.data!);
    });
    if (requestId != _requestId) return false;
    state = result;
    ref.invalidate(tripRecommendationExplanationProvider);
    return result.valueOrNull?.needsHealthConsent == false && !result.hasError;
  }
}

final tripRecommendationsProvider =
    AutoDisposeAsyncNotifierProvider<
      TripRecommendationsController,
      TripRecommendations
    >(TripRecommendationsController.new);

/// Null when the Trip is not in the Camper's latest suggestions (404): nothing is shown then.
final tripRecommendationExplanationProvider = FutureProvider.autoDispose
    .family<TripRecommendationExplanation?, String>((ref, tripId) async {
      if (ref.watch(recommendationAccountProvider) == null) {
        throw StateError('Chưa đăng nhập');
      }
      final client = ref.watch(apiClientProvider);
      try {
        final response = await client.get<Map<String, Object?>>(
          ApiEndpoints.trips.recommendationExplanation(tripId),
        );
        return TripRecommendationExplanation.fromJson(response.data!);
      } on ApiException catch (error) {
        if (error.statusCode == 404) return null;
        rethrow;
      }
    });

final tripPreferencesProvider = FutureProvider.autoDispose<TripPreferences>((
  ref,
) async {
  if (ref.watch(recommendationAccountProvider) == null) {
    throw StateError('Chưa đăng nhập');
  }
  final client = ref.watch(apiClientProvider);
  final response = await client.get<Map<String, Object?>>(
    ApiEndpoints.trips.preferences,
  );
  return TripPreferences.fromJson(response.data!);
});

final tripPreferencesRepositoryProvider = Provider<TripPreferencesRepository>(
  (ref) => TripPreferencesRepository(ref.watch(apiClientProvider)),
);

class TripPreferencesRepository {
  const TripPreferencesRepository(this._client);

  final ApiClient _client;

  Future<TripPreferences> replace(TripPreferences preferences) async {
    final response = await _client.put<Map<String, Object?>>(
      ApiEndpoints.trips.preferences,
      data: preferences.toJson(),
    );
    return TripPreferences.fromJson(response.data!);
  }
}
