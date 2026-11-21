import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/application/auth_controller.dart';
import 'package:mobile/features/auth/data/auth_api.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/data/google_id_token_source.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/auth/domain/user_role.dart';
import 'package:mobile/features/auth/presentation/login_screen.dart';

const camper = AuthUser(
  id: 'u-1',
  fullName: 'Nguyễn Thị Hoa',
  email: 'hoa.nguyen@gmail.com',
  role: UserRole.camper,
  roles: [UserRole.camper],
);

class FakeGoogleSource implements GoogleIdTokenSource {
  FakeGoogleSource({this.enabled = true, this.token = 'google-id-token'});

  final bool enabled;
  final String? token;
  int calls = 0;

  @override
  bool get isEnabled => enabled;

  @override
  Future<String?> signIn() async {
    calls++;
    return token;
  }
}

class FakeAuthRepository extends AuthRepository {
  FakeAuthRepository({this.failure})
    : super(
        AuthApi(ApiClient(TokenStorage(const FlutterSecureStorage()))),
        TokenStorage(const FlutterSecureStorage()),
      );

  final ApiException? failure;
  final tokens = <String>[];

  @override
  Future<AuthUser?> tryRestoreSession() async => null;

  @override
  Future<AuthUser> loginWithGoogle(String idToken) async {
    tokens.add(idToken);
    if (failure != null) throw failure!;
    return camper;
  }
}

Future<ProviderContainer> pumpLogin(
  WidgetTester tester, {
  required FakeGoogleSource google,
  required FakeAuthRepository repository,
}) async {
  final container = ProviderContainer(
    overrides: [
      googleIdTokenSourceProvider.overrideWithValue(google),
      authRepositoryProvider.overrideWithValue(repository),
    ],
  );
  addTearDown(container.dispose);
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 2.4;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(theme: AppTheme.light(), home: const LoginScreen()),
    ),
  );
  await tester.pumpAndSettle();
  return container;
}

Future<void> tapGoogle(WidgetTester tester) async {
  final button = find.text('Đăng nhập bằng Google');
  await tester.ensureVisible(button);
  await tester.tap(button);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('hides Google sign-in when the app has no Google client id', (
    tester,
  ) async {
    await pumpLogin(
      tester,
      google: FakeGoogleSource(enabled: false),
      repository: FakeAuthRepository(),
    );

    expect(find.text('Đăng nhập bằng Google'), findsNothing);
    expect(find.text('Hoặc đăng nhập bằng'), findsNothing);
  });

  testWidgets('signs in with the Google ID token', (tester) async {
    final repository = FakeAuthRepository();
    final container = await pumpLogin(
      tester,
      google: FakeGoogleSource(),
      repository: repository,
    );

    await tapGoogle(tester);

    expect(repository.tokens, ['google-id-token']);
    expect(container.read(authControllerProvider).valueOrNull, camper);
    expect(find.text('Không thể đăng nhập'), findsNothing);
  });

  testWidgets('closing the Google sheet is not an error', (tester) async {
    final repository = FakeAuthRepository();
    final google = FakeGoogleSource(token: null);
    final container = await pumpLogin(
      tester,
      google: google,
      repository: repository,
    );

    await tapGoogle(tester);

    expect(google.calls, 1);
    expect(repository.tokens, isEmpty);
    expect(container.read(authControllerProvider).valueOrNull, isNull);
    expect(find.text('Không thể đăng nhập'), findsNothing);
  });

  testWidgets(
    'a suspended account gets the Google wording, without the verify action',
    (tester) async {
      final repository = FakeAuthRepository(
        failure: ApiException(
          'Account is not active',
          statusCode: 401,
          kind: ApiExceptionKind.response,
        ),
      );
      await pumpLogin(
        tester,
        google: FakeGoogleSource(),
        repository: repository,
      );

      await tapGoogle(tester);

      expect(
        find.text(
          'Tài khoản của bạn đang bị khoá hoặc đã bị xoá nên không thể đăng nhập.',
        ),
        findsOneWidget,
      );
      expect(find.text('Xác minh tài khoản'), findsNothing);
    },
  );

  testWidgets('Google sign-in switched off on the server is explained', (
    tester,
  ) async {
    final repository = FakeAuthRepository(
      failure: ApiException(
        'Google sign-in is not configured',
        statusCode: 503,
        kind: ApiExceptionKind.response,
      ),
    );
    await pumpLogin(tester, google: FakeGoogleSource(), repository: repository);

    await tapGoogle(tester);

    expect(
      find.text(
        'Đăng nhập bằng Google hiện chưa được bật. Vui lòng đăng nhập bằng email hoặc số điện thoại.',
      ),
      findsOneWidget,
    );
  });
}
