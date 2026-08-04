import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/porter_coverage_models.dart';

/// Districts and Host-managed campsites a Porter can declare coverage for
/// (Step 4 of `/register`). Backed by mock data until the Host/campsite
/// endpoints exist — every call is `async` and every consumer reads it
/// through the [FutureProvider]s below, so swapping [fetchDistricts] and
/// [fetchCampsitesInDistrict] for real `ApiClient` calls (e.g.
/// `GET /districts`, `GET /campsites?districtId=...`) is a one-file change;
/// nothing downstream (the dropdown, the multi-select, the Step 5 summary)
/// needs to know the data stopped being mocked.
class PorterCoverageRepository {
  const PorterCoverageRepository();

  // TODO(api): replace with ApiClient.get(ApiEndpoints.districts) once the
  // backend exposes it.
  Future<List<OperatingDistrict>> fetchDistricts() async {
    return _mockDistricts;
  }

  // TODO(api): replace with
  // ApiClient.get(ApiEndpoints.campsites, queryParameters: {'districtId': districtId})
  Future<List<PorterCampsiteOption>> fetchCampsitesInDistrict(String districtId) async {
    return _mockCampsites.where((option) => option.districtId == districtId).toList();
  }
}

final porterCoverageRepositoryProvider = Provider<PorterCoverageRepository>((ref) {
  return const PorterCoverageRepository();
});

final operatingDistrictsProvider = FutureProvider<List<OperatingDistrict>>((ref) {
  return ref.watch(porterCoverageRepositoryProvider).fetchDistricts();
});

/// Keyed by district id so picking a different district in the UI is just a
/// different provider instance — Riverpod handles the loading/error/data
/// states per key on its own.
final campsitesInDistrictProvider = FutureProvider.family<List<PorterCampsiteOption>, String>((
  ref,
  districtId,
) {
  return ref.watch(porterCoverageRepositoryProvider).fetchCampsitesInDistrict(districtId);
});

const _mockDistricts = [
  OperatingDistrict(id: 'ta-nang', name: 'Đức Trọng (Tà Năng), Lâm Đồng'),
  OperatingDistrict(id: 'da-lat', name: 'Đà Lạt, Lâm Đồng'),
  OperatingDistrict(id: 'sa-pa', name: 'Sa Pa, Lào Cai'),
  OperatingDistrict(id: 'ba-vi', name: 'Ba Vì, Hà Nội'),
];

// Sa Pa and Ba Vì are intentionally left without campsites — they exercise
// the "chưa có địa điểm" empty state.
const _mockCampsites = [
  PorterCampsiteOption(
    id: 'cs-bai-da-den',
    name: 'Bãi Đá Đen',
    districtId: 'ta-nang',
    hostName: 'Host Verdant Basecamp',
  ),
  PorterCampsiteOption(
    id: 'cs-dinh-ban-co',
    name: 'Đỉnh Bản Cờ',
    districtId: 'ta-nang',
    hostName: 'Host Verdant Basecamp',
  ),
  PorterCampsiteOption(
    id: 'cs-langbiang',
    name: 'LangBiang Basecamp',
    districtId: 'da-lat',
    hostName: 'Host Pine Ridge',
  ),
];
