import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/data/auth_api.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/domain/user_role.dart';
import 'package:mobile/features/auth/presentation/verify_screen.dart';

/// Same "record calls, only override what's under test" pattern as
/// verify_otp_controller_test.dart's `_RecordingAuthRepository` -- this
/// screen test's job is proving the *composition* (Step 3), not
/// re-deriving Step 2's controller-level guarantees.
class _RecordingAuthRepository extends AuthRepository {
  _RecordingAuthRepository()
    : super(
        AuthApi(ApiClient(TokenStorage(const FlutterSecureStorage()))),
        TokenStorage(const FlutterSecureStorage()),
      );

  final List<({String userId, OtpChannel channel})> sendCalls = [];
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
  Future<RegisterResult> resendOtp({required String userId, required OtpChannel channel}) =>
      sendOtp(userId: userId, channel: channel);

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

const _account = RegisterResult(
  id: 'user-1',
  email: 'camper@example.com',
  phone: '0912345678',
  role: UserRole.camper,
  status: 'pending_verification',
);

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 200; i++) {
    await tester.pump(const Duration(milliseconds: 1));
  }
}

/// The screen's SingleChildScrollView lays out every child eagerly (unlike
/// a lazy CustomScrollView/ListView), so nothing here needs the sliver-
/// scrolling dance Step 5 of Search Campsites needed -- a plain
/// `ensureVisible` is enough to bring an off-screen-in-the-test-viewport
/// button into tappable range, same convention as widget_test.dart's
/// `_tapVisible`.
Future<void> _tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await tester.pump();
}

Widget _app(_RecordingAuthRepository repository) {
  final router = GoRouter(
    initialLocation: '/verify',
    routes: [
      GoRoute(path: '/verify', builder: (context, state) => const VerifyScreen(account: _account)),
      GoRoute(path: '/login', builder: (context, state) => const Scaffold(body: Text('LOGIN_SCREEN'))),
    ],
  );
  return ProviderScope(
    overrides: [authRepositoryProvider.overrideWithValue(repository)],
    child: MaterialApp.router(routerConfig: router),
  );
}

/// Common setup shared by most tests below: pick a channel and send the
/// first code.
Future<void> _selectChannelAndSend(WidgetTester tester, String channelLabel) async {
  await _tapVisible(tester, find.text(channelLabel));
  await _tapVisible(tester, find.text('Gửi mã OTP'));
  await _settle(tester);
}

void main() {
  group('VerifyScreen', () {
    testWidgets('renders the account context and both channel options', (tester) async {
      await tester.pumpWidget(_app(_RecordingAuthRepository()));

      expect(find.text('Xác minh tài khoản của bạn'), findsOneWidget);
      expect(find.text('camper@example.com'), findsWidgets); // account summary row + channel destination
      expect(find.text('0912345678'), findsWidgets);
      expect(find.text('Xác minh qua SĐT'), findsOneWidget);
      expect(find.text('Xác minh qua Email'), findsOneWidget);
    });

    testWidgets('the OTP field and Verify button start disabled, Send disabled until a channel is chosen', (
      tester,
    ) async {
      await tester.pumpWidget(_app(_RecordingAuthRepository()));

      final otpField = tester.widget<TextField>(find.byType(TextField));
      expect(otpField.enabled, isFalse);

      final sendButton = tester.widget<OutlinedButton>(find.byType(OutlinedButton).last);
      expect(sendButton.onPressed, isNull);

      final verifyButton = tester.widget<ElevatedButton>(find.byType(ElevatedButton).last);
      expect(verifyButton.onPressed, isNull);
    });

    testWidgets('selecting Email then sending calls sendOtp with that channel, then enables the OTP field', (
      tester,
    ) async {
      final repository = _RecordingAuthRepository();
      await tester.pumpWidget(_app(repository));

      await _selectChannelAndSend(tester, 'Xác minh qua Email');

      expect(repository.sendCalls, hasLength(1));
      expect(repository.sendCalls.single.userId, 'user-1');
      expect(repository.sendCalls.single.channel, OtpChannel.email);

      final otpField = tester.widget<TextField>(find.byType(TextField));
      expect(otpField.enabled, isTrue);
      expect(find.textContaining('Mã OTP đã được gửi tới'), findsOneWidget);
      expect(find.textContaining('camper@example.com'), findsWidgets);
    });

    testWidgets('entering a code enables Verify, and a successful verify shows the success view', (
      tester,
    ) async {
      final repository = _RecordingAuthRepository();
      await tester.pumpWidget(_app(repository));

      await _selectChannelAndSend(tester, 'Xác minh qua SĐT');
      await tester.enterText(find.byType(TextField), '123456');
      await tester.pump();
      await _tapVisible(tester, find.text('Xác thực'));
      await _settle(tester);

      expect(repository.verifyCalls, hasLength(1));
      expect(repository.verifyCalls.single.code, '123456');
      expect(find.text('Xác thực thành công!'), findsOneWidget);
    });

    testWidgets('a send failure shows the backend error message, not a generic one', (tester) async {
      final repository = _RecordingAuthRepository()
        ..sendFailure = ApiException('Resend limit reached', statusCode: 409);
      await tester.pumpWidget(_app(repository));

      await _selectChannelAndSend(tester, 'Xác minh qua Email');

      expect(find.text('Resend limit reached'), findsOneWidget);
    });

    testWidgets('a verify failure shows the backend error and never renders the success view', (
      tester,
    ) async {
      final repository = _RecordingAuthRepository()
        ..verifyFailure = ApiException('Incorrect or expired OTP', statusCode: 409);
      await tester.pumpWidget(_app(repository));

      await _selectChannelAndSend(tester, 'Xác minh qua Email');
      await tester.enterText(find.byType(TextField), '000000');
      await tester.pump();
      await _tapVisible(tester, find.text('Xác thực'));
      await _settle(tester);

      expect(find.text('Incorrect or expired OTP'), findsOneWidget);
      expect(find.text('Xác thực thành công!'), findsNothing);
    });

    testWidgets('tapping "Đến trang đăng nhập ngay" on the success view navigates to /login immediately', (
      tester,
    ) async {
      final repository = _RecordingAuthRepository();
      await tester.pumpWidget(_app(repository));

      await _selectChannelAndSend(tester, 'Xác minh qua Email');
      await tester.enterText(find.byType(TextField), '123456');
      await tester.pump();
      await _tapVisible(tester, find.text('Xác thực'));
      await _settle(tester);

      await _tapVisible(tester, find.text('Đến trang đăng nhập ngay'));
      await _settle(tester);

      expect(find.text('LOGIN_SCREEN'), findsOneWidget);
    });

    testWidgets('"Quay lại đăng nhập" navigates to /login without ever sending or verifying', (
      tester,
    ) async {
      final repository = _RecordingAuthRepository();
      await tester.pumpWidget(_app(repository));

      await _tapVisible(tester, find.text('Quay lại đăng nhập'));
      await _settle(tester);

      expect(find.text('LOGIN_SCREEN'), findsOneWidget);
      expect(repository.sendCalls, isEmpty);
      expect(repository.verifyCalls, isEmpty);
    });
  });
}
