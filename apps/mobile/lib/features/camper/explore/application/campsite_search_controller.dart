import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_exception.dart';
import '../data/campsite_search_repository.dart';
import '../domain/campsite_search_models.dart';

const _defaultPage = 1;
const _defaultLimit = 20;

/// CTMS-17-T02 (mobile). `status` is never part of this state or params --
/// search is always implicitly active-only, per CTMS-77's frozen contract
/// (see campsite_search_repository.dart). There is no field for it because
/// there is nothing for it to control -- and no permission/role logic
/// lives here either: `/camper/*` routing already gates this screen to
/// Camper accounts (app_router.dart's redirect, the mobile counterpart of
/// AppRoleGuard.tsx), before this controller is ever built.
class CampsiteSearchState {
  const CampsiteSearchState({
    this.provinceInput = '',
    this.cityInput = '',
    this.amenitiesInput = '',
    this.minPriceInput = '',
    this.maxPriceInput = '',
    this.items = const [],
    this.pagination = const CampsiteSearchPagination(
      page: _defaultPage,
      limit: _defaultLimit,
      total: 0,
      totalPages: 0,
    ),
    this.isLoading = true,
    this.errorMessage,
  });

  final String provinceInput;
  final String cityInput;
  final String amenitiesInput;
  final String minPriceInput;
  final String maxPriceInput;
  final List<CampsiteSearchItem> items;
  final CampsiteSearchPagination pagination;
  final bool isLoading;
  final String? errorMessage;

  CampsiteSearchState copyWith({
    String? provinceInput,
    String? cityInput,
    String? amenitiesInput,
    String? minPriceInput,
    String? maxPriceInput,
    List<CampsiteSearchItem>? items,
    CampsiteSearchPagination? pagination,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) {
    return CampsiteSearchState(
      provinceInput: provinceInput ?? this.provinceInput,
      cityInput: cityInput ?? this.cityInput,
      amenitiesInput: amenitiesInput ?? this.amenitiesInput,
      minPriceInput: minPriceInput ?? this.minPriceInput,
      maxPriceInput: maxPriceInput ?? this.maxPriceInput,
      items: items ?? this.items,
      pagination: pagination ?? this.pagination,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

List<String>? _parseAmenities(String rawInput) {
  final amenities = rawInput
      .split(',')
      .map((entry) => entry.trim())
      .where((entry) => entry.isNotEmpty)
      .toList();
  return amenities.isEmpty ? null : amenities;
}

double? _parsePrice(String rawInput) {
  final trimmed = rawInput.trim();
  if (trimmed.isEmpty) return null;
  return double.tryParse(trimmed); // null (not NaN) for anything unparsable -- omitted, never sent.
}

/// Maps `GET /campsites`' real response shapes (verified live against the
/// CTMS-77 backend during the Web implementation) to Vietnamese messages
/// by HTTP status, not exact message text -- the same reasoning as
/// campsites.utils.ts's mapCampsitesError. A 401/403 reaching here means
/// the session/role became invalid *during* use (expired, revoked,
/// deactivated) -- the "not logged in / wrong role yet" case is already
/// owned by app_router.dart's redirect before this screen ever mounts.
String _mapSearchError(Object error) {
  if (error is! ApiException) {
    return 'Không thể kết nối đến hệ thống. Vui lòng thử lại.';
  }
  switch (error.statusCode) {
    case 401:
      return 'Phiên đăng nhập đã hết hạn hoặc tài khoản không còn hoạt động. Vui lòng đăng nhập lại.';
    case 403:
      return 'Bạn không có quyền tìm kiếm campsite.';
    case 422:
      return 'Bộ lọc tìm kiếm không hợp lệ. Vui lòng kiểm tra lại.';
    default:
      return error.message.isNotEmpty ? error.message : 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
  }
}

class CampsiteSearchController extends Notifier<CampsiteSearchState> {
  CampsiteSearchParams _params = const CampsiteSearchParams(page: _defaultPage, limit: _defaultLimit);

  @override
  CampsiteSearchState build() {
    // Deferred to the next microtask -- `build()` must return synchronously,
    // and Riverpod forbids assigning `state` before that return completes.
    Future.microtask(() => _search(_params));
    return const CampsiteSearchState(); // isLoading: true by default -- the initial search is already in flight by the time any widget reads this.
  }

  /// BR-241: the actual guard. Dart/Riverpod has no equivalent of React's
  /// batched-state-update gap (Web's useCampsitesSearch needed a *second*,
  /// synchronous `requestInFlight` ref precisely because its `isLoading`
  /// state read inside a closure could be stale until the next render) --
  /// `state` here is always the true, immediately-current value, so a
  /// single `if (state.isLoading) return;` at the top of every
  /// user-triggered method is already a fully synchronous, race-proof
  /// guard by construction. Mirrors this codebase's own
  /// RegisterController.submit() precedent.
  Future<void> _search(CampsiteSearchParams params) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await ref.read(campsiteSearchRepositoryProvider).search(params);
      state = state.copyWith(items: response.items, pagination: response.pagination, isLoading: false);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: _mapSearchError(error));
    }
  }

  void setProvinceInput(String value) => state = state.copyWith(provinceInput: value);
  void setCityInput(String value) => state = state.copyWith(cityInput: value);
  void setAmenitiesInput(String value) => state = state.copyWith(amenitiesInput: value);
  void setMinPriceInput(String value) => state = state.copyWith(minPriceInput: value);
  void setMaxPriceInput(String value) => state = state.copyWith(maxPriceInput: value);

  void submitFilters() {
    if (state.isLoading) return;
    _params = CampsiteSearchParams(
      province: state.provinceInput.trim().isEmpty ? null : state.provinceInput.trim(),
      city: state.cityInput.trim().isEmpty ? null : state.cityInput.trim(),
      amenities: _parseAmenities(state.amenitiesInput),
      minPrice: _parsePrice(state.minPriceInput),
      maxPrice: _parsePrice(state.maxPriceInput),
      page: _defaultPage,
      limit: _defaultLimit,
    );
    unawaited(_search(_params));
  }

  void resetFilters() {
    if (state.isLoading) return;
    _params = const CampsiteSearchParams(page: _defaultPage, limit: _defaultLimit);
    state = state.copyWith(
      provinceInput: '',
      cityInput: '',
      amenitiesInput: '',
      minPriceInput: '',
      maxPriceInput: '',
    );
    unawaited(_search(_params));
  }

  void setPage(int page) {
    if (state.isLoading) return;
    _params = CampsiteSearchParams(
      province: _params.province,
      city: _params.city,
      amenities: _params.amenities,
      minPrice: _params.minPrice,
      maxPrice: _params.maxPrice,
      page: page,
      limit: _params.limit,
    );
    unawaited(_search(_params));
  }

  Future<void> reload() => _search(_params);
}

final campsiteSearchControllerProvider =
    NotifierProvider<CampsiteSearchController, CampsiteSearchState>(CampsiteSearchController.new);
