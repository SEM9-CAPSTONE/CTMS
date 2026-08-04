import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../application/register_controller.dart';
import '../domain/register_models.dart';
import '../domain/user_role.dart';
import 'register_strings.dart';
import 'widgets/register_account_step.dart';
import 'widgets/register_camper_professional_step.dart';
import 'widgets/register_personal_step.dart';
import 'widgets/register_personal_verification_step.dart';
import 'widgets/register_porter_professional_step.dart';
import 'widgets/register_role_step.dart';
import 'widgets/register_step_actions.dart';
import 'widgets/register_stepper_header.dart';
import 'widgets/register_submitted_notice.dart';
import 'widgets/register_verification_step.dart';

/// `/register` — §A.3 in `docs/design/FIGMA-SCREEN-INVENTORY.md`, re-specced
/// against CTMS's actual role/approval/database rules. Step 3 forks by
/// role: Trekker keeps the simple "Cá nhân" form, Porter fills in full
/// name/date of birth/gender and verifies their phone by OTP — see
/// [RegisterPersonalVerificationStep]. Only `users`-table fields are
/// collected at signup; there's no CCCD/OCR/selfie/emergency-contact/
/// avatar step (avatar is set later, from the profile screen).
///
/// Submit behaves differently per role too. Trekker: [RegisterController]
/// saves the session and calls `AuthController.setSession`, and
/// `core/router/app_router.dart` redirects away from `/register` on its
/// own — same as after [LoginScreen] signs in, no explicit navigation
/// needed here. Porter: no session is adopted (the profile is pending Host
/// review), so this screen stays mounted and swaps its body to
/// [RegisterSubmittedNotice] once [RegisterWizardState.isSubmitted] flips.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _accountFormKey = GlobalKey<FormState>();
  final _personalFormKey = GlobalKey<FormState>();
  final _personalVerificationFormKey = GlobalKey<FormState>();
  final _porterProfileFormKey = GlobalKey<FormState>();

  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _fullNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _bloodTypeController = TextEditingController();
  final _fitnessLevelController = TextEditingController();
  final _emergencyContactNameController = TextEditingController();
  final _emergencyContactPhoneController = TextEditingController();
  final _experienceYearsController = TextEditingController();
  final _certificationCodeController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _fullNameController.dispose();
    _phoneController.dispose();
    _otpController.dispose();
    _bloodTypeController.dispose();
    _fitnessLevelController.dispose();
    _emergencyContactNameController.dispose();
    _emergencyContactPhoneController.dispose();
    _experienceYearsController.dispose();
    _certificationCodeController.dispose();
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
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
        controller.goNext();
      case RegisterStep.personal:
        if (wizardState.data.role == UserRole.porter) {
          if (!_personalVerificationFormKey.currentState!.validate()) return;
          if (wizardState.data.phoneVerifiedAt == null) return;
          controller.updateFullName(_fullNameController.text.trim());
        } else {
          if (!_personalFormKey.currentState!.validate()) return;
          controller.updatePersonal(
            fullName: _fullNameController.text.trim(),
            phone: _phoneController.text.trim(),
          );
        }
        controller.goNext();
      case RegisterStep.professional:
        if (wizardState.data.role == UserRole.porter) {
          if (!_porterProfileFormKey.currentState!.validate()) return;
          final certification = _certificationCodeController.text.trim();
          controller.updatePorterProfile(
            experienceYears: int.parse(_experienceYearsController.text.trim()),
            certificationCode: certification.isEmpty ? null : certification,
          );
        } else {
          String? orNull(TextEditingController c) =>
              c.text.trim().isEmpty ? null : c.text.trim();
          controller.updateCamperProfile(
            bloodType: orNull(_bloodTypeController),
            fitnessLevel: orNull(_fitnessLevelController),
            emergencyContactName: orNull(_emergencyContactNameController),
            emergencyContactPhone: orNull(_emergencyContactPhoneController),
          );
        }
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
        emailController: _emailController,
        passwordController: _passwordController,
        confirmPasswordController: _confirmPasswordController,
      ),
      RegisterStep.personal => wizardState.data.role == UserRole.porter
          ? RegisterPersonalVerificationStep(
              formKey: _personalVerificationFormKey,
              fullNameController: _fullNameController,
              phoneController: _phoneController,
              otpController: _otpController,
            )
          : RegisterPersonalStep(
              formKey: _personalFormKey,
              fullNameController: _fullNameController,
              phoneController: _phoneController,
            ),
      RegisterStep.professional => wizardState.data.role == UserRole.porter
          ? RegisterPorterProfessionalStep(
              formKey: _porterProfileFormKey,
              experienceYearsController: _experienceYearsController,
              certificationCodeController: _certificationCodeController,
            )
          : RegisterCamperProfessionalStep(
              bloodTypeController: _bloodTypeController,
              fitnessLevelController: _fitnessLevelController,
              emergencyContactNameController: _emergencyContactNameController,
              emergencyContactPhoneController: _emergencyContactPhoneController,
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

    // Porter applications don't sign the user in — see the class doc.
    if (wizardState.isSubmitted && wizardState.data.role == UserRole.porter) {
      return Scaffold(
        appBar: AppBar(title: const Text(RegisterStrings.appBarTitle)),
        body: SafeArea(child: RegisterSubmittedNotice(onBackToHome: () => context.pop())),
      );
    }

    final canContinue = switch (wizardState.step) {
      RegisterStep.role => wizardState.data.role != null,
      RegisterStep.personal => wizardState.data.role == UserRole.porter
          ? wizardState.data.phoneVerifiedAt != null
          : true,
      _ => true,
    };
    final isPorter = wizardState.data.role == UserRole.porter;
    final continueLabel = wizardState.isLastStep
        ? (isPorter ? RegisterStrings.submitApplication : RegisterStrings.submit)
        : RegisterStrings.continueLabel;

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
                      continueLabel: continueLabel,
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
