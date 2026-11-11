import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../data/auth_api.dart';
import '../data/auth_repository.dart';
import '../domain/register_models.dart';
import '../domain/user_role.dart';

/// One `{field, errors}` entry from the backend's 422 body
/// (`{statusCode, error, message: [{field, errors}]}` —
/// services/api's `validationExceptionFactory`).
class RegisterFieldError {
  const RegisterFieldError({required this.field, required this.errors});

  final String field;
  final List<String> errors;
}

/// Data prepared from a failed [RegisterController.submit], for
/// RegisterScreen/RegisterVerificationStep to render. Mirrors
/// apps/web/src/features/auth/hooks/useRegisterForm.ts's
/// `RegisterSubmitError` — same shape, same reasoning: 409 (duplicate
/// email/phone) has no field to point at, so [fieldErrors] stays null and
/// [message] is shown as a single banner; 422 always has [fieldErrors].
class RegisterSubmitError {
  const RegisterSubmitError({this.status, required this.message, this.fieldErrors});

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
              errors: (item['errors'] as List? ?? const []).map((e) => e.toString()).toList(),
            ),
          )
          .toList();
    }
    return RegisterSubmitError(status: error.statusCode, message: error.message, fieldErrors: fieldErrors);
  }
  return const RegisterSubmitError(message: 'Đăng ký thất bại. Vui lòng thử lại.');
}

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
    this.registerResult,
  });

  final RegisterStep step;
  final RegisterFormData data;
  final bool isSubmitting;
  final RegisterSubmitError? submitError;

  /// Set once [submit] succeeds — the created account's id/email/phone/role
  /// (never `fullName`, see [RegisterFormData]'s doc comment). RegisterScreen
  /// reacts to this becoming non-null by navigating to `/verify`; it is the
  /// signal, not a boolean flag, precisely because the screen needs this
  /// data to hand off to that route.
  final RegisterResult? registerResult;

  bool get isFirstStep => step == RegisterStep.role;
  bool get isLastStep => step == RegisterStep.verification;

  RegisterWizardState copyWith({
    RegisterStep? step,
    RegisterFormData? data,
    bool? isSubmitting,
    RegisterSubmitError? submitError,
    bool clearError = false,
    RegisterResult? registerResult,
  }) {
    return RegisterWizardState(
      step: step ?? this.step,
      data: data ?? this.data,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      submitError: clearError ? null : (submitError ?? this.submitError),
      registerResult: registerResult ?? this.registerResult,
    );
  }
}

class RegisterController extends Notifier<RegisterWizardState> {
  @override
  RegisterWizardState build() => const RegisterWizardState();

  /// Restarts the wizard from a clean slate. [registerControllerProvider]
  /// isn't `autoDispose` (its state must survive the async gap between
  /// [submit] finishing and RegisterScreen reacting to `registerResult`,
  /// see that field's doc comment), so leaving `/register` and coming back
  /// -- e.g. via Login's "Đăng ký tài khoản mới" -- would otherwise resume
  /// wherever the previous attempt left off (mid-wizard, or stuck on the
  /// Verification step with a stale [RegisterSubmitError]/[RegisterResult]).
  /// RegisterScreen calls this once from `initState`, i.e. only on a fresh
  /// entry into the flow -- never on in-wizard `goBack()`.
  void reset() => state = const RegisterWizardState();

  void selectRole(UserRole role) {
    state = state.copyWith(data: state.data.copyWith(role: role));
  }

  void updateAccount({required String email, required String password}) {
    state = state.copyWith(data: state.data.copyWith(email: email, password: password));
  }

  /// [fullName] is UI-only — never sent to the API, never stored past this
  /// controller's state. See [RegisterFormData]'s doc comment.
  void updatePersonal({required String fullName, required String phone}) {
    state = state.copyWith(data: state.data.copyWith(fullName: fullName, phone: phone));
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

  /// On success, stores [RegisterResult] and stops — no session is adopted
  /// (register returns no token, see [RegisterResult]'s doc comment).
  /// RegisterScreen reacts to `state.registerResult` becoming non-null and
  /// navigates to `/verify`.
  Future<void> submit() async {
    if (state.isSubmitting) return; // BR-241-style guard, same reasoning as AuthController.login.

    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      // Email trimmed + lowercased (BR-002) right before sending -- the
      // stored `state.data`/on-screen fields keep exactly what the user
      // typed (BR-242 "preserve entered data"), only the outgoing payload
      // is normalized. Phone is trimmed only: normalizing to E.164 is the
      // backend's job (RegisterDto's @Transform), same decision already
      // made for the web app (see useRegisterForm.ts's buildRegisterPayload
      // doc comment) -- not duplicated here.
      final payload = state.data.copyWith(
        email: state.data.email.trim().toLowerCase(),
        phone: state.data.phone.trim(),
      );
      final result = await ref.read(authRepositoryProvider).register(payload);
      state = state.copyWith(isSubmitting: false, registerResult: result);
    } catch (error) {
      state = state.copyWith(isSubmitting: false, submitError: _toRegisterSubmitError(error));
    }
  }
}

final registerControllerProvider = NotifierProvider<RegisterController, RegisterWizardState>(
  RegisterController.new,
);
