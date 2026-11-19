import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';

class SurvivalChatInput extends StatelessWidget {
  const SurvivalChatInput({
    super.key,
    required this.controller,
    required this.onChanged,
    required this.onSubmitted,
    this.errorText,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;
  final String? errorText;

  @override
  Widget build(BuildContext context) => TextField(
    controller: controller,
    textInputAction: TextInputAction.send,
    onChanged: onChanged,
    onSubmitted: onSubmitted,
    style: AppTypography.body.copyWith(color: AppColors.textPrimary),
    decoration: InputDecoration(
      hintText: 'Hỏi trợ lý sinh tồn...',
      errorText: errorText,
      hintStyle: AppTypography.body.copyWith(color: AppColors.textSecondary),
      border: InputBorder.none,
      enabledBorder: InputBorder.none,
      focusedBorder: InputBorder.none,
      filled: false,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.sm,
      ),
    ),
  );
}
