import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../register_strings.dart';

/// Step 4 for the Camper role — every field here is optional
/// (`CamperRegisterFormData` on web marks them all nullable too), so there's
/// no [Form]/validator: this step can never block "Tiếp tục".
class RegisterCamperProfessionalStep extends StatelessWidget {
  const RegisterCamperProfessionalStep({
    super.key,
    required this.bloodTypeController,
    required this.fitnessLevelController,
    required this.emergencyContactNameController,
    required this.emergencyContactPhoneController,
  });

  final TextEditingController bloodTypeController;
  final TextEditingController fitnessLevelController;
  final TextEditingController emergencyContactNameController;
  final TextEditingController emergencyContactPhoneController;

  @override
  Widget build(BuildContext context) {
    final mutedColor = Theme.of(context).colorScheme.onSurfaceVariant;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(RegisterStrings.camperProfileStepTitle, style: AppTypography.h2),
        const SizedBox(height: AppSpacing.xs),
        Text(
          RegisterStrings.camperProfileStepSubtitle,
          style: AppTypography.body.copyWith(color: mutedColor),
        ),
        const SizedBox(height: AppSpacing.xxl),
        TextFormField(
          controller: bloodTypeController,
          textInputAction: TextInputAction.next,
          decoration: const InputDecoration(
            labelText: RegisterStrings.bloodTypeLabel,
            prefixIcon: Icon(Icons.bloodtype_outlined),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        TextFormField(
          controller: fitnessLevelController,
          textInputAction: TextInputAction.next,
          decoration: const InputDecoration(
            labelText: RegisterStrings.fitnessLevelLabel,
            prefixIcon: Icon(Icons.fitness_center_outlined),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        TextFormField(
          controller: emergencyContactNameController,
          textCapitalization: TextCapitalization.words,
          textInputAction: TextInputAction.next,
          decoration: const InputDecoration(
            labelText: RegisterStrings.emergencyContactNameLabel,
            prefixIcon: Icon(Icons.contact_emergency_outlined),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        TextFormField(
          controller: emergencyContactPhoneController,
          keyboardType: TextInputType.phone,
          textInputAction: TextInputAction.done,
          decoration: const InputDecoration(
            labelText: RegisterStrings.emergencyContactPhoneLabel,
            prefixIcon: Icon(Icons.phone_forwarded_outlined),
          ),
        ),
      ],
    );
  }
}
