import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/published_trip.dart';
import '../../auth/application/auth_controller.dart';

typedef ExploreTripsQuery = ({
  String search,
  String? tripType,
  String? difficulty,
  int page,
});

typedef ExploreTripsPage = ({
  List<PublishedTrip> items,
  int total,
  int totalPages,
});

final publishedTripDetailsProvider = FutureProvider.autoDispose
    .family<PublishedTrip, String>((ref, tripId) async {
      final account = ref.watch(
        authControllerProvider.select((state) => state.valueOrNull?.id),
      );
      var active = true;
      ref.onDispose(() {
        active = false;
      });
      final client = ref.watch(apiClientProvider);
      final response = await client.get<Map<String, Object?>>(
        ApiEndpoints.trips.getById(tripId),
        expectedUserId: account,
      );
      if (!active ||
          ref.read(authControllerProvider).valueOrNull?.id != account) {
        throw const FormatException('Phiên đăng nhập đã thay đổi.');
      }
      final trip = PublishedTrip.fromJson(
        response.data!,
        loadedForAccount: account,
      );
      if (trip.id != tripId) {
        throw const FormatException('Dữ liệu không khớp với chuyến đi.');
      }
      return trip;
    });

final exploreTripsProvider = FutureProvider.autoDispose
    .family<ExploreTripsPage, ExploreTripsQuery>((ref, query) async {
      final client = ref.watch(apiClientProvider);
      final response = await client.get<Map<String, Object?>>(
        ApiEndpoints.trips.getAll,
        queryParameters: {
          'page': query.page,
          if (query.search.isNotEmpty) 'search': query.search,
          if (query.tripType != null) 'tripType': query.tripType,
          if (query.difficulty != null) 'difficulty': query.difficulty,
        },
      );
      final data = response.data!;
      final items = data['items'] as List<Object?>;
      final pagination = data['pagination'] as Map<String, Object?>;
      return (
        items: items
            .map((item) => PublishedTrip.fromJson(item as Map<String, Object?>))
            .toList(),
        total: (pagination['total'] as num).toInt(),
        totalPages: (pagination['totalPages'] as num).toInt(),
      );
    });
