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
import 'package:mobile/features/offline_packages/presentation/offline_package_screen.dart';

const _tripId = '22400000-0000-4000-8000-000000000001';

class _ExploreHttpAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  bool tripPublished = false;
  bool legacyGallery = false;

  Map<String, Object?> get trip => {
    'id': _tripId,
    'title': 'Chuyến trekking vừa được duyệt',
    'description': 'Khám phá rừng thông cùng hướng dẫn viên.',
    'coverImageUrl': 'https://ctms.local/trips/son-tra.jpg',
    'difficulty': 'moderate',
    'startsAt': '2026-11-28T01:00:00.000Z',
    'endsAt': '2026-11-29T08:00:00.000Z',
    'bookingDeadline': '2026-11-26T10:00:00.000Z',
    'durationNights': 1,
    'pricePerPerson': 1250000,
    'remainingSeats': 6,
    'isBookable': true,
  };

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final data = switch (options.uri.path) {
      '/api/trips' => <String, Object?>{
        'items': [if (tripPublished) trip],
        'pagination': {
          'total': tripPublished ? 1 : 0,
          'totalPages': tripPublished ? 1 : 0,
        },
      },
      '/api/trip-recommendations' => <String, Object?>{
        'items': <Object?>[],
        'generatedAt': '2026-11-14T03:00:00.000Z',
        'mode': 'neutral',
      },
      '/api/trips/$_tripId' => {
        ...trip,
        'description': 'Mô tả cập nhật từ API chi tiết.',
        'coverImageUrl': 'https://ctms.local/trips/son-tra-updated.jpg',
        'itinerary': {
          'images': [
            'https://ctms.local/trips/son-tra-updated.jpg',
            'https://ctms.local/trips/son-tra-second.jpg',
          ],
        },
      },
      '/api/trips/$_tripId/images' when legacyGallery => <Object?>[],
      '/api/trips/$_tripId/images' => [
        {
          'id': 'image-1',
          'url': 'https://ctms.local/trips/son-tra-updated.jpg',
          'sortOrder': 0,
        },
        {
          'id': 'image-2',
          'url': 'https://ctms.local/trips/son-tra-second.jpg',
          'sortOrder': 1,
        },
      ],
      _ => throw StateError('Unexpected request: ${options.uri.path}'),
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

  List<RequestOptions> get searchRequests =>
      requests.where((r) => r.uri.path == '/api/trips').toList();
}

void main() {
  for (final legacy in [false, true]) {
    testWidgets(
      'refreshing Explore with legacyGallery=$legacy shows a newly published trip',
      (tester) async {
        FlutterSecureStorage.setMockInitialValues({
          'accessToken': 'camper-token',
        });
        final adapter = _ExploreHttpAdapter()..legacyGallery = legacy;
        final apiClient = ApiClient(TokenStorage(const FlutterSecureStorage()));
        apiClient.dio.options.baseUrl = 'https://ctms.test/api';
        apiClient.dio.httpClientAdapter = adapter;
        addTearDown(() => apiClient.dio.close());
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              apiClientProvider.overrideWithValue(apiClient),
              offlinePackageAccountProvider.overrideWithValue('test-account'),
              recommendationAccountProvider.overrideWithValue('test-account'),
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

        expect(find.text('Không tìm thấy chuyến đi nào'), findsOneWidget);
        expect(adapter.searchRequests.single.uri.path, '/api/trips');
        // Suggestions are only generated when the Camper opens them.
        expect(
          adapter.requests.where(
            (r) => r.uri.path == '/api/trip-recommendations',
          ),
          isEmpty,
        );
        expect(adapter.searchRequests.single.queryParameters, {'page': 1});
        expect(
          adapter.searchRequests.single.headers['Authorization'],
          'Bearer camper-token',
        );

        adapter.tripPublished = true;
        await tester.tap(find.byTooltip('Làm mới chuyến đi'));
        await tester.pumpAndSettle();

        expect(find.text('Chuyến trekking vừa được duyệt'), findsOneWidget);
        expect(find.text('Còn 6 chỗ'), findsOneWidget);
        expect(
          adapter.requests.where(
            (request) => request.uri.path.endsWith('/images'),
          ),
          isEmpty,
        );
        expect(
          (tester.widget<Image>(find.byType(Image).first).image as NetworkImage)
              .url,
          'https://ctms.local/trips/son-tra.jpg',
        );

        await tester.enterText(find.byType(TextField), 'trekking');
        await tester.pump(const Duration(milliseconds: 300));
        await tester.pumpAndSettle();
        expect(adapter.searchRequests.last.queryParameters, {
          'page': 1,
          'search': 'trekking',
        });

        await tester.testTextInput.receiveAction(TextInputAction.done);
        await tester.pumpAndSettle();
        final details = find.text('Xem chi tiết');
        await tester.ensureVisible(details);
        await tester.pumpAndSettle();
        await tester.tap(details);
        await tester.pumpAndSettle();
        expect(
          adapter.requests.any(
            (request) => request.uri.path == '/api/trips/$_tripId',
          ),
          isTrue,
        );
        expect(
          (tester.widget<Image>(find.byType(Image).first).image as NetworkImage)
              .url,
          'https://ctms.local/trips/son-tra-updated.jpg',
        );

        await tester.tap(find.text('Xem 2 ảnh'));
        await tester.pumpAndSettle();
        expect(find.text('1 / 2'), findsOneWidget);
        await tester.tap(find.byTooltip('Ảnh tiếp theo'));
        await tester.pumpAndSettle();
        expect(find.text('2 / 2'), findsOneWidget);
        await tester.tap(find.byTooltip('Đóng ảnh'));
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(
          find.text('Mô tả cập nhật từ API chi tiết.'),
          150,
          scrollable: find.byType(Scrollable).first,
        );
        expect(find.text('Mô tả cập nhật từ API chi tiết.'), findsOneWidget);

        final offlineButton = find.text('Dữ liệu ngoại tuyến');
        await tester.scrollUntilVisible(
          offlineButton,
          150,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.tap(offlineButton);
        await tester.pumpAndSettle();

        final packageScreen = tester.widget<OfflinePackageScreen>(
          find.byType(OfflinePackageScreen),
        );
        expect(packageScreen.tripId, _tripId);
        expect(packageScreen.accountId, 'test-account');
      },
    );
  }
}
