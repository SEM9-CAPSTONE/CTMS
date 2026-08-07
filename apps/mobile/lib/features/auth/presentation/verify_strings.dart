/// Copy for `/verify` — CTMS-01-T03 scope only builds the screen shell
/// (layout, account context, disabled controls) so the Register → Verify
/// navigation exists and is testable. CTMS-02 [Mobile] wires the real
/// send-otp/verify controller into this same screen — see VerifyScreen's
/// class doc.
class VerifyStrings {
  VerifyStrings._();

  static const appBarTitle = 'Xác minh tài khoản';
  static const title = 'Xác minh tài khoản của bạn';
  static const subtitle = 'Chúng tôi sẽ gửi mã xác minh đến địa chỉ bên dưới.';
  static const emailLabel = 'Email';
  static const phoneLabel = 'Số điện thoại';
  static const otpLabel = 'Mã OTP';
  static const otpHint = 'Nhập mã 6 số';
  static const sendOtp = 'Gửi mã OTP';
  static const resendOtp = 'Gửi lại mã';
  static const verify = 'Xác thực';
  static const comingSoonNotice =
      'Chức năng gửi và xác thực mã OTP sẽ được triển khai ở CTMS-02.';
  static const backToLogin = 'Quay lại đăng nhập';
}
