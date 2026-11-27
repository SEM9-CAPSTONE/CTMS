import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../terms/application/terms_providers.dart';
import '../../terms/domain/terms_models.dart';
import '../data/auth_api.dart';
import '../data/auth_repository.dart';
import '../domain/register_models.dart';
import '../domain/user_role.dart';
import '../presentation/register_strings.dart';

class RegisterFieldError {
  const RegisterFieldError({required this.field, required this.errors});

  final String field;
  final List<String> errors;
}

class RegisterSubmitError {
  const RegisterSubmitError({
    this.status,
    required this.message,
    this.fieldErrors,
  });

  final int? status;
  final String message;
  final List<RegisterFieldError>? fieldErrors;
}

RegisterSubmitError _toRegisterSubmitError(Object error) {
  if (error is ApiException) {
    List<RegisterFieldError>? fieldErrors;
    final data = error.errorData;
    if (data is Map && data['message'] is List) {
      fieldErrors = (data['message'] as List)
          .whereType<Map>()
          .map(
            (item) => RegisterFieldError(
              field: item['field']?.toString() ?? '',
              errors: (item['errors'] as List? ?? const [])
                  .map((e) => e.toString())
                  .toList(),
            ),
          )
          .toList();
    }
    return RegisterSubmitError(
      status: error.statusCode,
      message: error.message,
      fieldErrors: fieldErrors,
    );
  }
  return const RegisterSubmitError(
    message: 'Đăng ký thất bại. Vui lòng thử lại.',
  );
}

class RegisterWizardState {
  const RegisterWizardState({
    this.step = RegisterStep.role,
    this.data = const RegisterFormData(),
    this.agreedToTermsDocument = false,
    this.healthProfileConsent = false,
    this.acceptedTermsVersion,
    this.isSubmitting = false,
    this.submitError,
    this.registerResult,
  });

  final RegisterStep step;
  final RegisterFormData data;

  /// Explicit checkbox agreeing to CTMS Terms & Conditions (unchecked by default).
  final bool agreedToTermsDocument;

  /// Separate optional consent for Camper Health Profile sharing (unchecked by default).
  final bool healthProfileConsent;

  /// Active Terms version shown to the user when they agreed.
  final String? acceptedTermsVersion;

  final bool isSubmitting;
  final RegisterSubmitError? submitError;
  final RegisterResult? registerResult;

  bool get isFirstStep => step == RegisterStep.role;
  bool get isLastStep => step == RegisterStep.verification;

  RegisterWizardState copyWith({
    RegisterStep? step,
    RegisterFormData? data,
    bool? agreedToTermsDocument,
    bool? healthProfileConsent,
    String? acceptedTermsVersion,
    bool? isSubmitting,
    RegisterSubmitError? submitError,
    bool clearError = false,
    RegisterResult? registerResult,
  }) {
    return RegisterWizardState(
      step: step ?? this.step,
      data: data ?? this.data,
      agreedToTermsDocument:
          agreedToTermsDocument ?? this.agreedToTermsDocument,
      healthProfileConsent: healthProfileConsent ?? this.healthProfileConsent,
      acceptedTermsVersion: acceptedTermsVersion ?? this.acceptedTermsVersion,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      submitError: clearError ? null : (submitError ?? this.submitError),
      registerResult: registerResult ?? this.registerResult,
    );
  }
}

class RegisterController extends Notifier<RegisterWizardState> {
  @override
  RegisterWizardState build() => const RegisterWizardState();

  void reset() => state = const RegisterWizardState();

  void selectRole(UserRole role) {
    state = state.copyWith(data: state.data.copyWith(role: role));
  }

  void updateAccount({required String email, required String password}) {
    state = state.copyWith(
      data: state.data.copyWith(email: email, password: password),
    );
  }

  void updatePersonal({required String fullName, required String phone}) {
    state = state.copyWith(
      data: state.data.copyWith(fullName: fullName, phone: phone),
    );
  }

  void setAcceptedTerms(bool value) {
    state = state.copyWith(
      data: state.data.copyWith(acceptedTerms: value),
      clearError: true,
    );
  }

  void setAgreedToTermsDocument(bool value, {String? version}) {
    state = state.copyWith(
      agreedToTermsDocument: value,
      acceptedTermsVersion: version ?? state.acceptedTermsVersion,
      clearError: true,
    );
  }

  void setHealthProfileConsent(bool value) {
    state = state.copyWith(healthProfileConsent: value);
  }

  void goNext() {
    if (state.isLastStep) return;
    state = state.copyWith(
      step: RegisterStep.values[state.step.index + 1],
      clearError: true,
    );
  }

  void goBack() {
    if (state.isFirstStep) return;
    state = state.copyWith(
      step: RegisterStep.values[state.step.index - 1],
      clearError: true,
    );
  }

  Future<void> submit({String? activeTermsVersion}) async {
    if (state.isSubmitting) return;

    final resolvedVersion =
        (activeTermsVersion ?? state.acceptedTermsVersion)?.trim();

    if (!state.agreedToTermsDocument ||
        resolvedVersion == null ||
        resolvedVersion.isEmpty) {
      state = state.copyWith(
        submitError: const RegisterSubmitError(
          message: RegisterStrings.termsRequiredError,
        ),
      );
      return;
    }

    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final payload = state.data.copyWith(
        email: state.data.email.trim().toLowerCase(),
        phone: state.data.phone.trim(),
      );
      final result = await ref
          .read(authRepositoryProvider)
          .register(
            payload,
            acceptedTermsVersion: resolvedVersion,
            healthProfileConsent:
                state.data.role == UserRole.camper && state.healthProfileConsent,
          );
      state = state.copyWith(isSubmitting: false, registerResult: result);
    } catch (error) {
      if (isTermsVersionOutdatedError(error)) {
        ref.invalidate(currentTermsProvider);
        state = state.copyWith(
          isSubmitting: false,
          agreedToTermsDocument: false,
          submitError: const RegisterSubmitError(
            status: 409,
            message: RegisterStrings.termsOutdatedError,
          ),
        );
        return;
      }
      state = state.copyWith(
        isSubmitting: false,
        submitError: _toRegisterSubmitError(error),
      );
    }
  }
}

final registerControllerProvider =
    NotifierProvider<RegisterController, RegisterWizardState>(
      RegisterController.new,
    );
