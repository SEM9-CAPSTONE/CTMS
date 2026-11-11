import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../application/register_controller.dart';
import '../register_strings.dart';
import 'register_date_of_birth_field.dart';
import 'register_phone_otp_section.dart';

/// Step 3 for the Porter role — "Thông tin cá nhân & xác thực": full name,
/// date of birth, gender (all `users` columns), then phone verified by
/// OTP. No CCCD/OCR/selfie/emergency-contact/avatar collection here per
/// the current business rules — those simply aren't `users` columns this
/// signup flow is allowed to write to.
class RegisterPersonalVerificationStep extends ConsumerWidget {
  const RegisterPersonalVerificationStep({
    super.key,
    required this.formKey,
    required this.fullNameController,
    required this.phoneController,
    required this.otpController,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController fullNameController;
  final TextEditingController phoneController;
  final TextEditingController otpController;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wizardState = ref.watch(registerControllerProvider);
    final controller = ref.read(registerControllerProvider.notifier);
    final data = wizardState.data;
    final mutedColor = Theme.of(context).colorScheme.onSurfaceVariant;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(RegisterStrings.personalVerificationStepTitle, style: AppTypography.h2),
        const SizedBox(height: AppSpacing.xs),
        Text(
          RegisterStrings.personalVerificationStepSubtitle,
          style: AppTypography.body.copyWith(color: mutedColor),
        ),
        const SizedBox(height: AppSpacing.xxl),
        Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: fullNameController,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: RegisterStrings.fullNameLabel,
                  prefixIcon: Icon(Icons.badge_outlined),
                ),
                validator: (value) =>
                    (value == null || value.trim().isEmpty) ? RegisterStrings.fullNameError : null,
              ),
              const SizedBox(height: AppSpacing.lg),
              RegisterDateOfBirthField(
                value: data.dateOfBirth,
                onChanged: controller.setDateOfBirth,
              ),
              const SizedBox(height: AppSpacing.lg),
              DropdownButtonFormField<String>(
                initialValue: data.gender,
                decoration: const InputDecoration(
                  labelText: RegisterStrings.genderLabel,
                  prefixIcon: Icon(Icons.wc_outlined),
                ),
                items: [
                  for (final option in RegisterStrings.genderOptions)
                    DropdownMenuItem(value: option, child: Text(option)),
                ],
                onChanged: (value) {
                  if (value != null) controller.setGender(value);
                },
                validator: (value) => value == null ? RegisterStrings.genderError : null,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xxl),
        RegisterPhoneOtpSection(phoneController: phoneController, otpController: otpController),
      ],
    );
  }
}
