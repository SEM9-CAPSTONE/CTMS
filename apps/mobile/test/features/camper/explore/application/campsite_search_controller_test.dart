import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/camper/explore/application/campsite_search_controller.dart';
import 'package:mobile/features/camper/explore/data/campsite_search_repository.dart';
import 'package:mobile/features/camper/explore/domain/campsite_search_models.dart';

const _emptyPage = PaginatedCampsiteSearchResponse(
  items: [],
  pagination: CampsiteSearchPagination(page: 1, limit: 20, total: 0, totalPages: 0),
);

CampsiteSearchItem _item(String id, String name) => CampsiteSearchItem(
  id: id,
  name: name,
  location: const CampsiteLocation(province: 'Lam Dong', city: 'Da Lat', latitude: 11.9, longitude: 108.4),
  coverImage: null,
  activeRoutes: const [],
);

class _RecordingCampsiteSearchRepository extends CampsiteSearchRepository {
  _RecordingCampsiteSearchRepository() : super(ApiClient(TokenStorage(const FlutterSecureStorage())));

  final List<CampsiteSearchParams> calls = [];

  /// When set, `search()` awaits this before returning -- used to hold a
  /// call "in flight" for the BR-241 test.
  Future<void>? gate;

  /// One-shot: thrown once, then cleared, so a subsequent call (e.g. the
  /// "reload after error" test) succeeds without extra setup.
  Object? failure;

  PaginatedCampsiteSearchResponse response = _emptyPage;

  @override
  Future<PaginatedCampsiteSearchResponse> search(CampsiteSearchParams params) async {
    calls.add(params);
    if (gate != null) await gate;
    if (failure != null) {
      final err = failure!;
      failure = null;
      throw err;
    }
    return response;
  }
}

/// Polls actual controller state rather than a fixed delay -- the initial
/// search is scheduled via `Future.microtask` inside `build()`, and this
/// codebase's own established fix for exactly this kind of async-timing
/// gap (CTMS-04-T03's `_pumpUntil` helper) is to poll for real state,
/// never guess a delay long enough.
Future<void> _settle(ProviderContainer container) async {
  for (var i = 0; i < 200 && container.read(campsiteSearchControllerProvider).isLoading; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 1));
  }
}

void main() {
  group('CampsiteSearchController', () {
    test('fires an initial search with page=1, limit=20 and no status field', () async {
      final repository = _RecordingCampsiteSearchRepository();
      final container = ProviderContainer(
        overrides: [campsiteSearchRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      expect(container.read(campsiteSearchControllerProvider).isLoading, isTrue);
      await _settle(container);

      expect(repository.calls, hasLength(1));
      final params = repository.calls.single;
      expect(params.page, 1);
      expect(params.limit, 20);
      expect(params.province, isNull);
      expect(params.city, isNull);
      expect(params.amenities, isNull);
    });

    test('loading transitions to false once the search resolves', () async {
      final repository = _RecordingCampsiteSearchRepository();
      final container = ProviderContainer(
        overrides: [campsiteSearchRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await _settle(container);
      expect(container.read(campsiteSearchControllerProvider).isLoading, isFalse);
    });

    test('success populates items and pagination from the repository response', () async {
      final repository = _RecordingCampsiteSearchRepository()
        ..response = PaginatedCampsiteSearchResponse(
          items: [_item('1', 'Đà Lạt Pine Camp')],
          pagination: const CampsiteSearchPagination(page: 1, limit: 20, total: 1, totalPages: 1),
        );
      final container = ProviderContainer(
        overrides: [campsiteSearchRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await _settle(container);

      final state = container.read(campsiteSearchControllerProvider);
      expect(state.items, hasLength(1));
      expect(state.items.single.name, 'Đà Lạt Pine Camp');
      expect(state.pagination.total, 1);
      expect(state.errorMessage, isNull);
    });

    test('a genuinely empty result set is not treated as an error', () async {
      final repository = _RecordingCampsiteSearchRepository()..response = _emptyPage;
      final container = ProviderContainer(
        overrides: [campsiteSearchRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await _settle(container);

      final state = container.read(campsiteSearchControllerProvider);
      expect(state.items, isEmpty);
      expect(state.errorMessage, isNull);
    });

    test('maps 401/403/422 by status code, distinctly from each other', () async {
      for (final entry in {
        401: 'Phiên đăng nhập đã hết hạn hoặc tài khoản không còn hoạt động. Vui lòng đăng nhập lại.',
        403: 'Bạn không có quyền tìm kiếm campsite.',
        422: 'Bộ lọc tìm kiếm không hợp lệ. Vui lòng kiểm tra lại.',
      }.entries) {
        final repository = _RecordingCampsiteSearchRepository()
          ..failure = ApiException('boom', statusCode: entry.key);
        final container = ProviderContainer(
          overrides: [campsiteSearchRepositoryProvider.overrideWithValue(repository)],
        );
        addTearDown(container.dispose);

        await _settle(container);
        expect(container.read(campsiteSearchControllerProvider).errorMessage, entry.value);
      }
    });

    test('maps a non-ApiException (e.g. no network connection) to a generic Vietnamese message', () async {
      final repository = _RecordingCampsiteSearchRepository()
        ..failure = Exception('SocketException: Failed host lookup');
      final container = ProviderContainer(
        overrides: [campsiteSearchRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await _settle(container);

      expect(
        container.read(campsiteSearchControllerProvider).errorMessage,
        'Không thể kết nối đến hệ thống. Vui lòng thử lại.',
      );
    });

    test('an ApiException with an unmapped status code (e.g. 500) falls back to its own message', () async {
      final repository = _RecordingCampsiteSearchRepository()
        ..failure = ApiException('Internal server error', statusCode: 500);
      final container = ProviderContainer(
        overrides: [campsiteSearchRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await _settle(container);

      expect(
        container.read(campsiteSearchControllerProvider).errorMessage,
        'Internal server error',
      );
    });

    test('an ApiException with an unmapped status code and an empty message falls back to a generic one', () async {
      final repository = _RecordingCampsiteSearchRepository()
        ..failure = ApiException('', statusCode: 500);
      final container = ProviderContainer(
        overrides: [campsiteSearchRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await _settle(container);

      expect(
        container.read(campsiteSearchControllerProvider).errorMessage,
        'Không thể xử lý yêu cầu. Vui lòng thử lại.',
      );
    });

    test(
      'submitFilters trims input, drops empty amenities, parses price, resets to page 1',
      () async {
        final repository = _RecordingCampsiteSearchRepository();
        final container = ProviderContainer(
          overrides: [campsiteSearchRepositoryProvider.overrideWithValue(repository)],
        );
        addTearDown(container.dispose);
        await _settle(container);

        final controller = container.read(campsiteSearchControllerProvider.notifier);
        controller.setProvinceInput('  Lam Dong  ');
        controller.setCityInput('');
        controller.setAmenitiesInput('wifi, bbq ,, ');
        controller.setMinPriceInput('100');
        controller.setMaxPriceInput('not-a-number');
        controller.submitFilters();
        await _settle(container);

        expect(repository.calls, hasLength(2)); // initial + submit
        final params = repository.calls.last;
        expect(params.province, 'Lam Dong');
        expect(params.city, isNull);
        expect(params.amenities, ['wifi', 'bbq']);
        expect(params.minPrice, 100);
        expect(params.maxPrice, isNull); // invalid input -- omitted, never sent as NaN
        expect(params.page, 1);
      },
    );

    test('resetFilters clears input state and re-searches with no filters', () async {
      final repository = _RecordingCampsiteSearchRepository();
      final container = ProviderContainer(
        overrides: [campsiteSearchRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      await _settle(container);

      final controller = container.read(campsiteSearchControllerProvider.notifier);
      controller.setProvinceInput('Lam Dong');
      controller.submitFilters();
      await _settle(container);
      expect(repository.calls.last.province, 'Lam Dong');

      controller.resetFilters();
      await _settle(container);

      expect(repository.calls, hasLength(3)); // initial + submit + reset
      expect(repository.calls.last.province, isNull);
      expect(container.read(campsiteSearchControllerProvider).provinceInput, '');
    });

    test('setPage changes only the page, preserving the currently-submitted filters', () async {
      final repository = _RecordingCampsiteSearchRepository();
      final container = ProviderContainer(
        overrides: [campsiteSearchRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      await _settle(container);

      final controller = container.read(campsiteSearchControllerProvider.notifier);
      controller.setProvinceInput('Lam Dong');
      controller.submitFilters();
      await _settle(container);

      controller.setPage(2);
      await _settle(container);

      final params = repository.calls.last;
      expect(params.province, 'Lam Dong');
      expect(params.page, 2);
    });

    test(
      'BR-241: submitFilters()/setPage() called while a request is in flight are no-ops',
      () async {
        final repository = _RecordingCampsiteSearchRepository();
        var releaseGate = false;
        repository.gate = Future.doWhile(() async {
          await Future<void>.delayed(const Duration(milliseconds: 1));
          return !releaseGate;
        });

        final container = ProviderContainer(
          overrides: [campsiteSearchRepositoryProvider.overrideWithValue(repository)],
        );
        addTearDown(container.dispose);

        // Reading the provider triggers build(), which schedules the
        // initial search via Future.microtask -- it hasn't started yet.
        expect(container.read(campsiteSearchControllerProvider).isLoading, isTrue);
        expect(repository.calls, isEmpty);

        // The initial search (from build()) is now in flight and blocked on the gate.
        await Future<void>.delayed(Duration.zero);
        expect(repository.calls, hasLength(1));
        expect(container.read(campsiteSearchControllerProvider).isLoading, isTrue);

        final controller = container.read(campsiteSearchControllerProvider.notifier);
        controller.submitFilters();
        controller.setPage(2);

        // Still just the one call -- both were guarded no-ops.
        expect(repository.calls, hasLength(1));

        releaseGate = true;
        await _settle(container);

        // No queued call fired automatically once the guard released.
        expect(repository.calls, hasLength(1));
      },
    );

    test('a successful reload after an error clears errorMessage', () async {
      final repository = _RecordingCampsiteSearchRepository()
        ..failure = ApiException('boom', statusCode: 403);
      final container = ProviderContainer(
        overrides: [campsiteSearchRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      await _settle(container);
      expect(container.read(campsiteSearchControllerProvider).errorMessage, isNotNull);

      // `failure` was already consumed (one-shot) -- the next call succeeds.
      await container.read(campsiteSearchControllerProvider.notifier).reload();

      expect(container.read(campsiteSearchControllerProvider).errorMessage, isNull);
    });
  });
}
