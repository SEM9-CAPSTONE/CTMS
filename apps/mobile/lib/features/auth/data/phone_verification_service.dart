import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Mocked OTP pipeline behind Step 3's phone verification. Every method is
/// `async` and returns after a short simulated delay, matching the shape a
/// real provider would have — swap the bodies for Firebase Auth or an SMS
/// gateway later; [RegisterController] and [RegisterPhoneOtpSection] only
/// depend on this interface, so no UI change is needed when that happens.
class PhoneVerificationService {
  const PhoneVerificationService();

  /// Fixed so the flow is testable without a real SMS gateway — shown to
  /// the user as a hint since there's nothing to actually text them yet.
  static const mockOtpCode = '123456';

  Future<void> sendOtp(String phone) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    // TODO(api): Firebase Auth PhoneAuthProvider.verifyPhoneNumber, or
    // POST /auth/otp/send { phone }.
  }

  Future<bool> verifyOtp(String phone, String code) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    // TODO(api): confirm the Firebase Auth SMS code, or
    // POST /auth/otp/verify { phone, code }.
    return code.trim() == mockOtpCode;
  }
}

final phoneVerificationServiceProvider = Provider<PhoneVerificationService>((ref) {
  return const PhoneVerificationService();
});
