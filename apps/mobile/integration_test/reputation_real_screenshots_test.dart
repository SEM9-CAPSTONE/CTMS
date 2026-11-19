import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/application/auth_controller.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/camper/data/camper_explore_api.dart';
import 'package:mobile/features/camper/presentation/camper_explore_screen.dart';
import 'package:mobile/features/porter_reviews/application/porter_reviews_controller.dart';
import 'package:mobile/features/porter_reviews/presentation/porter_reviews_screen.dart';

// The real server session is kept in memory for this evidence harness; device
// secure-storage migration is outside the reputation feature under test.
class _EvidenceTokens extends TokenStorage {
  _EvidenceTokens(this.token) : super(const FlutterSecureStorage());
  final String token;
  @override
  Future<String?> readAccessToken() async => token;
}

class _EvidenceAuth extends AuthController {
  _EvidenceAuth(this.user);
  final AuthUser user;
  @override
  Future<AuthUser?> build() async => user;
}

void main() {
  if (!const bool.fromEnvironment('CTMS414_EVIDENCE')) {
    test(
      'reputation Android evidence is opt-in',
      () {},
      skip: 'Requires local API and main seed --reputation-only',
    );
    return;
  }
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  const trip = 'd4140000-0000-4000-8000-000000000001';
  testWidgets(
    'real Host and retained Porter ratings, with a transport-only refresh fault',
    (tester) async {
      late Map<String, dynamic> session;
      debugPrint('CTMS-414: signing in through the real API');
      await tester.runAsync(() async {
        final client = Dio(
          BaseOptions(
            baseUrl: const String.fromEnvironment('API_BASE_URL'),
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 15),
          ),
        );
        session = (await client.post<Map<String, dynamic>>(
          '/auth/login',
          data: {
            'identifier': 'camper@ctms.local',
            'password': const String.fromEnvironment('CTMS414_CAMPER_PASSWORD'),
          },
        )).data!;
        client.close();
      });
      final actor = AuthUser.fromJson(session['user'] as Map<String, dynamic>);
      debugPrint('CTMS-414: server session established');
      final container = ProviderContainer(
        overrides: [
          tokenStorageProvider.overrideWithValue(
            _EvidenceTokens(session['accessToken'] as String),
          ),
          authControllerProvider.overrideWith(() => _EvidenceAuth(actor)),
        ],
      );
      addTearDown(container.dispose);
      await tester.runAsync(
        () => container.read(authControllerProvider.future),
      );
      expect(container.read(authControllerProvider).requireValue, isNotNull);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            theme: AppTheme.light(),
            debugShowCheckedModeBanner: false,
            home: const PublishedTripDetailsScreen(tripId: trip),
          ),
        ),
      );
      Future<void> until(Finder finder) async {
        for (var i = 0; i < 100 && finder.evaluate().isEmpty; i++) {
          await tester.pump(const Duration(milliseconds: 200));
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 100)),
          );
        }
        expect(finder, findsWidgets);
        await tester.pumpAndSettle();
      }

      await until(find.text('4,5/5 · 2 đánh giá'));
      debugPrint('CTMS-414: Host rating rendered');
      await binding.convertFlutterSurfaceToImage();
      await tester.pumpAndSettle();
      Future<void> capture(String name) async {
        var completed = false;
        final image = binding.takeScreenshot(name).whenComplete(() {
          completed = true;
        });
        for (var i = 0; i < 120 && !completed; i++) {
          await tester.pump(const Duration(milliseconds: 50));
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 50)),
          );
        }
        await image.timeout(const Duration(seconds: 10));
        debugPrint('CTMS-414: captured $name');
      }

      await capture('01-flutter-host-co-diem-api-that');
      final client = container.read(apiClientProvider);
      // Simulate only transport failure; the displayed rating remains the real API snapshot.
      final fault = InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path.endsWith('/$trip')) {
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.connectionError,
              ),
            );
          } else {
            handler.next(options);
          }
        },
      );
      client.dio.interceptors.add(fault);
      container.invalidate(publishedTripDetailsProvider(trip));
      await until(find.text('Chưa cập nhật'));
      expect(find.text('4,5/5 · 2 đánh giá'), findsOneWidget);
      await capture('02-flutter-du-lieu-cu-loi-mang-mo-phong');
      client.dio.interceptors.remove(fault);
      await tester.tap(find.text('Thử lại'));
      await until(find.text('4,5/5 · 2 đánh giá'));
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            theme: AppTheme.light(),
            debugShowCheckedModeBanner: false,
            home: const PorterReviewsScreen(
              bookingId: 'd4140000-0000-4000-8001-000000000001',
              tripTitle: 'Sơn Trà – Bình minh trên đỉnh Bàn Cờ',
            ),
          ),
        ),
      );
      await until(find.text('4,5/5 · 2 đánh giá'));
      await capture('03-flutter-nguoi-ho-tro-api-that');
      await tester.runAsync(
        () => container
            .read(porterReviewsProvider)!
            .selectTrip(
              'd4140000-0000-4000-8001-000000000002',
              'Sơn Trà – Dạo bước dưới tán rừng',
            ),
      );
      await until(find.text('4,5/5 · 2 đánh giá'));
      await capture('04-flutter-da-go-phan-cong-api-that');
      // A real revision changes the aggregate and the next context read.
      final controller = container.read(porterReviewsProvider)!;
      final saved = controller.selected!.saved!;
      final account = container.read(authControllerProvider).requireValue!;
      final api = container.read(porterReviewsApiProvider(account.id));
      await tester.runAsync(
        () => api.write(
          bookingId: controller.bookingId!,
          porterId: saved.porterId,
          rating: 3,
          comment: saved.comment,
          reviewId: saved.id,
          expectedRevision: saved.revision,
        ),
      );
      await tester.runAsync(controller.refreshContext);
      try {
        await until(find.text('3,5/5 · 2 đánh giá'));
        await capture('05-flutter-diem-sau-sua-api-that');
      } finally {
        final updated = controller.selected!.saved!;
        await tester.runAsync(
          () => api.write(
            bookingId: controller.bookingId!,
            porterId: updated.porterId,
            rating: saved.rating,
            comment: saved.comment,
            reviewId: updated.id,
            expectedRevision: updated.revision,
          ),
        );
      }
      await tester.runAsync(controller.refreshContext);
      const emptyTrip = String.fromEnvironment('CTMS414_EMPTY_TRIP_ID');
      if (emptyTrip.isNotEmpty) {
        await tester.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: MaterialApp(
              theme: AppTheme.light(),
              debugShowCheckedModeBanner: false,
              home: const PublishedTripDetailsScreen(tripId: emptyTrip),
            ),
          ),
        );
        await until(find.text('Chưa có đánh giá'));
        await capture('10-flutter-host-chua-co-danh-gia-api-that');
      }
    },
  );
}
