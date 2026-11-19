import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/camper/data/trip_recommendations_api.dart';
import 'package:mobile/features/camper/presentation/camper_explore_screen.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';

const _tripId = '6b1f2c4e-8d3a-4f7b-9c2e-1a5d7e9f0b3c';

Map<String, Object?> _trip({int remainingSeats = 7}) => {
  'id': _tripId,
  'title': 'Săn mây đỉnh Bà Nà',
  'description': 'Ngắm bình minh trên đỉnh Bà Nà.',
  'difficulty': 'hard',
  'startsAt': '2026-12-05T23:00:00.000Z',
  'endsAt': '2026-12-06T10:00:00.000Z',
  'bookingDeadline': '2026-12-03T10:00:00.000Z',
  'durationNights': 1,
  'pricePerPerson': 1850000,
  'remainingSeats': remainingSeats,
  'isBookable': remainingSeats > 0,
};

class _Adapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  final bodies = <Object?>[];
  int recommendationFailures = 0;
  int remainingSeats = 7;

  /// Until the Camper saves preferences the server has nothing to personalize.
  bool needsPreferences = false;

  int get recommendationCalls =>
      requests.where((r) => r.uri.path == '/api/trip-recommendations').length;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    if (options.method == 'PUT') needsPreferences = false;
    bodies.add(options.data);
    final path = options.uri.path;
    if (path == '/api/trip-recommendations' && recommendationFailures > 0) {
      recommendationFailures--;
      return ResponseBody.fromString(
        jsonEncode({'message': 'Internal server error'}),
        500,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );
    }
    final preferences = {
      'tripTypes': ['overnight'],
      'difficulties': <String>[],
      'regions': <String>[],
      'minPrice': null,
      'maxPrice': 2000000,
      'updatedAt': null,
      'regionOptions': [
        {'code': 'ba_na_hoa_vang', 'label': 'Bà Nà – Hòa Vang'},
        {'code': 'hai_van_lien_chieu', 'label': 'Hải Vân – Liên Chiểu'},
      ],
    };
    final data = switch (path) {
      '/api/trip-recommendations' when needsPreferences => <String, Object?>{
        'status': 'needs_preferences',
        'items': <Object?>[],
        'generatedAt': '2026-11-14T03:00:00.000Z',
        'mode': null,
      },
      '/api/trip-recommendations' => <String, Object?>{
        'status': 'ready',
        'items': [
          {
            'trip': _trip(remainingSeats: remainingSeats),
            'reasons': ['preferred_price', 'booked_region', 'unknown_code'],
          },
        ],
        'generatedAt': '2026-11-14T03:00:00.000Z',
        'mode': 'ai',
      },
      '/api/trips' => <String, Object?>{
        'items': [_trip()],
        'pagination': {'total': 1, 'totalPages': 1},
      },
      '/api/trips/$_tripId' => _trip(),
      '/api/trips/$_tripId/images' => <Object?>[],
      '/api/trip-recommendations/trips/$_tripId/explanation' => <String, Object?>{
        'tripTitle': 'Săn mây đỉnh Bà Nà',
        'reasons': ['fitness_match', 'preferred_price'],
        'healthConsidered': false,
        'summary':
            'Vì vậy chuyến này phù hợp với bạn về mức giá, đúng với những gì bạn đã cung cấp.',
        'generatedAt': '2026-11-14T03:00:00.000Z',
        'sections': [
          {
            'kind': 'price',
            'tone': 'match',
            'title': 'Phù hợp mức giá bạn chọn',
            'quote': {
              'source': 'trip_preferences',
              'field': 'Mức giá',
              'text': 'Đến 2.000.000 đ',
            },
            'conclusion': 'Vì vậy chi phí đúng với ngân sách bạn đã đặt ra.',
            'detail':
                '1.850.000 đ/người, nằm trong mức không quá 2.000.000 đ bạn chọn.',
          },
          {
            'kind': 'timing',
            'tone': 'info',
            'title': 'Lịch khởi hành',
            'detail': 'Khởi hành sau 21 ngày. Còn 7 chỗ.',
          },
        ],
      },
      '/api/profiles/me/trip-preferences' => preferences,
      _ => throw StateError('Unexpected request: $path'),
    };
    return ResponseBody.fromString(
      jsonEncode(data),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Future<_Adapter> _pump(WidgetTester tester, {_Adapter? adapter}) async {
  FlutterSecureStorage.setMockInitialValues({'accessToken': 'camper-token'});
  final http = adapter ?? _Adapter();
  final apiClient = ApiClient(TokenStorage(const FlutterSecureStorage()));
  apiClient.dio.options.baseUrl = 'https://ctms.test/api';
  apiClient.dio.httpClientAdapter = http;
  addTearDown(() => apiClient.dio.close());
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(apiClient),
        offlinePackageAccountProvider.overrideWithValue('camper-account'),
        recommendationAccountProvider.overrideWithValue('camper-account'),
        packageDownloadControllerProvider(_tripId).overrideWith(
          (ref) => PackageDownloadController(
            _tripId,
            () => throw StateError('Widget test'),
          )..loading = false,
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.light().copyWith(
          splashFactory: InkRipple.splashFactory,
        ),
        home: const CamperExploreScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return http;
}

Future<void> _openSuggestions(WidgetTester tester) async {
  await tester.tap(find.text('Xem gợi ý'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('suggestions are requested only after the Camper opens them', (
    tester,
  ) async {
    final adapter = await _pump(tester);
    expect(adapter.recommendationCalls, 0);
    expect(find.text('Gợi ý cho bạn'), findsNothing);

    await _openSuggestions(tester);
    expect(adapter.recommendationCalls, 1);
    expect(find.text('Gợi ý cho bạn'), findsOneWidget);
    // What the suggestions are based on, at the top: read-only, not a filter.
    expect(find.text('Gợi ý đang dựa trên'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(BottomSheet),
        matching: find.text('Qua đêm'),
      ),
      findsOneWidget,
    );
    expect(find.text('Đến 2.000.000 đ'), findsOneWidget);
    expect(find.textContaining('không ẩn chuyến nào'), findsOneWidget);
    expect(find.text('Chọn sở thích'), findsNothing);
    expect(find.text('Phù hợp mức giá bạn chọn'), findsOneWidget);
    expect(find.text('Cùng khu vực với chuyến bạn từng đi'), findsOneWidget);
    expect(find.text('unknown_code'), findsNothing);
    expect(find.textContaining(_tripId.substring(0, 8)), findsNothing);

    // Opening again asks the server again.
    Navigator.of(tester.element(find.text('Gợi ý cho bạn'))).pop();
    await tester.pumpAndSettle();
    await _openSuggestions(tester);
    expect(adapter.recommendationCalls, 2);
  });

  testWidgets('asks for preferences first, then suggests after saving', (
    tester,
  ) async {
    final adapter = _Adapter()..needsPreferences = true;
    await _pump(tester, adapter: adapter);
    await _openSuggestions(tester);
    expect(find.text('Cần thêm thông tin để gợi ý'), findsOneWidget);
    expect(find.text('Phù hợp mức giá bạn chọn'), findsNothing);

    await tester.tap(find.text('Cập nhật sở thích'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilterChip, 'Bà Nà – Hòa Vang'));
    await tester.pump();
    await tester.tap(find.text('Lưu sở thích'));
    await tester.pumpAndSettle();

    final put = adapter.requests.lastWhere((r) => r.method == 'PUT');
    expect(put.uri.path, '/api/profiles/me/trip-preferences');
    expect((put.data as Map)['regions'], ['ba_na_hoa_vang']);
    expect(
      find.text('Đã lưu sở thích chuyến đi. Gợi ý đang được cập nhật.'),
      findsOneWidget,
    );
    expect(adapter.recommendationCalls, 2);
    expect(find.text('Phù hợp mức giá bạn chọn'), findsOneWidget);
  });

  testWidgets('an error shows a Vietnamese message and can retry', (
    tester,
  ) async {
    final adapter = _Adapter()..recommendationFailures = 1;
    await _pump(tester, adapter: adapter);
    await _openSuggestions(tester);
    expect(find.text('Không tải được gợi ý chuyến đi'), findsOneWidget);
    expect(find.textContaining('Internal server error'), findsNothing);

    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(find.text('Phù hợp mức giá bạn chọn'), findsOneWidget);
  });

  testWidgets('rejects an inverted price range in the form', (tester) async {
    final adapter = await _pump(tester);
    await _openSuggestions(tester);
    await tester.tap(find.text('Sửa sở thích'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Từ'), '3000000');
    await tester.enterText(find.widgetWithText(TextField, 'Đến'), '1000000');
    await tester.tap(find.text('Lưu sở thích'));
    await tester.pumpAndSettle();
    expect(
      find.text('Giá thấp nhất không được lớn hơn giá cao nhất.'),
      findsOneWidget,
    );
    expect(adapter.requests.where((r) => r.method == 'PUT'), isEmpty);
  });

  testWidgets('returning from the trip detail reloads availability', (
    tester,
  ) async {
    final adapter = await _pump(tester);
    await _openSuggestions(tester);
    adapter.remainingSeats = 0;
    final sheetDetails = find.descendant(
      of: find.byType(BottomSheet),
      matching: find.text('Xem chi tiết'),
    );
    await tester.ensureVisible(sheetDetails);
    await tester.pumpAndSettle();
    await tester.tap(sheetDetails);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Quay lại'));
    await tester.pumpAndSettle();
    expect(adapter.recommendationCalls, 2);
    expect(
      find.descendant(
        of: find.byType(BottomSheet),
        matching: find.text('Hết chỗ'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('a suggested trip explains why it was suggested', (tester) async {
    final adapter = await _pump(tester);
    expect(find.text('Gợi ý chuyến đi dành cho bạn'), findsOneWidget);
    await _openSuggestions(tester);
    final sheetDetails = find.descendant(
      of: find.byType(BottomSheet),
      matching: find.text('Xem chi tiết'),
    );
    await tester.ensureVisible(sheetDetails);
    await tester.pumpAndSettle();
    await tester.tap(sheetDetails);
    await tester.pumpAndSettle();
    expect(find.text('Vì sao gợi ý chuyến này cho bạn'), findsOneWidget);
    expect(find.text('Phù hợp mức giá bạn chọn · Phù hợp'), findsOneWidget);
    expect(
      find.text('Bạn đã cung cấp · Sở thích chuyến đi · Mức giá'),
      findsOneWidget,
    );
    expect(find.text('“Đến 2.000.000 đ”'), findsOneWidget);
    expect(
      find.text('→ Vì vậy chi phí đúng với ngân sách bạn đã đặt ra.'),
      findsOneWidget,
    );
    expect(find.text('Kết luận'), findsOneWidget);
    expect(find.textContaining('Bật chia sẻ hồ sơ sức khỏe'), findsOneWidget);
    expect(find.textContaining(_tripId.substring(0, 8)), findsNothing);
    expect(
      adapter.requests.where((r) => r.uri.path.endsWith('/explanation')),
      hasLength(1),
    );
  });

  testWidgets('a trip opened from the normal list shows no explanation', (
    tester,
  ) async {
    final adapter = await _pump(tester);
    await tester.ensureVisible(find.text('Xem chi tiết').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xem chi tiết').first);
    await tester.pumpAndSettle();
    expect(find.text('Vì sao gợi ý chuyến này cho bạn'), findsNothing);
    expect(
      adapter.requests.where((r) => r.uri.path.endsWith('/explanation')),
      isEmpty,
    );
  });
}
