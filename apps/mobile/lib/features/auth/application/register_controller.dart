import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_repository.dart';
import '../data/phone_verification_service.dart';
import '../domain/register_models.dart';
import '../domain/user_role.dart';
import 'auth_controller.dart';

/// Wizard navigation + draft state for `/register` — distinct from
/// [AuthController], which only tracks the signed-in session. Hand-rolled
/// rather than freezed: it's controller-local UI state, not a shared domain
/// model.
class RegisterWizardState {
  const RegisterWizardState({
    this.step = RegisterStep.role,
    this.data = const RegisterFormData(),
    this.isSubmitting = false,
    this.submitError,
    this.isSubmitted = false,
    this.otpSent = false,
    this.isProcessingOtp = false,
    this.otpError,
  });

  final RegisterStep step;
  final RegisterFormData data;
  final bool isSubmitting;
  final Object? submitError;

  /// True once [submit] has succeeded — for Porter this means "application
  /// sent, pending Host review" (no session adopted, see [submit]); the
  /// screen swaps to the submitted notice instead of the wizard body.
  final bool isSubmitted;

  // Step 3 "Thông tin cá nhân & xác thực" (Porter) OTP process state —
  // transient, not part of [RegisterFormData] since none of it is data to
  // submit ([RegisterFormData.phoneVerifiedAt] is the actual result).
  final bool otpSent;
  final bool isProcessingOtp;
  final String? otpError;

  bool get isFirstStep => step == RegisterStep.role;
  bool get isLastStep => step == RegisterStep.verification;

  RegisterWizardState copyWith({
    RegisterStep? step,
    RegisterFormData? data,
    bool? isSubmitting,
    Object? submitError,
    bool clearError = false,
    bool? isSubmitted,
    bool? otpSent,
    bool? isProcessingOtp,
    String? otpError,
    bool clearOtpError = false,
  }) {
    return RegisterWizardState(
      step: step ?? this.step,
      data: data ?? this.data,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      submitError: clearError ? null : (submitError ?? this.submitError),
      isSubmitted: isSubmitted ?? this.isSubmitted,
      otpSent: otpSent ?? this.otpSent,
      isProcessingOtp: isProcessingOtp ?? this.isProcessingOtp,
      otpError: clearOtpError ? null : (otpError ?? this.otpError),
    );
  }
}

class RegisterController extends Notifier<RegisterWizardState> {
  @override
  RegisterWizardState build() => const RegisterWizardState();

  void selectRole(UserRole role) {
    state = state.copyWith(data: state.data.copyWith(role: role));
  }

  void updateAccount({required String email, required String password}) {
    state = state.copyWith(data: state.data.copyWith(email: email, password: password));
  }

  void updatePersonal({required String fullName, required String phone}) {
    state = state.copyWith(data: state.data.copyWith(fullName: fullName, phone: phone));
  }

  void updateCamperProfile({
    String? bloodType,
    String? fitnessLevel,
    String? emergencyContactName,
    String? emergencyContactPhone,
  }) {
    state = state.copyWith(
      data: state.data.copyWith(
        bloodType: bloodType,
        fitnessLevel: fitnessLevel,
        emergencyContactName: emergencyContactName,
        emergencyContactPhone: emergencyContactPhone,
      ),
    );
  }

  // --- Step 3 "Thông tin cá nhân & xác thực" (Porter) ---------------------

  void updateFullName(String fullName) {
    state = state.copyWith(data: state.data.copyWith(fullName: fullName));
  }

  void setDateOfBirth(DateTime value) {
    state = state.copyWith(data: state.data.copyWith(dateOfBirth: value));
  }

  void setGender(String value) {
    state = state.copyWith(data: state.data.copyWith(gender: value));
  }

  Future<void> sendOtp(String phone) async {
    if (phone.trim().isEmpty) return;
    state = state.copyWith(
      isProcessingOtp: true,
      clearOtpError: true,
      data: state.data.copyWith(phone: phone.trim()),
    );
    await ref.read(phoneVerificationServiceProvider).sendOtp(phone.trim());
    state = state.copyWith(isProcessingOtp: false, otpSent: true);
  }

  Future<void> verifyOtp(String code) async {
    state = state.copyWith(isProcessingOtp: true, clearOtpError: true);
    final isValid = await ref
        .read(phoneVerificationServiceProvider)
        .verifyOtp(state.data.phone, code);
    if (isValid) {
      state = state.copyWith(
        isProcessingOtp: false,
        data: state.data.copyWith(phoneVerifiedAt: DateTime.now()),
      );
    } else {
      state = state.copyWith(
        isProcessingOtp: false,
        otpError: 'Mã OTP không đúng, vui lòng thử lại.',
      );
    }
  }

  // --- Step 4 "Kinh nghiệm & phạm vi hỗ trợ" (Porter) ---------------------

  void updatePorterProfile({required int experienceYears, String? certificationCode}) {
    state = state.copyWith(
      data: state.data.copyWith(
        experienceYears: experienceYears,
        certificationCode: certificationCode,
      ),
    );
  }

  /// Picking a district invalidates any campsites chosen for the previous
  /// one — [RegisterFormData.preferredCampsiteIds] always refers to
  /// locations inside the *current* [RegisterFormData.operatingDistrictId].
  void setOperatingDistrict(String districtId) {
    state = state.copyWith(
      data: state.data.copyWith(operatingDistrictId: districtId, preferredCampsiteIds: const []),
    );
  }

  void toggleCampsite(String campsiteId) {
    final current = state.data.preferredCampsiteIds;
    final next = current.contains(campsiteId)
        ? current.where((id) => id != campsiteId).toList()
        : [...current, campsiteId];
    state = state.copyWith(data: state.data.copyWith(preferredCampsiteIds: next));
  }

  void setAcceptedTerms(bool value) {
    state = state.copyWith(data: state.data.copyWith(acceptedTerms: value));
  }

  void goNext() {
    if (state.isLastStep) return;
    state = state.copyWith(step: RegisterStep.values[state.step.index + 1], clearError: true);
  }

  void goBack() {
    if (state.isFirstStep) return;
    state = state.copyWith(step: RegisterStep.values[state.step.index - 1], clearError: true);
  }

  Future<void> submit() async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final user = await ref.read(authRepositoryProvider).register(state.data);
      if (state.data.role == UserRole.porter) {
        // Porter accounts start out pending Host review — the token is
        // saved (a real account now exists) but the app doesn't adopt the
        // session yet; the screen shows the "submitted" notice instead of
        // dropping straight into the Porter shell.
        state = state.copyWith(isSubmitting: false, isSubmitted: true);
      } else {
        ref.read(authControllerProvider.notifier).setSession(user);
        state = state.copyWith(isSubmitting: false, isSubmitted: true);
      }
    } catch (error) {
      state = state.copyWith(isSubmitting: false, submitError: error);
    }
  }
}

final registerControllerProvider = NotifierProvider<RegisterController, RegisterWizardState>(
  RegisterController.new,
);
