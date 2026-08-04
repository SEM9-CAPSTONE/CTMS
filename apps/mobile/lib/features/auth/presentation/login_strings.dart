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

  static String loginFailed(Object error) => 'Đăng nhập thất bại: $error';
}
