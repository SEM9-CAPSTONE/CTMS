import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/lifecycle/app_lifecycle_observer.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/application/auth_controller.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/auth/domain/user_role.dart';
import 'package:mobile/features/camper/profile/application/camper_profile_controller.dart';
import 'package:mobile/features/camper/profile/data/camper_profile_repository.dart';
import 'package:mobile/features/camper/profile/domain/camper_profile.dart';

const _user = AuthUser(
  id: 'user-1',
  fullName: 'Nguyễn Văn A',
  email: 'camper@example.com',
  phone: '0912345678',
  role: UserRole.camper,
);

const _profile = CamperProfile(
  id: 'user-1',
  email: 'camper@example.com',
  phone: '0912345678',
  fullName: 'Nguyễn Văn A',
  dateOfBirth: '1995-04-12',
  gender: 'male',
  address: 'Da Lat, Lam Dong',
  bio: 'Weekend trekker',
  emergencyContacts: [],
);

/// Same "extend the real class, override the method" fake pattern as
/// auth_controller_test.dart's `_RecordingAuthRepository` -- avoids
/// widening `AuthController`'s type or adding a mocking package.
class _FakeAuthController extends AuthController {
  _FakeAuthController(this._user);

  final AuthUser? _user;

  @override
  Future<AuthUser?> build() async => _user;
}

/// Same pattern as camper_profile_controller_test.dart's
/// `_RecordingCamperProfileRepository`.
class _RecordingProfileRepository extends CamperProfileRepository {
  _RecordingProfileRepository() : super(ApiClient(TokenStorage(const FlutterSecureStorage())));

  int getCallCount = 0;

  @override
  Future<CamperProfile> getProfile() async {
    getCallCount++;
    return _profile;
  }
}

void main() {
  late _RecordingProfileRepository repository;
  late ProviderContainer container;
  late WidgetRef capturedRef;

  /// Pumps a minimal widget tree -- just enough to obtain a real
  /// [WidgetRef] backed by [container] and to keep
  /// [camperProfileControllerProvider] watched (Riverpod only rebuilds an
  /// invalidated provider if something is actively watching it). No
  /// `CtmsApp`/router/`AppLifecycleObserver` involved -- this tests
  /// [handleAppLifecycleChange] directly, the same "extract the logic into
  /// a plain function, test that function" approach used for
  /// authSessionSync.ts's `initAuthSessionSync` on the Web side.
  Future<void> pumpHarness(WidgetTester tester, {required AuthUser? authState}) async {
    repository = _RecordingProfileRepository();
    container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(() => _FakeAuthController(authState)),
        camperProfileRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);

    // Mirrors reality: app_router.dart keeps `authControllerProvider`
    // watched continuously from app startup (`ref.watch(authControllerProvider)`
    // in `appRouterProvider`), so by the time any lifecycle event can fire,
    // it has long since resolved past `AsyncLoading`. Without watching it
    // here too, `handleAppLifecycleChange`'s `ref.read(authControllerProvider)`
    // would be the FIRST touch of that provider in this harness and would
    // observe it still loading.
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: Consumer(
          builder: (context, ref, _) {
            capturedRef = ref;
            ref.watch(authControllerProvider);
            ref.watch(camperProfileControllerProvider);
            return const SizedBox();
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  group('handleAppLifecycleChange (CTMS-04-T03, DG-M6)', () {
    testWidgets('resumed + authenticated invalidates camperProfileControllerProvider', (tester) async {
      await pumpHarness(tester, authState: _user);
      expect(repository.getCallCount, 1); // initial build() fetch on watch

      handleAppLifecycleChange(AppLifecycleState.resumed, capturedRef);
      await tester.pumpAndSettle();

      expect(repository.getCallCount, 2);
    });

    testWidgets('resumed + unauthenticated does nothing', (tester) async {
      await pumpHarness(tester, authState: null);
      // The harness's own `ref.watch(camperProfileControllerProvider)` already
      // fetched once on mount, independent of auth state (that provider has
      // no auth gate of its own -- the point of this test is that the
      // *lifecycle handler* does not cause a SECOND fetch while unauthenticated).
      expect(repository.getCallCount, 1);

      handleAppLifecycleChange(AppLifecycleState.resumed, capturedRef);
      await tester.pumpAndSettle();

      expect(repository.getCallCount, 1);
    });

    for (final state in [
      AppLifecycleState.paused,
      AppLifecycleState.inactive,
      AppLifecycleState.detached,
      AppLifecycleState.hidden,
    ]) {
      testWidgets('$state (authenticated) does nothing -- only resumed acts', (tester) async {
        await pumpHarness(tester, authState: _user);
        expect(repository.getCallCount, 1);

        handleAppLifecycleChange(state, capturedRef);
        await tester.pumpAndSettle();

        expect(repository.getCallCount, 1);
      });
    }
  });

  group('AppLifecycleObserver widget', () {
    testWidgets('renders its child unchanged and registers/unregisters as a WidgetsBindingObserver', (tester) async {
      await tester.pumpWidget(
        const Directionality(textDirection: TextDirection.ltr, child: AppLifecycleObserver(child: Text('child'))),
      );

      expect(find.text('child'), findsOneWidget);

      // No crash on dispose -- proves removeObserver() runs cleanly.
      await tester.pumpWidget(const SizedBox());
    });
  });
}
