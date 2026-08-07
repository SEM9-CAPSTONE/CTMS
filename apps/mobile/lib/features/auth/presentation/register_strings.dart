/// All copy for `/register`, gathered ahead of i18n. Wording follows
/// `docs/design/FIGMA-SCREEN-INVENTORY.md` §A.3 where it gives literal
/// copy (title, role descriptions); everything else — field copy, the
/// Porter personal-info/phone-verification flow, the post-submit notice —
/// was re-specified against CTMS's actual role/approval/database business
/// rules rather than the Figma frame, which predates them.
class RegisterStrings {
  RegisterStrings._();

  static const appBarTitle = 'Tham gia CTMS';
  static const stepLabels = ['Vai trò', 'Tài khoản', 'Danh tính', 'Xác nhận'];

  // Step 1 — Vai trò. Host is dropped: it's a web-only role
  // (core/router/app_router.dart bounces Host/Admin back to /login).
  static const roleStepTitle = 'Chào bạn, bạn là ai?';
  static const camperTitle = 'Trekker';
  static const camperDescription =
      'Yêu thiên nhiên, muốn khám phá và trải nghiệm các chuyến trekking.';
  static const camperBenefits = [
    'Đặt chỗ campsite & tuyến trekking nhanh chóng',
    'Bản đồ ngoại tuyến & trợ lý AI đồng hành',
  ];
  static const porterTitle = 'Porter';
  static const porterDescription = 'Người dẫn đường (Guide), hỗ trợ dẫn đoàn trekking/camping.';
  static const porterBadge = 'CẦN MÃ MỜI/XÁC MINH';
  static const porterBenefits = [
    'Nhận phân công dẫn đoàn phù hợp kinh nghiệm',
    'Quản lý lịch trình & báo cáo sự cố tại hiện trường',
  ];

  // Step 2 — Tài khoản. Số điện thoại được xác thực OTP riêng ở bước 3
  // (Porter) nên không lặp lại ở đây.
  static const accountStepTitle = 'Thông tin tài khoản';
  static const accountStepSubtitle = 'Đây sẽ là thông tin bạn dùng để đăng nhập.';
  static const emailLabel = 'Email';
  static const emailError = 'Nhập email hợp lệ';
  static const passwordLabel = 'Mật khẩu';
  static const passwordError = 'Mật khẩu tối thiểu 6 ký tự';
  static const confirmPasswordLabel = 'Xác nhận mật khẩu';
  static const confirmPasswordError = 'Mật khẩu xác nhận không khớp';

  // Step 3 — Cá nhân. Same fields for both Camper and Porter now — the
  // previous Porter-only in-wizard phone-OTP step and the extra
  // profile/professional step (Step 4) were removed; see register_models.dart.
  static const personalStepTitle = 'Thông tin cá nhân';
  static const personalStepSubtitle = 'Giúp chúng tôi biết bạn rõ hơn.';
  static const fullNameLabel = 'Họ và tên';
  static const fullNameError = 'Nhập họ và tên';
  static const phoneLabel = 'Số điện thoại';
  static const phoneError = 'Nhập số điện thoại hợp lệ';

  // Step 4 — Xác nhận đăng ký.
  static const verificationStepTitle = 'Xác nhận đăng ký';
  static const verificationStepSubtitle = 'Kiểm tra lại toàn bộ thông tin trước khi gửi.';
  static const accountSectionTitle = 'Thông tin tài khoản';
  static const personalSectionTitle = 'Thông tin cá nhân';
  static const termsLabel = 'Tôi xác nhận các thông tin trên là chính xác.';
  static const submit = 'Hoàn tất đăng ký';
  static const submitErrorTitle = 'Không thể hoàn tất đăng ký';

  static const back = 'Quay lại';
  static const continueLabel = 'Tiếp tục';
  static const alreadyHaveAccount = 'Bạn đã có tài khoản?';
  static const loginNow = 'Đăng nhập ngay';

  static String registerFailed(Object error) => 'Đăng ký thất bại: $error';
}
