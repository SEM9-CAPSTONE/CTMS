import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/camper/explore/application/campsite_search_controller.dart'
    show fixedExploreProvince;
import 'package:mobile/features/camper/explore/data/campsite_search_repository.dart';
import 'package:mobile/features/camper/explore/domain/campsite_search_models.dart';
import 'package:mobile/features/camper/presentation/camper_explore_screen.dart';

const _emptyPage = PaginatedCampsiteSearchResponse(
  items: [],
  pagination: CampsiteSearchPagination(page: 1, limit: 20, total: 0, totalPages: 0),
);

CampsiteSearchItem _item(String id, String name) => CampsiteSearchItem(
  id: id,
  name: name,
  location: const CampsiteLocation(province: 'Lam Dong', latitude: 11.9, longitude: 108.4),
  coverImage: null,
  activeRoutes: const [],
);

/// Same recording double as campsite_search_controller_test.dart -- this
/// screen test's job is proving the *composition* (Step 5), not
/// re-deriving Step 3's controller-level guarantees, so it stays minimal.
class _RecordingCampsiteSearchRepository extends CampsiteSearchRepository {
  _RecordingCampsiteSearchRepository() : super(ApiClient(TokenStorage(const FlutterSecureStorage())));

  final List<CampsiteSearchParams> calls = [];

  /// When set, `search()` awaits this before returning -- used to hold the
  /// loading state open deterministically instead of racing a single
  /// `pump()` against however many microtask hops the real async chain
  /// happens to need (the same lesson CTMS-04-T03's `_pumpUntil` work
  /// already established: never guess a delay, control the state).
  Future<void>? gate;

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

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 200; i++) {
    await tester.pump(const Duration(milliseconds: 1));
  }
}

Widget _app(_RecordingCampsiteSearchRepository repository) {
  return ProviderScope(
    overrides: [campsiteSearchRepositoryProvider.overrideWithValue(repository)],
    child: const MaterialApp(home: CamperExploreScreen()),
  );
}

void main() {
  group('CamperExploreScreen', () {
    testWidgets(
      'fires the initial search with page=1, limit=20, province fixed to Đà Nẵng through the controller',
      (tester) async {
        final repository = _RecordingCampsiteSearchRepository();
        await tester.pumpWidget(_app(repository));
        await _settle(tester);

        expect(repository.calls, hasLength(1));
        expect(repository.calls.single.page, 1);
        expect(repository.calls.single.limit, 20);
        expect(repository.calls.single.province, fixedExploreProvince);
      },
    );

    testWidgets('shows the loading state while pending, not a stale success/empty view', (
      tester,
    ) async {
      var releaseGate = false;
      final repository = _RecordingCampsiteSearchRepository()
        ..gate = Future.doWhile(() async {
          await Future<void>.delayed(const Duration(milliseconds: 1));
          return !releaseGate;
        });
      await tester.pumpWidget(_app(repository));
      await tester.pump();

      expect(find.text('Đang tìm kiếm campsite...'), findsOneWidget);
      expect(find.text('Không tìm thấy campsite phù hợp'), findsNothing);

      releaseGate = true;
      await _settle(tester);
    });

    testWidgets('maps an error distinctly from an empty result -- never conflated', (tester) async {
      final repository = _RecordingCampsiteSearchRepository()
        ..failure = ApiException('boom', statusCode: 403);
      await tester.pumpWidget(_app(repository));
      await _settle(tester);

      expect(find.text('Bạn không có quyền tìm kiếm campsite.'), findsOneWidget);
      expect(find.text('Không tìm thấy campsite phù hợp'), findsNothing);
    });

    testWidgets('a genuinely empty result shows the empty state, not an error', (tester) async {
      final repository = _RecordingCampsiteSearchRepository()..response = _emptyPage;
      await tester.pumpWidget(_app(repository));
      await _settle(tester);

      expect(find.text('Không tìm thấy campsite phù hợp'), findsOneWidget);
    });

    testWidgets('renders CampsiteSearchItem data straight through to the card', (tester) async {
      final repository = _RecordingCampsiteSearchRepository()
        ..response = PaginatedCampsiteSearchResponse(
          items: [_item('1', 'Đà Lạt Pine Camp')],
          pagination: const CampsiteSearchPagination(page: 1, limit: 20, total: 1, totalPages: 1),
        );
      await tester.pumpWidget(_app(repository));
      await _settle(tester);

      expect(find.text('Đà Lạt Pine Camp'), findsOneWidget);
      expect(find.text('Lam Dong'), findsOneWidget);
      // No price UI on the card -- field fidelity itself is
      // CampsiteResultCard's own dedicated widget test's job (Step 4);
      // asserting "no text contains đ" here would be a false positive
      // against this screen's own "Giá đến" filter label.
    });

    testWidgets('submitting a filter fires exactly one additional search through the controller', (
      tester,
    ) async {
      final repository = _RecordingCampsiteSearchRepository();
      await tester.pumpWidget(_app(repository));
      await _settle(tester);

      await tester.enterText(find.byType(TextField).first, 'wifi');
      await tester.tap(find.text('Tìm kiếm'));
      await _settle(tester);

      expect(repository.calls, hasLength(2));
      expect(repository.calls.last.province, fixedExploreProvince);
      expect(repository.calls.last.amenities, ['wifi']);
    });

    testWidgets('paginating preserves the currently-submitted filter', (tester) async {
      final repository = _RecordingCampsiteSearchRepository()
        ..response = PaginatedCampsiteSearchResponse(
          items: [_item('1', 'Camp A')],
          pagination: const CampsiteSearchPagination(page: 1, limit: 20, total: 40, totalPages: 2),
        );
      await tester.pumpWidget(_app(repository));
      await _settle(tester);

      await tester.enterText(find.byType(TextField).first, 'wifi');
      await tester.tap(find.text('Tìm kiếm'));
      await _settle(tester);

      repository.response = PaginatedCampsiteSearchResponse(
        items: [_item('2', 'Camp B')],
        pagination: const CampsiteSearchPagination(page: 2, limit: 20, total: 40, totalPages: 2),
      );
      // The pagination bar is the last sliver, below the results grid --
      // scroll it into view (CustomScrollView only lays out what's near
      // the viewport) before tapping it. `scrollable` must point at the
      // CustomScrollView's own internal Scrollable specifically -- a bare
      // TextField also has its own internal Scrollable, so the plain
      // `find.byType(Scrollable).first` finder this codebase's
      // widget_test.dart normally uses would be ambiguous here.
      final scrollable = find
          .descendant(of: find.byType(CustomScrollView), matching: find.byType(Scrollable))
          .first;
      await tester.scrollUntilVisible(find.byTooltip('Trang sau'), 300, scrollable: scrollable);
      await tester.tap(find.byTooltip('Trang sau'));
      await _settle(tester);

      expect(repository.calls, hasLength(3));
      expect(repository.calls.last.province, fixedExploreProvince);
      expect(repository.calls.last.amenities, ['wifi']);
      expect(repository.calls.last.page, 2);
    });

    testWidgets('makes no calls beyond what the controller issues on its own', (tester) async {
      final repository = _RecordingCampsiteSearchRepository();
      await tester.pumpWidget(_app(repository));
      await _settle(tester);

      expect(repository.calls, hasLength(1));
      await _settle(tester); // idle -- nothing should fire on its own
      expect(repository.calls, hasLength(1));
    });
  });
}
