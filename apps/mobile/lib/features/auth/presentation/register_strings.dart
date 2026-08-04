/// All copy for `/register`, gathered ahead of i18n. Wording follows
/// `docs/design/FIGMA-SCREEN-INVENTORY.md` §A.3 where it gives literal
/// copy (title, role descriptions); everything else — field copy, the
/// Porter personal-info/phone-verification flow, the post-submit notice —
/// was re-specified against CTMS's actual role/approval/database business
/// rules rather than the Figma frame, which predates them.
class RegisterStrings {
  RegisterStrings._();

  static const appBarTitle = 'Tham gia CTMS';
  static const stepLabels = ['Vai trò', 'Tài khoản', 'Danh tính', 'Nghiệp vụ', 'Xác minh'];

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

  // Step 3 (Trekker) — Cá nhân. Không đổi so với bản trước.
  static const personalStepTitle = 'Thông tin cá nhân';
  static const personalStepSubtitle = 'Giúp chúng tôi biết bạn rõ hơn.';
  static const fullNameLabel = 'Họ và tên';
  static const fullNameError = 'Nhập họ và tên';
  static const phoneLabel = 'Số điện thoại';
  static const phoneError = 'Nhập số điện thoại hợp lệ';

  // Step 3 (Porter) — Thông tin cá nhân & xác thực: họ tên, ngày sinh,
  // giới tính, rồi xác thực số điện thoại qua OTP. Chỉ dùng field có trong
  // bảng users — không CCCD/OCR/selfie/emergency-contact/avatar lúc đăng
  // ký (avatar cập nhật sau ở Hồ sơ cá nhân).
  static const personalVerificationStepTitle = 'Thông tin cá nhân & xác thực';
  static const personalVerificationStepSubtitle =
      'Hoàn thiện thông tin để Host có thể xét duyệt hồ sơ của bạn.';
  static const dateOfBirthLabel = 'Ngày sinh';
  static const dateOfBirthError = 'Chọn ngày sinh';
  static const genderLabel = 'Giới tính';
  static const genderError = 'Chọn giới tính';
  static const genderOptions = ['Nam', 'Nữ', 'Khác'];
  static const sendOtp = 'Gửi mã OTP';
  static const resendOtp = 'Gửi lại mã';
  static const otpLabel = 'Mã OTP';
  static const otpHint = 'Demo: nhập mã 123456 để xác thực (chưa nối SMS thật).';
  static const verifyOtp = 'Xác thực';
  static const phoneVerifiedLabel = 'Đã xác thực số điện thoại';

  // Step 4 (Porter) — Kinh nghiệm & phạm vi hỗ trợ.
  static const camperProfileStepTitle = 'Hồ sơ an toàn';
  static const camperProfileStepSubtitle =
      'Không bắt buộc — giúp Porter hỗ trợ bạn tốt hơn khi có sự cố.';
  static const bloodTypeLabel = 'Nhóm máu';
  static const fitnessLevelLabel = 'Mức độ thể lực';
  static const emergencyContactNameLabel = 'Người liên hệ khẩn cấp';
  static const emergencyContactPhoneLabel = 'SĐT người liên hệ khẩn cấp';

  static const porterProfileStepTitle = 'Kinh nghiệm & phạm vi hỗ trợ';
  static const porterProfileStepSubtitle = 'Giúp Host hiểu rõ khu vực bạn có thể dẫn đoàn.';
  static const experienceYearsLabel = 'Số năm kinh nghiệm';
  static const experienceYearsError = 'Nhập số năm hợp lệ';
  static const operatingDistrictLabel = 'Quận/Huyện mong muốn công tác';
  static const operatingDistrictError = 'Chọn quận/huyện mong muốn công tác';
  static const campsiteMultiSelectLabel = 'Địa điểm có thể dẫn đoàn';
  static const campsiteMultiSelectHelper = 'Bạn có thể chọn nhiều địa điểm mà mình thông thạo.';
  static const campsiteEmptyForDistrict =
      'Hiện chưa có địa điểm do Host quản lý tại khu vực này.';
  static const certificationCodeLabel = 'Chứng chỉ chuyên môn (không bắt buộc)';
  static const certificationCodeHint = 'Ví dụ: Chứng chỉ hướng dẫn viên, sơ cứu...';
  static const certificationCodeHelper = 'Bạn có thể để trống và bổ sung sau.';

  // Step 5 — Xác nhận đăng ký.
  static const verificationStepTitle = 'Xác nhận đăng ký';
  static const verificationStepSubtitle = 'Kiểm tra lại toàn bộ thông tin trước khi gửi.';
  static const accountSectionTitle = 'Thông tin tài khoản';
  static const personalSectionTitle = 'Thông tin cá nhân';
  static const professionalSectionTitle = 'Thông tin nghiệp vụ';
  static const phoneVerifiedSuffix = ' (Đã xác thực)';
  static const termsLabel = 'Tôi xác nhận các thông tin trên là chính xác.';
  static const submit = 'Hoàn tất đăng ký';
  static const submitApplication = 'Gửi hồ sơ';
  static const submitErrorTitle = 'Không thể hoàn tất đăng ký';
  static const submitApplicationErrorTitle = 'Không thể gửi hồ sơ';

  static const back = 'Quay lại';
  static const continueLabel = 'Tiếp tục';
  static const alreadyHaveAccount = 'Bạn đã có tài khoản?';
  static const loginNow = 'Đăng nhập ngay';

  // Sau khi Porter gửi hồ sơ — không tự đăng nhập, hồ sơ chờ Host duyệt.
  static const submittedTitle = 'Hồ sơ đã được gửi';
  static const submittedMessage =
      'Hồ sơ Porter của bạn đã được gửi đến Host để xét duyệt.\n'
      'Bạn sẽ nhận được thông báo sau khi Host xem xét hồ sơ.';
  static const backToHome = 'Về Trang chủ';

  static String registerFailed(Object error) => 'Đăng ký thất bại: $error';
}
