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
import 'package:mobile/features/terms/domain/terms_models.dart';

class _RecordingAuthRepository extends AuthRepository {
  _RecordingAuthRepository()
    : super(
        AuthApi(ApiClient(TokenStorage(const FlutterSecureStorage()))),
        TokenStorage(const FlutterSecureStorage()),
      );

  RegisterFormData? lastRegisterCall;
  String? lastAcceptedTermsVersion;
  bool? lastHealthProfileConsent;
  Object? failure;

  Future<RegisterResult> Function(RegisterFormData data)? registerOverride;

  @override
  Future<RegisterResult> register(
    RegisterFormData data, {
    String? acceptedTermsVersion,
    bool healthProfileConsent = false,
  }) async {
    lastRegisterCall = data;
    lastAcceptedTermsVersion = acceptedTermsVersion;
    lastHealthProfileConsent = healthProfileConsent;
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

  RegisterController controller() =>
      container.read(registerControllerProvider.notifier);
  RegisterWizardState state() => container.read(registerControllerProvider);

  void acceptTermsDoc() {
    controller().setAcceptedTerms(true);
    controller().setAgreedToTermsDocument(true, version: '1.0');
  }

  group('RegisterController.submit', () {
    test(
      'blocks registration when Terms & Conditions checkbox is unchecked',
      () async {
        controller().selectRole(UserRole.camper);
        controller().updateAccount(
          email: 'camper@example.com',
          password: 's3cretPass',
        );
        controller().updatePersonal(
          fullName: 'Nguyễn Văn A',
          phone: '0912345678',
        );
        controller().setAcceptedTerms(true);

        await controller().submit(activeTermsVersion: '1.0');

        expect(repository.lastRegisterCall, isNull);
        expect(state().submitError, isNotNull);
        expect(state().submitError!.message, contains('Điều khoản'));
      },
    );

    test(
      'sends email/phone/password/role and acceptedTermsVersion without requiring health consent',
      () async {
        controller().selectRole(UserRole.camper);
        controller().updateAccount(
          email: 'camper@example.com',
          password: 's3cretPass',
        );
        controller().updatePersonal(
          fullName: 'Nguyễn Văn A',
          phone: '0912345678',
        );
        acceptTermsDoc();

        await controller().submit();

        final sent = repository.lastRegisterCall;
        expect(sent, isNotNull);
        expect(sent!.email, 'camper@example.com');
        expect(sent.phone, '0912345678');
        expect(sent.password, 's3cretPass');
        expect(sent.role, UserRole.camper);
        expect(sent.fullName, 'Nguyễn Văn A');
        expect(repository.lastAcceptedTermsVersion, '1.0');
        expect(repository.lastHealthProfileConsent, isFalse);
      },
    );

    test(
      'sends optional healthProfileConsent = true when Camper explicitly opts in',
      () async {
        controller().selectRole(UserRole.camper);
        controller().updateAccount(
          email: 'camper@example.com',
          password: 's3cretPass',
        );
        controller().updatePersonal(
          fullName: 'Nguyễn Văn A',
          phone: '0912345678',
        );
        acceptTermsDoc();
        controller().setHealthProfileConsent(true);

        await controller().submit();

        expect(repository.lastAcceptedTermsVersion, '1.0');
        expect(repository.lastHealthProfileConsent, isTrue);
      },
    );

    test('on success, stores registerResult and clears isSubmitting', () async {
      controller().selectRole(UserRole.porter);
      controller().updateAccount(
        email: 'porter@example.com',
        password: 's3cretPass',
      );
      controller().updatePersonal(fullName: 'Trần Thị B', phone: '0987654321');
      acceptTermsDoc();

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
      controller().updateAccount(
        email: 'dup@example.com',
        password: 's3cretPass',
      );
      controller().updatePersonal(fullName: 'Lê Văn C', phone: '0911111111');
      acceptTermsDoc();

      await controller().submit();

      expect(state().isSubmitting, isFalse);
      expect(state().registerResult, isNull);
      expect(state().submitError, isNotNull);
    });

    test(
      'on 409 TERMS_VERSION_OUTDATED resets agreedToTermsDocument and keeps form data',
      () async {
        repository.failure = ApiException(
          'Conflict',
          statusCode: 409,
          errorData: {
            'statusCode': 409,
            'code': termsVersionOutdatedCode,
            'currentVersion': '1.1',
          },
          kind: ApiExceptionKind.response,
        );
        controller().selectRole(UserRole.camper);
        controller().updateAccount(
          email: 'outdated@example.com',
          password: 's3cretPass',
        );
        controller().updatePersonal(
          fullName: 'Lê Văn C',
          phone: '0911111111',
        );
        acceptTermsDoc();

        await controller().submit();

        expect(state().agreedToTermsDocument, isFalse);
        expect(state().data.email, 'outdated@example.com');
        expect(state().submitError?.status, 409);
        expect(state().submitError?.message, contains('phiên bản mới'));
      },
    );

    test(
      'normalizes email (trim + lowercase) before sending, phone trimmed only',
      () async {
        controller().selectRole(UserRole.camper);
        controller().updateAccount(
          email: '  Camper@Example.COM  ',
          password: 's3cretPass',
        );
        controller().updatePersonal(
          fullName: 'Nguyễn Văn A',
          phone: '  0912345678  ',
        );
        acceptTermsDoc();

        await controller().submit();

        final sent = repository.lastRegisterCall;
        expect(sent!.email, 'camper@example.com');
        expect(sent.phone, '0912345678');
      },
    );

    test(
      'a 409 duplicate-account error surfaces its message with no fieldErrors',
      () async {
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
        controller().updateAccount(
          email: 'dup@example.com',
          password: 's3cretPass',
        );
        controller().updatePersonal(fullName: 'Lê Văn C', phone: '0911111111');
        acceptTermsDoc();

        await controller().submit();

        final error = state().submitError;
        expect(error, isNotNull);
        expect(error!.status, 409);
        expect(error.message, 'Email or phone already registered');
        expect(error.fieldErrors, isNull);
      },
    );

    test(
      'a 422 validation error surfaces fieldErrors parsed from errorData',
      () async {
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
        controller().updateAccount(
          email: 'camper@example.com',
          password: 's3cretPass',
        );
        controller().updatePersonal(
          fullName: 'Nguyễn Văn A',
          phone: 'not-a-phone',
        );
        acceptTermsDoc();

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
      },
    );

    test(
      'offline/timeout errors are passed through with their ApiClient-set message',
      () async {
        repository.failure = ApiException(
          'Không có kết nối mạng. Vui lòng kiểm tra và thử lại.',
          kind: ApiExceptionKind.network,
        );
        controller().selectRole(UserRole.camper);
        controller().updateAccount(
          email: 'camper@example.com',
          password: 's3cretPass',
        );
        controller().updatePersonal(
          fullName: 'Nguyễn Văn A',
          phone: '0912345678',
        );
        acceptTermsDoc();

        await controller().submit();

        expect(
          state().submitError!.message,
          'Không có kết nối mạng. Vui lòng kiểm tra và thử lại.',
        );
      },
    );

    test(
      'a second concurrent submit while one is in flight is a no-op (BR-241 guard)',
      () async {
        final gate = Completer<RegisterResult>();
        var callCount = 0;
        repository.registerOverride = (data) {
          callCount++;
          return gate.future;
        };
        controller().selectRole(UserRole.camper);
        controller().updateAccount(
          email: 'camper@example.com',
          password: 's3cretPass',
        );
        controller().updatePersonal(
          fullName: 'Nguyễn Văn A',
          phone: '0912345678',
        );
        acceptTermsDoc();

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
      },
    );
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
      controller().goNext();
      expect(state().step, RegisterStep.verification);

      controller().goBack();
      expect(state().step, RegisterStep.personal);
    });
  });
}
