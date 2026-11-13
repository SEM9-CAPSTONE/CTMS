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
import 'package:mobile/features/camper/presentation/camper_explore_screen.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';
import 'package:mobile/features/offline_packages/presentation/offline_package_screen.dart';

const _tripId = '22400000-0000-4000-8000-000000000001';

class _ExploreHttpAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  bool tripPublished = false;

  Map<String, Object?> get trip => {
    'id': _tripId,
    'title': 'Chuyến trekking vừa được duyệt',
    'description': 'Khám phá rừng thông cùng hướng dẫn viên.',
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
      '/api/trips/$_tripId' => {
        ...trip,
        'description': 'Mô tả cập nhật từ API chi tiết.',
      },
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
}

void main() {
  testWidgets('refreshing Explore shows a newly published trip', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({'accessToken': 'camper-token'});
    final adapter = _ExploreHttpAdapter();
    final apiClient = ApiClient(TokenStorage(const FlutterSecureStorage()));
    apiClient.dio.options.baseUrl = 'https://ctms.test/api';
    apiClient.dio.httpClientAdapter = adapter;
    addTearDown(() => apiClient.dio.close());
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(apiClient),
          offlinePackageAccountProvider.overrideWithValue('test-account'),
          packageDownloadControllerProvider(_tripId).overrideWith(
            (ref) => PackageDownloadController(
              _tripId,
              () => throw StateError('Widget test'),
            )..loading = false,
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const CamperExploreScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Không tìm thấy chuyến đi nào'), findsOneWidget);
    expect(adapter.requests.single.uri.path, '/api/trips');
    expect(adapter.requests.single.queryParameters, {'page': 1});
    expect(
      adapter.requests.single.headers['Authorization'],
      'Bearer camper-token',
    );

    adapter.tripPublished = true;
    await tester.tap(find.byTooltip('Làm mới chuyến đi'));
    await tester.pumpAndSettle();

    expect(find.text('Chuyến trekking vừa được duyệt'), findsOneWidget);
    expect(find.text('Còn 6 chỗ'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'trekking');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(adapter.requests.last.queryParameters, {
      'page': 1,
      'search': 'trekking',
    });

    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    final details = find.text('Xem chi tiết');
    await tester.ensureVisible(details);
    await tester.tap(details);
    await tester.pumpAndSettle();
    expect(adapter.requests.last.uri.path, '/api/trips/$_tripId');
    expect(find.text('Mô tả cập nhật từ API chi tiết.'), findsOneWidget);

    final offlineButton = find.text('Dữ liệu ngoại tuyến');
    await tester.scrollUntilVisible(
      offlineButton,
      150,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.tap(offlineButton);
    await tester.pumpAndSettle();

    final packageScreen = tester.widget<OfflinePackageScreen>(
      find.byType(OfflinePackageScreen),
    );
    expect(packageScreen.tripId, _tripId);
    expect(packageScreen.accountId, 'test-account');
  });
}
