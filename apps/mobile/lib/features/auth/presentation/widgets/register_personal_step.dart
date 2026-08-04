import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../register_strings.dart';

/// Step 3 — Cá nhân: who to address, how to reach them.
class RegisterPersonalStep extends StatelessWidget {
  const RegisterPersonalStep({
    super.key,
    required this.formKey,
    required this.fullNameController,
    required this.phoneController,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController fullNameController;
  final TextEditingController phoneController;

  static final _phonePattern = RegExp(r'^[0-9+\s]{9,}$');

  @override
  Widget build(BuildContext context) {
    final mutedColor = Theme.of(context).colorScheme.onSurfaceVariant;

    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(RegisterStrings.personalStepTitle, style: AppTypography.h2),
          const SizedBox(height: AppSpacing.xs),
          Text(
            RegisterStrings.personalStepSubtitle,
            style: AppTypography.body.copyWith(color: mutedColor),
          ),
          const SizedBox(height: AppSpacing.xxl),
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
          TextFormField(
            controller: phoneController,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
            decoration: const InputDecoration(
              labelText: RegisterStrings.phoneLabel,
              prefixIcon: Icon(Icons.call_outlined),
            ),
            validator: (value) =>
                _phonePattern.hasMatch(value?.trim() ?? '') ? null : RegisterStrings.phoneError,
          ),
        ],
      ),
    );
  }
}
