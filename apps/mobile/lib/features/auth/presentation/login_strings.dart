/// All copy for the login screen, gathered in one place ahead of i18n.
/// Wording is a copy-edited pass over `docs/design/FIGMA-SCREEN-INVENTORY.md`
/// §A.2 (hero headline/footer, welcome title/subtitle) — see
/// `login_screen.dart` for the two Figma elements with no mobile equivalent
/// (home link, social auth) and why.
class LoginStrings {
  LoginStrings._();

  static const heroHeadline = 'Sẵn sàng cho chuyến đi tiếp theo';
  static const heroFeatures = [
    'Bản đồ ngoại tuyến',
    'Cảnh báo thời tiết',
    'Trợ lý AI',
    'Theo dõi GPS',
  ];
  static const heroFooter = 'Quản lý hành trình an toàn & thông minh';

  static const welcomeTitle = 'Chào mừng trở lại!';
  static const welcomeSubtitle = 'Đăng nhập để tiếp tục khám phá.';

  static const emailLabel = 'Email hoặc Số điện thoại';
  static const emailError = 'Nhập email hoặc số điện thoại hợp lệ';
  static const passwordLabel = 'Mật khẩu';
  static const passwordError = 'Mật khẩu tối thiểu 6 ký tự';

  static const rememberMe = 'Ghi nhớ';
  static const forgotPassword = 'Quên mật khẩu?';
  static const comingSoon = 'Tính năng đang được phát triển';

  static const submit = 'Đăng nhập →';
  static const createAccount = 'Đăng ký tài khoản mới';
  static const orSignInWith = 'Hoặc đăng nhập bằng';
  static const google = 'Google';
  static const lark = 'Lark';
  static const noAccountYet = 'Bạn chưa có tài khoản?';
  static const registerNow = 'Đăng ký ngay';

  static const loginErrorTitle = 'Không thể đăng nhập';

  /// Backend (CTMS-03-T01, services/api) only distinguishes 2 login-failure
  /// cases at the message level: "Invalid credentials" (unknown identifier
  /// OR wrong password — deliberately the same message for both, so a
  /// caller can't tell which one to enumerate accounts) and "Account is not
  /// active" (covers pending_verification/suspended/deleted alike — no
  /// separate "locked" vs "inactive" vs "unverified" copy exists server-side
  /// to map to). Any other error (network, timeout, unexpected 4xx/5xx)
  /// falls through to [genericError].
  static const invalidCredentials = 'Email/số điện thoại hoặc mật khẩu không chính xác.';
  static const accountNotActive =
      'Tài khoản của bạn chưa được kích hoạt hoặc đã bị khoá. Vui lòng xác minh tài khoản.';
  static const genericError = 'Đăng nhập thất bại. Vui lòng thử lại.';

  static const verifyAccountAction = 'Xác minh tài khoản';
}
