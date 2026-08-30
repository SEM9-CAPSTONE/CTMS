/// Copy for `/verify` — CTMS-02 [Mobile] wires the real send-otp/resend/
/// verify flow into this screen, matching Web's copy
/// (apps/web/src/features/auth/pages/VerifyOtpPage.tsx) so both clients
/// read the same to a Camper switching platforms.
class VerifyStrings {
  VerifyStrings._();

  static const appBarTitle = 'Xác minh tài khoản';
  static const title = 'Xác minh tài khoản của bạn';
  static const subtitle = 'Chúng tôi sẽ gửi mã xác minh đến địa chỉ bên dưới.';
  static const emailLabel = 'Email';
  static const phoneLabel = 'Số điện thoại';
  static const otpLabel = 'Mã OTP';
  static const otpHint = 'Nhập mã OTP';
  static const sendOtp = 'Gửi mã OTP';
  static const resendOtp = 'Gửi lại mã';
  static const sending = 'Đang gửi...';
  static const verify = 'Xác thực';
  static const verifying = 'Đang xác minh...';
  static const backToLogin = 'Quay lại đăng nhập';

  static const channelPhoneLabel = 'Xác minh qua SĐT';
  static const channelEmailLabel = 'Xác minh qua Email';
  static const chooseChannelHint = 'Chọn phương thức nhận mã OTP, sau đó bấm "Gửi mã OTP"';
  static const sentCodeToPrefix = 'Mã OTP đã được gửi tới ';

  static const verifySuccessTitle = 'Xác thực thành công!';
  static const verifySuccessMessage =
      'Tài khoản của bạn đã được kích hoạt. Đang chuyển đến trang đăng nhập...';
  static const goToLoginNow = 'Đến trang đăng nhập ngay';
}
