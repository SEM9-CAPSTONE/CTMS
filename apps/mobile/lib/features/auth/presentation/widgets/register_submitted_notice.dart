import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_button.dart';
import '../register_strings.dart';

/// Replaces the wizard body once a Porter application has been sent — no
/// auto-login, no "đăng ký thành công": the account is real but pending
/// Host review, so this frames it as a submission, not activation.
class RegisterSubmittedNotice extends StatelessWidget {
  const RegisterSubmittedNotice({super.key, required this.onBackToHome});

  final VoidCallback onBackToHome;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: AppColors.brandLight,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.mark_email_read_outlined,
                size: 36,
                color: AppColors.brandPrimary,
              ),
            ),
            const SizedBox(height: AppSpacing.xxl),
            Text(
              RegisterStrings.submittedTitle,
              textAlign: TextAlign.center,
              style: AppTypography.h1,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              RegisterStrings.submittedMessage,
              textAlign: TextAlign.center,
              style: AppTypography.body.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.xxxl),
            SizedBox(
              width: double.infinity,
              child: CtmsButton(label: RegisterStrings.backToHome, onPressed: onBackToHome),
            ),
          ],
        ),
      ),
    );
  }
}
