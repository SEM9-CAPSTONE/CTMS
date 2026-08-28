import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/api/api_endpoints.dart';
import '../domain/campsite_search_models.dart';

/// CTMS-17-T02 (mobile). Talks to CTMS-17-T01's frozen `GET /campsites`
/// contract directly (the Flutter counterpart of
/// apps/web/.../campsites.service.ts) -- real server-side `page`/`limit`,
/// no client-side pagination. `status` is never sent: the backend locks
/// search to `active` campsites structurally in the repository, not via
/// this input, so there is no legal value this client could send to widen
/// it. Errors are not caught here -- [ApiException] propagates unchanged
/// to whichever layer maps it (the controller), matching [ApiClient]'s own
/// convention.
class CampsiteSearchRepository {
  CampsiteSearchRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<PaginatedCampsiteSearchResponse> search(CampsiteSearchParams params) async {
    final queryParameters = <String, dynamic>{'page': params.page, 'limit': params.limit};

    if (params.province != null && params.province!.isNotEmpty) {
      queryParameters['province'] = params.province;
    }
    if (params.amenities != null && params.amenities!.isNotEmpty) {
      // Comma-separated is one of the two shapes SearchCampsitesQueryDto
      // accepts on the backend (toStringArray()) -- matches
      // campsites.service.ts's exact wire format.
      queryParameters['amenities'] = params.amenities!.join(',');
    }
    if (params.minPrice != null) {
      queryParameters['minPrice'] = params.minPrice;
    }
    if (params.maxPrice != null) {
      queryParameters['maxPrice'] = params.maxPrice;
    }

    final response = await _apiClient.get<Map<String, dynamic>>(
      ApiEndpoints.campsites.getAll,
      queryParameters: queryParameters,
    );

    return PaginatedCampsiteSearchResponse.fromJson(response.data ?? const {});
  }
}

final campsiteSearchRepositoryProvider = Provider<CampsiteSearchRepository>((ref) {
  return CampsiteSearchRepository(ref.watch(apiClientProvider));
});
