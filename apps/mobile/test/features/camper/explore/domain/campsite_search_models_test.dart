import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/camper/explore/domain/campsite_search_models.dart';

/// CTMS-17-T02 (mobile). Step 6 addition: the `fromJson` factories carry
/// real fallback/defaulting behaviour (missing keys, nulls) that the
/// repository test only exercises incidentally through one realistic
/// payload -- these tests pin that behaviour directly and precisely,
/// independent of any HTTP plumbing.
void main() {
  group('CampsiteLocation.fromJson', () {
    test('parses a fully-populated payload', () {
      final location = CampsiteLocation.fromJson({
        'province': 'Lam Dong',
        'city': 'Da Lat',
        'latitude': 11.940419,
        'longitude': 108.458313,
      });

      expect(location.province, 'Lam Dong');
      expect(location.city, 'Da Lat');
      expect(location.latitude, 11.940419);
      expect(location.longitude, 108.458313);
    });

    test('defaults missing/null fields instead of throwing', () {
      final location = CampsiteLocation.fromJson(const {});

      expect(location.province, '');
      expect(location.city, '');
      expect(location.latitude, 0);
      expect(location.longitude, 0);
    });

    test('accepts an integer latitude/longitude (num, not just double)', () {
      final location = CampsiteLocation.fromJson({
        'province': 'A',
        'city': 'B',
        'latitude': 12,
        'longitude': 108,
      });

      expect(location.latitude, 12.0);
      expect(location.longitude, 108.0);
    });
  });

  group('CampsiteSearchItem.fromJson', () {
    test('parses a fully-populated payload, including a non-empty activeRoutes', () {
      final item = CampsiteSearchItem.fromJson({
        'id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'name': 'Đà Lạt Pine Camp',
        'location': {
          'province': 'Lam Dong',
          'city': 'Da Lat',
          'latitude': 11.9,
          'longitude': 108.4,
        },
        'coverImage': 'https://example.com/cover.jpg',
        'activeRoutes': ['route-1', 'route-2'],
      });

      expect(item.id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(item.name, 'Đà Lạt Pine Camp');
      expect(item.location.city, 'Da Lat');
      expect(item.coverImage, 'https://example.com/cover.jpg');
      expect(item.activeRoutes, ['route-1', 'route-2']);
    });

    test('defaults id/name to "" and location/activeRoutes to empty when the keys are missing', () {
      final item = CampsiteSearchItem.fromJson(const {});

      expect(item.id, '');
      expect(item.name, '');
      expect(item.location.province, '');
      expect(item.coverImage, isNull);
      expect(item.activeRoutes, isEmpty);
    });
  });

  group('CampsiteSearchPagination.fromJson', () {
    test('parses a fully-populated payload', () {
      final pagination = CampsiteSearchPagination.fromJson({
        'page': 2,
        'limit': 10,
        'total': 37,
        'totalPages': 4,
      });

      expect(pagination.page, 2);
      expect(pagination.limit, 10);
      expect(pagination.total, 37);
      expect(pagination.totalPages, 4);
    });

    test('defaults missing fields to page=1, limit=20, total=0, totalPages=0', () {
      final pagination = CampsiteSearchPagination.fromJson(const {});

      expect(pagination.page, 1);
      expect(pagination.limit, 20);
      expect(pagination.total, 0);
      expect(pagination.totalPages, 0);
    });
  });

  group('PaginatedCampsiteSearchResponse.fromJson', () {
    test('parses a fully-populated payload end-to-end', () {
      final response = PaginatedCampsiteSearchResponse.fromJson({
        'items': [
          {
            'id': '1',
            'name': 'Camp A',
            'location': {'province': 'A', 'city': 'B', 'latitude': 1, 'longitude': 2},
            'coverImage': null,
            'activeRoutes': <String>[],
          },
        ],
        'pagination': {'page': 1, 'limit': 20, 'total': 1, 'totalPages': 1},
      });

      expect(response.items, hasLength(1));
      expect(response.items.single.name, 'Camp A');
      expect(response.pagination.total, 1);
    });

    test('defaults to an empty item list and default pagination when both keys are missing', () {
      final response = PaginatedCampsiteSearchResponse.fromJson(const {});

      expect(response.items, isEmpty);
      expect(response.pagination.page, 1);
      expect(response.pagination.total, 0);
    });
  });
}
