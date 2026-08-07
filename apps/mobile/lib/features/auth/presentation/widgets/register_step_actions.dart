import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/ctms_button.dart';
import '../register_strings.dart';

/// Shared "Quay lại / Tiếp tục" (or "Xác nhận") row for steps 2–5. Step 1
/// has no back target, so [onBack] is nullable and the row collapses to a
/// single full-width continue button.
class RegisterStepActions extends StatelessWidget {
  const RegisterStepActions({
    super.key,
    this.onBack,
    required this.onContinue,
    this.continueLabel = RegisterStrings.continueLabel,
    this.isLoading = false,
  });

  final VoidCallback? onBack;
  final VoidCallback? onContinue;
  final String continueLabel;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (onBack != null) ...[
          CtmsButton(
            label: RegisterStrings.back,
            variant: CtmsButtonVariant.secondary,
            onPressed: onBack,
          ),
          const SizedBox(width: AppSpacing.md),
        ],
        Expanded(
          child: CtmsButton(label: continueLabel, isLoading: isLoading, onPressed: onContinue),
        ),
      ],
    );
  }
}
