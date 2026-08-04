import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_alert_banner.dart';
import '../../../../core/widgets/ctms_section_card.dart';
import '../../domain/register_models.dart';
import '../../domain/user_role.dart';
import '../register_strings.dart';
import 'register_porter_coverage_summary.dart';
import 'register_summary_row.dart';

/// Step 5 — "Xác nhận đăng ký": a read-only recap grouped the way Host
/// will actually need to read it (account / personal / professional), the
/// accuracy checkbox, and the submit error (if any). The submit button
/// itself lives in [RegisterStepActions] on the parent screen, with its
/// label chosen there ("Gửi hồ sơ" for Porter vs "Hoàn tất đăng ký" for
/// Trekker — only Porter's profile goes through Host review).
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

  static final _dateFormat = DateFormat('dd/MM/yyyy');

  @override
  Widget build(BuildContext context) {
    final mutedColor = Theme.of(context).colorScheme.onSurfaceVariant;
    final isPorter = data.role == UserRole.porter;
    final certification = data.certificationCode?.trim() ?? '';
    final hasSafetyProfile =
        (data.bloodType?.isNotEmpty ?? false) ||
        (data.fitnessLevel?.isNotEmpty ?? false) ||
        (data.emergencyContactName?.isNotEmpty ?? false) ||
        (data.emergencyContactPhone?.isNotEmpty ?? false);

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
              RegisterSummaryRow(
                label: RegisterStrings.phoneLabel,
                value: isPorter
                    ? '${data.phone}${RegisterStrings.phoneVerifiedSuffix}'
                    : data.phone,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        CtmsSectionCard(
          title: RegisterStrings.personalSectionTitle,
          child: Column(
            children: [
              RegisterSummaryRow(label: RegisterStrings.fullNameLabel, value: data.fullName),
              if (isPorter) ...[
                RegisterSummaryRow(
                  label: RegisterStrings.dateOfBirthLabel,
                  value: data.dateOfBirth == null ? '' : _dateFormat.format(data.dateOfBirth!),
                ),
                RegisterSummaryRow(
                  label: RegisterStrings.genderLabel,
                  value: data.gender ?? '',
                ),
              ] else if (hasSafetyProfile) ...[
                if (data.bloodType?.isNotEmpty ?? false)
                  RegisterSummaryRow(label: RegisterStrings.bloodTypeLabel, value: data.bloodType!),
                if (data.fitnessLevel?.isNotEmpty ?? false)
                  RegisterSummaryRow(
                    label: RegisterStrings.fitnessLevelLabel,
                    value: data.fitnessLevel!,
                  ),
                if (data.emergencyContactName?.isNotEmpty ?? false)
                  RegisterSummaryRow(
                    label: RegisterStrings.emergencyContactNameLabel,
                    value: data.emergencyContactName!,
                  ),
                if (data.emergencyContactPhone?.isNotEmpty ?? false)
                  RegisterSummaryRow(
                    label: RegisterStrings.emergencyContactPhoneLabel,
                    value: data.emergencyContactPhone!,
                  ),
              ],
            ],
          ),
        ),
        if (isPorter) ...[
          const SizedBox(height: AppSpacing.lg),
          CtmsSectionCard(
            title: RegisterStrings.professionalSectionTitle,
            child: Column(
              children: [
                RegisterSummaryRow(
                  label: RegisterStrings.experienceYearsLabel,
                  value: '${data.experienceYears ?? 0}',
                ),
                if (data.operatingDistrictId != null)
                  RegisterPorterCoverageSummary(
                    districtId: data.operatingDistrictId!,
                    campsiteIds: data.preferredCampsiteIds,
                  ),
                if (certification.isNotEmpty)
                  RegisterSummaryRow(
                    label: RegisterStrings.certificationCodeLabel,
                    value: certification,
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        if (submitError != null) ...[
          CtmsAlertBanner(
            severity: CtmsAlertSeverity.danger,
            title: isPorter
                ? RegisterStrings.submitApplicationErrorTitle
                : RegisterStrings.submitErrorTitle,
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
