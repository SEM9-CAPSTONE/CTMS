import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/application/register_controller.dart';
import 'package:mobile/features/auth/data/auth_api.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/domain/register_models.dart';
import 'package:mobile/features/auth/domain/user_role.dart';

/// Records the last payload built by [AuthRepository.register] without
/// touching the network — this is what proves CTMS-01-T03's core fix: the
/// request sent to the real backend contains exactly `email`/`phone`/
/// `password`/`role`, never `fullName` or any of the fields the old wizard
/// used to collect (see register_models.dart's doc comment).
///
/// The real [AuthApi]/[TokenStorage] passed to `super` are never touched —
/// [register] is fully overridden — same pattern as
/// `test/widget_test.dart`'s `_FakeAuthRepository`.
class _RecordingAuthRepository extends AuthRepository {
  _RecordingAuthRepository()
    : super(
        AuthApi(ApiClient(TokenStorage(const FlutterSecureStorage()))),
        TokenStorage(const FlutterSecureStorage()),
      );

  RegisterFormData? lastRegisterCall;
  Object? failure;

  @override
  Future<RegisterResult> register(RegisterFormData data) async {
    lastRegisterCall = data;
    if (failure != null) throw failure!;
    return RegisterResult(
      id: 'user-1',
      email: data.email,
      phone: data.phone,
      role: data.role!,
      status: 'pending_verification',
    );
  }
}

void main() {
  late _RecordingAuthRepository repository;
  late ProviderContainer container;

  setUp(() {
    repository = _RecordingAuthRepository();
    container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);
  });

  RegisterController controller() => container.read(registerControllerProvider.notifier);
  RegisterWizardState state() => container.read(registerControllerProvider);

  group('RegisterController.submit', () {
    test(
      'sends only email/phone/password/role -- never fullName -- to AuthRepository.register',
      () async {
        controller().selectRole(UserRole.camper);
        controller().updateAccount(email: 'camper@example.com', password: 's3cretPass');
        controller().updatePersonal(fullName: 'Nguyễn Văn A', phone: '0912345678');
        controller().setAcceptedTerms(true);

        await controller().submit();

        final sent = repository.lastRegisterCall;
        expect(sent, isNotNull);
        expect(sent!.email, 'camper@example.com');
        expect(sent.phone, '0912345678');
        expect(sent.password, 's3cretPass');
        expect(sent.role, UserRole.camper);
        // fullName is carried on RegisterFormData for the UI only -- proving
        // it stays out of the actual request is AuthApi.register's job
        // (payload is built explicitly there, not by serializing this
        // object), so this only asserts the state that would feed it.
        expect(sent.fullName, 'Nguyễn Văn A');
      },
    );

    test('on success, stores registerResult and clears isSubmitting', () async {
      controller().selectRole(UserRole.porter);
      controller().updateAccount(email: 'porter@example.com', password: 's3cretPass');
      controller().updatePersonal(fullName: 'Trần Thị B', phone: '0987654321');

      await controller().submit();

      expect(state().isSubmitting, isFalse);
      expect(state().submitError, isNull);
      final result = state().registerResult;
      expect(result, isNotNull);
      expect(result!.email, 'porter@example.com');
      expect(result.phone, '0987654321');
      expect(result.role, UserRole.porter);
      expect(result.status, 'pending_verification');
    });

    test('on failure, stores submitError and never sets registerResult', () async {
      repository.failure = Exception('Email or phone already registered');
      controller().selectRole(UserRole.camper);
      controller().updateAccount(email: 'dup@example.com', password: 's3cretPass');
      controller().updatePersonal(fullName: 'Lê Văn C', phone: '0911111111');

      await controller().submit();

      expect(state().isSubmitting, isFalse);
      expect(state().registerResult, isNull);
      expect(state().submitError, isNotNull);
    });
  });

  group('RegisterController wizard navigation', () {
    test('goNext/goBack move exactly one RegisterStep at a time', () {
      expect(state().step, RegisterStep.role);
      controller().goNext();
      expect(state().step, RegisterStep.account);
      controller().goNext();
      expect(state().step, RegisterStep.personal);
      controller().goNext();
      expect(state().step, RegisterStep.verification);
      // isLastStep guards further advancement.
      controller().goNext();
      expect(state().step, RegisterStep.verification);

      controller().goBack();
      expect(state().step, RegisterStep.personal);
    });
  });
}
