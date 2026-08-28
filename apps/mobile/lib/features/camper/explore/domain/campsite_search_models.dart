/// CTMS-17-T02 (mobile). Mirrors CTMS-17-T01's frozen backend contract
/// exactly (services/api/src/modules/campsites/dto/*.ts), the same as the
/// Web implementation's types.ts -- no extra fields invented on either
/// side (no `status`, no date/guest-count/rating/safety-badge/price-map
/// fields from Figma Frame #21 -- those don't exist in the backend).
library;

class CampsiteSearchFilters {
  const CampsiteSearchFilters({this.province, this.amenities, this.minPrice, this.maxPrice});

  final String? province;

  /// Comma-separated or repeated on the wire; kept as a list in app state.
  final List<String>? amenities;
  final double? minPrice;
  final double? maxPrice;
}

class CampsiteSearchParams extends CampsiteSearchFilters {
  const CampsiteSearchParams({
    super.province,
    super.amenities,
    super.minPrice,
    super.maxPrice,
    required this.page,
    required this.limit,
  });

  final int page;
  final int limit;
}

class CampsiteLocation {
  const CampsiteLocation({required this.province, required this.latitude, required this.longitude});

  final String province;
  final double latitude;
  final double longitude;

  factory CampsiteLocation.fromJson(Map<String, dynamic> json) {
    return CampsiteLocation(
      province: json['province'] as String? ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0,
    );
  }
}

/// Matches CampsiteSearchItemDto -- no price field: BR-048/AC3 only
/// require name/location/coverImage/activeRoutes, price is a filter
/// input, not a display field.
class CampsiteSearchItem {
  const CampsiteSearchItem({
    required this.id,
    required this.name,
    required this.location,
    required this.coverImage,
    required this.activeRoutes,
  });

  final String id;
  final String name;
  final CampsiteLocation location;
  final String? coverImage;

  /// Always `[]` today -- Trekking Routes is a separate, unbuilt domain
  /// (see CampsiteSearchItemDto's DG-6 doc comment on the backend).
  final List<String> activeRoutes;

  factory CampsiteSearchItem.fromJson(Map<String, dynamic> json) {
    return CampsiteSearchItem(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      location: CampsiteLocation.fromJson(json['location'] as Map<String, dynamic>? ?? const {}),
      coverImage: json['coverImage'] as String?,
      activeRoutes: (json['activeRoutes'] as List<dynamic>? ?? const []).cast<String>(),
    );
  }
}

class CampsiteSearchPagination {
  const CampsiteSearchPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory CampsiteSearchPagination.fromJson(Map<String, dynamic> json) {
    return CampsiteSearchPagination(
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? 20,
      total: json['total'] as int? ?? 0,
      totalPages: json['totalPages'] as int? ?? 0,
    );
  }
}

class PaginatedCampsiteSearchResponse {
  const PaginatedCampsiteSearchResponse({required this.items, required this.pagination});

  final List<CampsiteSearchItem> items;
  final CampsiteSearchPagination pagination;

  factory PaginatedCampsiteSearchResponse.fromJson(Map<String, dynamic> json) {
    return PaginatedCampsiteSearchResponse(
      items: (json['items'] as List<dynamic>? ?? const [])
          .map((e) => CampsiteSearchItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      pagination: CampsiteSearchPagination.fromJson(
        json['pagination'] as Map<String, dynamic>? ?? const {},
      ),
    );
  }
}
