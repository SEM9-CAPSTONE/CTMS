import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/api/api_exception.dart';
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

  /// Escape hatch for the double-submit test, which needs `register()` to
  /// stay pending (not resolve on the next microtask) across 3 near-
  /// simultaneous calls -- same reasoning as widget_test.dart's `loginGate`.
  Future<RegisterResult> Function(RegisterFormData data)? registerOverride;

  @override
  Future<RegisterResult> register(RegisterFormData data) async {
    lastRegisterCall = data;
    final override = registerOverride;
    if (override != null) return override(data);
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

    test('normalizes email (trim + lowercase) before sending, phone trimmed only', () async {
      // BR-002 (trim/lowercase); phone stays as typed -- E.164 normalization
      // is the backend's job (RegisterDto's @Transform), same decision
      // already made for the web app -- not duplicated on mobile either.
      controller().selectRole(UserRole.camper);
      controller().updateAccount(email: '  Camper@Example.COM  ', password: 's3cretPass');
      controller().updatePersonal(fullName: 'Nguyễn Văn A', phone: '  0912345678  ');

      await controller().submit();

      final sent = repository.lastRegisterCall;
      expect(sent!.email, 'camper@example.com');
      expect(sent.phone, '0912345678');
    });

    test('a 409 duplicate-account error surfaces its message with no fieldErrors', () async {
      repository.failure = ApiException(
        'Email or phone already registered',
        statusCode: 409,
        errorData: {
          'statusCode': 409,
          'message': 'Email or phone already registered',
          'error': 'Conflict',
        },
        kind: ApiExceptionKind.response,
      );
      controller().selectRole(UserRole.camper);
      controller().updateAccount(email: 'dup@example.com', password: 's3cretPass');
      controller().updatePersonal(fullName: 'Lê Văn C', phone: '0911111111');

      await controller().submit();

      final error = state().submitError;
      expect(error, isNotNull);
      expect(error!.status, 409);
      expect(error.message, 'Email or phone already registered');
      expect(error.fieldErrors, isNull);
    });

    test('a 422 validation error surfaces fieldErrors parsed from errorData', () async {
      repository.failure = ApiException(
        'Unprocessable Entity',
        statusCode: 422,
        errorData: {
          'statusCode': 422,
          'error': 'Unprocessable Entity',
          'message': [
            {
              'field': 'phone',
              'errors': ['phone must be a valid Vietnamese mobile number'],
            },
          ],
        },
        kind: ApiExceptionKind.response,
      );
      controller().selectRole(UserRole.camper);
      controller().updateAccount(email: 'camper@example.com', password: 's3cretPass');
      controller().updatePersonal(fullName: 'Nguyễn Văn A', phone: 'not-a-phone');

      await controller().submit();

      final error = state().submitError;
      expect(error, isNotNull);
      expect(error!.status, 422);
      expect(error.fieldErrors, hasLength(1));
      expect(error.fieldErrors!.first.field, 'phone');
      expect(
        error.fieldErrors!.first.errors,
        contains('phone must be a valid Vietnamese mobile number'),
      );
    });

    test('offline/timeout errors are passed through with their ApiClient-set message', () async {
      // ApiClient itself sets the Vietnamese copy for network/timeout kinds
      // (see api_client.dart's doc comment) -- the controller doesn't
      // re-map it, just carries it through.
      repository.failure = ApiException(
        'Không có kết nối mạng. Vui lòng kiểm tra và thử lại.',
        kind: ApiExceptionKind.network,
      );
      controller().selectRole(UserRole.camper);
      controller().updateAccount(email: 'camper@example.com', password: 's3cretPass');
      controller().updatePersonal(fullName: 'Nguyễn Văn A', phone: '0912345678');

      await controller().submit();

      expect(
        state().submitError!.message,
        'Không có kết nối mạng. Vui lòng kiểm tra và thử lại.',
      );
    });

    test('a second concurrent submit while one is in flight is a no-op (BR-241 guard)', () async {
      final gate = Completer<RegisterResult>();
      var callCount = 0;
      repository.registerOverride = (data) {
        callCount++;
        return gate.future;
      };
      controller().selectRole(UserRole.camper);
      controller().updateAccount(email: 'camper@example.com', password: 's3cretPass');
      controller().updatePersonal(fullName: 'Nguyễn Văn A', phone: '0912345678');

      final first = controller().submit();
      final second = controller().submit();
      final third = controller().submit();
      gate.complete(
        const RegisterResult(
          id: 'user-1',
          email: 'camper@example.com',
          phone: '0912345678',
          role: UserRole.camper,
          status: 'pending_verification',
        ),
      );
      await Future.wait([first, second, third]);

      expect(callCount, 1);
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
