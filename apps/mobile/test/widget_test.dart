import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/app.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/data/auth_api.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/auth/domain/register_models.dart';
import 'package:mobile/features/auth/domain/user_role.dart';
import 'package:mobile/features/auth/presentation/widgets/register_date_of_birth_field.dart';

/// Avoids touching the flutter_secure_storage platform channel (unavailable
/// under flutter_test) and the network — [login]/[register] return
/// [loginResult] directly instead of calling the (stubbed) backend.
class _FakeAuthRepository extends AuthRepository {
  _FakeAuthRepository({this.loginResult})
    : super(
        AuthApi(ApiClient(TokenStorage(const FlutterSecureStorage()))),
        TokenStorage(const FlutterSecureStorage()),
      );

  final AuthUser? loginResult;

  @override
  Future<AuthUser?> tryRestoreSession() async => null;

  @override
  Future<AuthUser> login({required String email, required String password}) async {
    final user = loginResult;
    if (user == null) throw ApiException('Sai email hoặc mật khẩu');
    return user;
  }

  @override
  Future<AuthUser> register(RegisterFormData data) async {
    final user = loginResult;
    if (user == null) throw ApiException('Không thể đăng ký');
    return user;
  }

  @override
  Future<void> logout() async {}
}

Future<void> _tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> _login(WidgetTester tester, AuthUser user) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(_FakeAuthRepository(loginResult: user)),
      ],
      child: const CtmsApp(),
    ),
  );
  await tester.pumpAndSettle();

  await tester.enterText(find.byType(TextFormField).at(0), user.email);
  await tester.enterText(find.byType(TextFormField).at(1), 'password123');
  await tester.tap(find.widgetWithText(ElevatedButton, 'Đăng nhập →'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('unauthenticated users land on the login screen', (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(_FakeAuthRepository())],
        child: const CtmsApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('CTMS'), findsOneWidget);
    expect(find.widgetWithText(ElevatedButton, 'Đăng nhập →'), findsOneWidget);
  });

  testWidgets('camper lands on the overview tab and can switch tabs', (
    WidgetTester tester,
  ) async {
    await _login(
      tester,
      const AuthUser(id: '1', fullName: 'Minh Trần', email: 'camper@ctms.dev', role: UserRole.camper),
    );

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('Tổng quan'), findsWidgets);

    // The real "Tổng quan — Camper Hub" screen — greeting, trip card,
    // weather, transactions and suggestions all render from the mock
    // repository via camperOverviewProvider. That fetch is a plain
    // `Future.delayed` with no animating widget behind it while it's
    // pending, so pumpAndSettle (which stops as soon as nothing schedules
    // a new frame) returns immediately without giving the timer a chance
    // to fire — pump an explicit duration instead.
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump();
    expect(find.textContaining('Trần!'), findsOneWidget);
    expect(find.text('Thông báo quan trọng'), findsOneWidget);
    expect(find.text('Chuyến đi sắp tới'), findsOneWidget);

    // Scroll down to confirm the rest of the screen (weather, transactions,
    // suggestions) assembles without error too.
    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(find.text('Giao dịch gần đây'), 300, scrollable: scrollable);
    expect(find.text('Giao dịch gần đây'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Gợi ý dành cho bạn'),
      300,
      scrollable: scrollable,
    );
    expect(find.text('Gợi ý dành cho bạn'), findsOneWidget);

    await tester.tap(find.text('Khám phá'));
    await tester.pumpAndSettle();

    expect(find.text('Khám phá khu cắm trại'), findsOneWidget);
  });

  testWidgets('porter "Thêm" sheet opens the folded-in destinations', (WidgetTester tester) async {
    await _login(
      tester,
      const AuthUser(id: '2', fullName: 'Anh Minh', email: 'porter@ctms.dev', role: UserRole.porter),
    );

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('Lịch'), findsOneWidget);

    await tester.tap(find.text('Thêm'));
    await tester.pumpAndSettle();

    expect(find.text('Thành viên đoàn'), findsOneWidget);
    expect(find.text('Sự cố'), findsOneWidget);
    expect(find.text('Hồ sơ & cài đặt'), findsOneWidget);
  });

  testWidgets('porter completes registration and sees the pending-review notice', (
    WidgetTester tester,
  ) async {
    const newUser = AuthUser(
      id: '3',
      fullName: 'Tân Porter',
      email: 'newporter@ctms.dev',
      role: UserRole.porter,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(_FakeAuthRepository(loginResult: newUser)),
        ],
        child: const CtmsApp(),
      ),
    );
    await tester.pumpAndSettle();

    // Login -> Register.
    await _tapVisible(tester, find.widgetWithText(OutlinedButton, 'Đăng ký tài khoản mới'));
    expect(find.text('Tham gia CTMS'), findsOneWidget);

    // Step 1 — Vai trò.
    await _tapVisible(tester, find.text('Porter'));
    await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Tiếp tục'));

    // Step 2 — Tài khoản: Email + Mật khẩu + Xác nhận mật khẩu.
    expect(find.text('Thông tin tài khoản'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).at(0), newUser.email);
    await tester.enterText(find.byType(TextFormField).at(1), 'password123');
    await tester.enterText(find.byType(TextFormField).at(2), 'password123');
    await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Tiếp tục'));

    // Step 3 — Thông tin cá nhân & xác thực: họ tên, ngày sinh (date
    // picker), giới tính, rồi xác thực số điện thoại qua OTP. Không còn
    // CCCD/OCR — chỉ field của bảng users.
    expect(find.text('Thông tin cá nhân & xác thực'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).at(0), newUser.fullName);

    await _tapVisible(tester, find.byType(RegisterDateOfBirthField));
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nam'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(1), '0912345678');
    await _tapVisible(tester, find.widgetWithText(OutlinedButton, 'Gửi mã OTP'));
    await tester.enterText(find.byType(TextFormField).at(2), '123456');
    await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Xác thực'));
    expect(find.text('Đã xác thực số điện thoại'), findsOneWidget);

    await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Tiếp tục'));

    // Step 4 — Nghiệp vụ (Porter): experience, district select, then the
    // campsite multi-select that only appears once a district is chosen.
    expect(find.text('Kinh nghiệm & phạm vi hỗ trợ'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).at(0), '5');
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Đức Trọng (Tà Năng), Lâm Đồng'));
    await tester.pumpAndSettle();
    expect(find.text('Địa điểm có thể dẫn đoàn'), findsOneWidget);
    await _tapVisible(tester, find.text('Bãi Đá Đen'));
    await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Tiếp tục'));

    // Step 5 — Xác nhận đăng ký: recap theo 3 nhóm + accuracy checkbox.
    expect(find.text('Xác nhận đăng ký'), findsOneWidget);
    expect(find.text('Đức Trọng (Tà Năng), Lâm Đồng'), findsOneWidget);
    expect(find.textContaining('Bãi Đá Đen'), findsOneWidget);
    expect(find.text('Nam'), findsOneWidget);
    await _tapVisible(tester, find.byType(Checkbox));
    await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Gửi hồ sơ'));

    // Porter applications are pending Host review — no auto sign-in.
    expect(find.text('Hồ sơ đã được gửi'), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);

    await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Về Trang chủ'));
    expect(find.text('CTMS'), findsOneWidget);
  });
}
