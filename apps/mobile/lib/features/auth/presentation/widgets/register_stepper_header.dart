import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/register_models.dart';
import '../register_strings.dart';

/// §A.3 stepper — "bước active = tròn brand.primary chữ trắng; còn lại
/// xám". Desktop connects the dots with a rule line; on a narrow phone that
/// risks overflow with 5 Vietnamese labels, so this adapts to 5 evenly
/// spaced columns instead (a standard mobile step-indicator pattern).
class RegisterStepperHeader extends StatelessWidget {
  const RegisterStepperHeader({super.key, required this.currentStep});

  final RegisterStep currentStep;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.lg),
      child: Row(
        children: [
          for (final step in RegisterStep.values)
            Expanded(
              child: _StepDot(
                index: step.index,
                isActive: step == currentStep,
                label: RegisterStrings.stepLabels[step.index],
              ),
            ),
        ],
      ),
    );
  }
}

class _StepDot extends StatelessWidget {
  const _StepDot({required this.index, required this.isActive, required this.label});

  final int index;
  final bool isActive;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: isActive ? AppColors.brandPrimary : AppColors.borderStrong,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            '${index + 1}',
            style: AppTypography.caption.copyWith(
              color: isActive ? Colors.white : AppColors.textSecondary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          label,
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.caption.copyWith(
            color: isActive ? AppColors.textPrimary : AppColors.textMuted,
            fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ],
    );
  }
}
