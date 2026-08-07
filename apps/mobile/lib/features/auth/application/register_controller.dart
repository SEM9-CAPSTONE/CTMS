import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_api.dart';
import '../data/auth_repository.dart';
import '../domain/register_models.dart';
import '../domain/user_role.dart';

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
  final Object? submitError;

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
    Object? submitError,
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
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final result = await ref.read(authRepositoryProvider).register(state.data);
      state = state.copyWith(isSubmitting: false, registerResult: result);
    } catch (error) {
      state = state.copyWith(isSubmitting: false, submitError: error);
    }
  }
}

final registerControllerProvider = NotifierProvider<RegisterController, RegisterWizardState>(
  RegisterController.new,
);
