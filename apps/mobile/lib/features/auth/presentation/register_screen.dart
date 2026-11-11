import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../application/register_controller.dart';
import '../domain/register_models.dart';
import 'register_strings.dart';
import 'widgets/register_account_step.dart';
import 'widgets/register_personal_step.dart';
import 'widgets/register_role_step.dart';
import 'widgets/register_step_actions.dart';
import 'widgets/register_stepper_header.dart';
import 'widgets/register_verification_step.dart';

/// `/register` — §A.3 in `docs/design/FIGMA-SCREEN-INVENTORY.md`, re-specced
/// against `POST /auth/register`'s actual contract (CTMS-01-T01,
/// services/api): only `email`, `phone`, `password`, `role` are ever sent.
///
/// CTMS-01-T03 scope only. Camper and Porter go through the identical
/// 4-step flow (Role → Account → Personal → Verification) and submit the
/// same request shape — the backend has no Host-approval step for Porter
/// registration and no separate in-wizard phone-OTP step; both roles end
/// up `pending_verification` and need CTMS-02's OTP flow to activate,
/// exactly like Camper. Submitting does NOT sign the user in (register
/// returns no token — see `AuthApi.RegisterResult`'s doc comment); on
/// success this screen navigates to `/verify` instead, handing off the
/// created account's id/email/phone/role (never `fullName` — UI-only, see
/// `RegisterFormData`'s doc comment).
///
/// A previous version of this file had a 5th "professional" step and a
/// Porter-only in-wizard OTP step. Those widgets still exist under
/// `presentation/widgets/` (unreferenced here, not deleted) — see
/// `register_models.dart`'s doc comment for why they were dropped from
/// this flow rather than fixed.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> with RestorationMixin {
  final _accountFormKey = GlobalKey<FormState>();
  final _personalFormKey = GlobalKey<FormState>();

  // CTMS-01-T03 checklist: "Preserve only non-sensitive form data when the
  // app temporarily moves to the background." These 3 survive the OS
  // reclaiming the process (restoration, not just a simple background/
  // foreground cycle, which Flutter already keeps widget state across for
  // free). Password/confirmPassword are deliberately plain
  // TextEditingControllers below, NOT restorable -- they must never survive
  // process death.
  final _emailController = RestorableTextEditingController();
  final _fullNameController = RestorableTextEditingController();
  final _phoneController = RestorableTextEditingController();

  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  @override
  void initState() {
    super.initState();
    // registerControllerProvider isn't scoped to this screen's lifetime
    // (see RegisterController.reset's doc comment) -- a fresh mount (first
    // visit, or coming back via Login's "Đăng ký tài khoản mới" after a
    // prior attempt) must not resume wherever that prior attempt left off.
    // In-wizard back navigation doesn't recreate this State, so it never
    // re-fires this. Riverpod forbids mutating a provider mid-build
    // (initState included), so this is deferred a microtask -- runs before
    // anything else the user can interact with.
    Future(() => ref.read(registerControllerProvider.notifier).reset());
  }

  @override
  String? get restorationId => 'register_screen';

  @override
  void restoreState(RestorationBucket? oldBucket, bool initialRestore) {
    registerForRestoration(_emailController, 'email');
    registerForRestoration(_fullNameController, 'fullName');
    registerForRestoration(_phoneController, 'phone');
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _fullNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _handleContinue(RegisterWizardState wizardState) {
    final controller = ref.read(registerControllerProvider.notifier);

    switch (wizardState.step) {
      case RegisterStep.role:
        if (wizardState.data.role == null) return;
        controller.goNext();
      case RegisterStep.account:
        if (!_accountFormKey.currentState!.validate()) return;
        controller.updateAccount(
          email: _emailController.value.text.trim(),
          password: _passwordController.text,
        );
        controller.goNext();
      case RegisterStep.personal:
        if (!_personalFormKey.currentState!.validate()) return;
        controller.updatePersonal(
          fullName: _fullNameController.value.text.trim(),
          phone: _phoneController.value.text.trim(),
        );
        controller.goNext();
      case RegisterStep.verification:
        if (!wizardState.data.acceptedTerms || wizardState.isSubmitting) return;
        controller.submit();
    }
  }

  Widget _buildStepContent(RegisterWizardState wizardState) {
    final controller = ref.read(registerControllerProvider.notifier);

    return switch (wizardState.step) {
      RegisterStep.role => RegisterRoleStep(
        selectedRole: wizardState.data.role,
        onSelect: controller.selectRole,
      ),
      RegisterStep.account => RegisterAccountStep(
        formKey: _accountFormKey,
        emailController: _emailController.value,
        passwordController: _passwordController,
        confirmPasswordController: _confirmPasswordController,
      ),
      RegisterStep.personal => RegisterPersonalStep(
        formKey: _personalFormKey,
        fullNameController: _fullNameController.value,
        phoneController: _phoneController.value,
      ),
      RegisterStep.verification => RegisterVerificationStep(
        data: wizardState.data,
        acceptedTerms: wizardState.data.acceptedTerms,
        onAcceptedTermsChanged: controller.setAcceptedTerms,
        submitError: wizardState.submitError,
      ),
    };
  }

  @override
  Widget build(BuildContext context) {
    final wizardState = ref.watch(registerControllerProvider);

    // Register succeeded (no session adopted, see class doc) — hand off the
    // created account to /verify. ref.listen (not reacting inside build)
    // so this fires exactly once per successful submit, not on every
    // rebuild while registerResult stays non-null.
    ref.listen(registerControllerProvider, (previous, next) {
      final result = next.registerResult;
      if (result != null && previous?.registerResult == null) {
        context.pushReplacement('/verify', extra: result);
      }
    });

    final canContinue = switch (wizardState.step) {
      RegisterStep.role => wizardState.data.role != null,
      _ => true,
    };

    return Scaffold(
      appBar: AppBar(title: const Text(RegisterStrings.appBarTitle)),
      body: SafeArea(
        child: Column(
          children: [
            RegisterStepperHeader(currentStep: wizardState.step),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xxl),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildStepContent(wizardState),
                    const SizedBox(height: AppSpacing.xxl),
                    RegisterStepActions(
                      onBack: wizardState.isFirstStep
                          ? null
                          : () => ref.read(registerControllerProvider.notifier).goBack(),
                      onContinue: canContinue ? () => _handleContinue(wizardState) : null,
                      continueLabel: wizardState.isLastStep
                          ? RegisterStrings.submit
                          : RegisterStrings.continueLabel,
                      isLoading: wizardState.isSubmitting,
                    ),
                    if (wizardState.isFirstStep) ...[
                      const SizedBox(height: AppSpacing.xxl),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            RegisterStrings.alreadyHaveAccount,
                            style: AppTypography.body.copyWith(
                              color: Theme.of(context).colorScheme.onSurfaceVariant,
                            ),
                          ),
                          TextButton(
                            onPressed: () => context.pop(),
                            child: const Text(RegisterStrings.loginNow),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: AppSpacing.xxl),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
