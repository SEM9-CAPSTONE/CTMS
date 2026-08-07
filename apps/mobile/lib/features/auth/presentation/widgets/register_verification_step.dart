import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_alert_banner.dart';
import '../../../../core/widgets/ctms_section_card.dart';
import '../../domain/register_models.dart';
import '../register_strings.dart';
import 'register_summary_row.dart';

/// Step 4 — "Xác nhận đăng ký": a read-only recap of account + personal
/// info, the accuracy checkbox, and the submit error (if any). Camper and
/// Porter share this exact step — CTMS-01-T03 scope only sends
/// email/phone/password/role to the backend, so there is nothing
/// role-specific left to recap (no professional/coverage section, no
/// separate Porter "application" framing — see register_screen.dart's
/// class doc for why). The submit button itself lives in
/// [RegisterStepActions] on the parent screen.
class RegisterVerificationStep extends StatelessWidget {
  const RegisterVerificationStep({
    super.key,
    required this.data,
    required this.acceptedTerms,
    required this.onAcceptedTermsChanged,
    this.submitError,
  });

  final RegisterFormData data;
  final bool acceptedTerms;
  final ValueChanged<bool> onAcceptedTermsChanged;
  final Object? submitError;

  @override
  Widget build(BuildContext context) {
    final mutedColor = Theme.of(context).colorScheme.onSurfaceVariant;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(RegisterStrings.verificationStepTitle, style: AppTypography.h2),
        const SizedBox(height: AppSpacing.xs),
        Text(
          RegisterStrings.verificationStepSubtitle,
          style: AppTypography.body.copyWith(color: mutedColor),
        ),
        const SizedBox(height: AppSpacing.xxl),
        CtmsSectionCard(
          title: RegisterStrings.accountSectionTitle,
          child: Column(
            children: [
              RegisterSummaryRow(label: RegisterStrings.emailLabel, value: data.email),
              RegisterSummaryRow(label: RegisterStrings.phoneLabel, value: data.phone),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        CtmsSectionCard(
          title: RegisterStrings.personalSectionTitle,
          child: Column(
            children: [
              RegisterSummaryRow(label: RegisterStrings.fullNameLabel, value: data.fullName),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        if (submitError != null) ...[
          CtmsAlertBanner(
            severity: CtmsAlertSeverity.danger,
            title: RegisterStrings.submitErrorTitle,
            message: RegisterStrings.registerFailed(submitError!),
          ),
          const SizedBox(height: AppSpacing.lg),
        ],
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(
              value: acceptedTerms,
              onChanged: (value) => onAcceptedTermsChanged(value ?? false),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: GestureDetector(
                  onTap: () => onAcceptedTermsChanged(!acceptedTerms),
                  child: Text(RegisterStrings.termsLabel, style: AppTypography.body),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
