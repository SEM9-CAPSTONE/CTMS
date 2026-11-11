import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/application/verify_otp_controller.dart';
import 'package:mobile/features/auth/data/auth_api.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/domain/user_role.dart';

/// Same pattern as register_controller_test.dart's `_RecordingAuthRepository`
/// -- the real AuthApi/TokenStorage passed to `super` are never touched,
/// every method under test is fully overridden.
class _RecordingAuthRepository extends AuthRepository {
  _RecordingAuthRepository()
    : super(
        AuthApi(ApiClient(TokenStorage(const FlutterSecureStorage()))),
        TokenStorage(const FlutterSecureStorage()),
      );

  final List<({String userId, OtpChannel channel})> sendCalls = [];
  final List<({String userId, OtpChannel channel})> resendCalls = [];
  final List<({String userId, String code})> verifyCalls = [];

  Object? sendFailure;
  Object? verifyFailure;

  RegisterResult _result(String userId) => RegisterResult(
    id: userId,
    email: 'camper@example.com',
    phone: '0912345678',
    role: UserRole.camper,
    status: 'pending_verification',
  );

  @override
  Future<RegisterResult> sendOtp({required String userId, required OtpChannel channel}) async {
    sendCalls.add((userId: userId, channel: channel));
    if (sendFailure != null) {
      final err = sendFailure!;
      sendFailure = null;
      throw err;
    }
    return _result(userId);
  }

  @override
  Future<RegisterResult> resendOtp({required String userId, required OtpChannel channel}) async {
    resendCalls.add((userId: userId, channel: channel));
    if (sendFailure != null) {
      final err = sendFailure!;
      sendFailure = null;
      throw err;
    }
    return _result(userId);
  }

  @override
  Future<RegisterResult> verifyOtp({required String userId, required String code}) async {
    verifyCalls.add((userId: userId, code: code));
    if (verifyFailure != null) {
      final err = verifyFailure!;
      verifyFailure = null;
      throw err;
    }
    return _result(userId);
  }
}

void main() {
  late _RecordingAuthRepository repository;
  late ProviderContainer container;

  setUp(() {
    repository = _RecordingAuthRepository();
    container = ProviderContainer(overrides: [authRepositoryProvider.overrideWithValue(repository)]);
    addTearDown(container.dispose);
  });

  VerifyOtpController controller() => container.read(verifyOtpControllerProvider.notifier);
  VerifyOtpState state() => container.read(verifyOtpControllerProvider);

  group('VerifyOtpController.selectChannel', () {
    test('sets the selected channel', () {
      controller().selectChannel(OtpChannel.email);
      expect(state().selectedChannel, OtpChannel.email);
    });

    test('is a no-op while a send is in flight or the cooldown is running', () async {
      controller().selectChannel(OtpChannel.phone);
      // Kick off a send that stays "in flight" long enough to observe the guard --
      // simplest way here is to check the guard directly via countdown after a send.
      await controller().sendCode('user-1');
      expect(state().countdown, greaterThan(0));

      controller().selectChannel(OtpChannel.email);
      expect(state().selectedChannel, OtpChannel.phone); // unchanged -- guarded by countdown > 0
    });
  });

  group('VerifyOtpController.sendCode', () {
    test('is a no-op when no channel has been selected', () async {
      await controller().sendCode('user-1');
      expect(repository.sendCalls, isEmpty);
    });

    test('calls sendOtp (not resendOtp) on the first send, with the selected channel', () async {
      controller().selectChannel(OtpChannel.email);
      await controller().sendCode('user-1');

      expect(repository.sendCalls, hasLength(1));
      expect(repository.sendCalls.single.userId, 'user-1');
      expect(repository.sendCalls.single.channel, OtpChannel.email);
      expect(repository.resendCalls, isEmpty);
    });

    test('sets hasSentCode and starts a 60s countdown on success', () async {
      controller().selectChannel(OtpChannel.phone);
      await controller().sendCode('user-1');

      expect(state().hasSentCode, isTrue);
      expect(state().countdown, 60);
      expect(state().isSending, isFalse);
    });

    test('a later send once the cooldown has elapsed calls resendOtp, not sendOtp again', () async {
      controller().selectChannel(OtpChannel.email);
      await controller().sendCode('user-1');
      expect(repository.sendCalls, hasLength(1));

      // The 60s cooldown is a timer-driven UI-only affordance (real limit
      // is server-side, BR-007) -- simulate it having elapsed directly on
      // state rather than waiting real time or faking the clock, since the
      // routing decision (`hasSentCode` -> resend) is what this test cares
      // about, not the timer's own tick-down mechanics.
      controller().state = state().copyWith(countdown: 0);

      await controller().sendCode('user-1');

      expect(repository.sendCalls, hasLength(1)); // still just the first send
      expect(repository.resendCalls, hasLength(1));
      expect(repository.resendCalls.single.channel, OtpChannel.email);
    });

    test('does nothing while a send is already in flight (BR-241-style guard)', () async {
      controller().selectChannel(OtpChannel.email);
      final first = controller().sendCode('user-1');
      final second = controller().sendCode('user-1'); // fired before the first resolves
      await Future.wait([first, second]);

      expect(repository.sendCalls, hasLength(1));
    });

    test('propagates the backend error message on failure, not a generic one', () async {
      controller().selectChannel(OtpChannel.email);
      repository.sendFailure = ApiException('Resend limit reached', statusCode: 409);

      await controller().sendCode('user-1');

      expect(state().errorMessage, 'Resend limit reached');
      expect(state().hasSentCode, isFalse);
    });

    test('falls back to a Vietnamese generic message for a non-ApiException failure', () async {
      controller().selectChannel(OtpChannel.email);
      repository.sendFailure = Exception('network down');

      await controller().sendCode('user-1');

      expect(state().errorMessage, 'Gửi mã OTP thất bại. Vui lòng thử lại.');
    });
  });

  group('VerifyOtpController.verify', () {
    test('is a no-op when no code has been sent yet', () async {
      controller().setCode('123456');
      await controller().verify('user-1');
      expect(repository.verifyCalls, isEmpty);
    });

    test('calls verifyOtp with the entered code once a code has been sent', () async {
      controller().selectChannel(OtpChannel.email);
      await controller().sendCode('user-1');
      controller().setCode('123456');

      await controller().verify('user-1');

      expect(repository.verifyCalls, hasLength(1));
      expect(repository.verifyCalls.single.code, '123456');
      expect(state().verifySuccess, isTrue);
    });

    test('a failure leaves the entered code untouched (BR-242) and does not set verifySuccess', () async {
      controller().selectChannel(OtpChannel.email);
      await controller().sendCode('user-1');
      controller().setCode('000000');
      repository.verifyFailure = ApiException('Incorrect or expired OTP', statusCode: 409);

      await controller().verify('user-1');

      expect(state().code, '000000');
      expect(state().verifySuccess, isFalse);
      expect(state().errorMessage, 'Incorrect or expired OTP');
    });

    test('does nothing while a verify is already in flight (BR-241-style guard)', () async {
      controller().selectChannel(OtpChannel.email);
      await controller().sendCode('user-1');
      controller().setCode('123456');

      final first = controller().verify('user-1');
      final second = controller().verify('user-1');
      await Future.wait([first, second]);

      expect(repository.verifyCalls, hasLength(1));
    });
  });
}
