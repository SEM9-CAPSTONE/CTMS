import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_alert_banner.dart';
import '../../../../core/widgets/ctms_button.dart';
import '../../../../core/widgets/ctms_section_card.dart';
import '../../../terms/domain/terms_models.dart';
import '../../application/register_controller.dart';
import '../../domain/register_models.dart';
import '../register_strings.dart';
import 'register_summary_row.dart';

class RegisterVerificationStep extends StatefulWidget {
  const RegisterVerificationStep({
    super.key,
    required this.data,
    required this.acceptedTerms,
    required this.onAcceptedTermsChanged,
    required this.agreedToTermsDocument,
    required this.onAgreedToTermsDocumentChanged,
    required this.onOpenTerms,
    this.currentTerms,
    this.isLoadingTerms = false,
    this.hasTermsError = false,
    this.onRetryTerms,
    this.submitError,
  });

  final RegisterFormData data;
  final bool acceptedTerms;
  final ValueChanged<bool> onAcceptedTermsChanged;
  final bool agreedToTermsDocument;
  final ValueChanged<bool> onAgreedToTermsDocumentChanged;
  final VoidCallback onOpenTerms;
  final TermsVersionDetail? currentTerms;
  final bool isLoadingTerms;
  final bool hasTermsError;
  final VoidCallback? onRetryTerms;
  final RegisterSubmitError? submitError;

  @override
  State<RegisterVerificationStep> createState() =>
      _RegisterVerificationStepState();
}

class _RegisterVerificationStepState extends State<RegisterVerificationStep> {
  late final TapGestureRecognizer _termsLinkRecognizer;

  @override
  void initState() {
    super.initState();
    _termsLinkRecognizer = TapGestureRecognizer()..onTap = widget.onOpenTerms;
  }

  @override
  void didUpdateWidget(covariant RegisterVerificationStep oldWidget) {
    super.didUpdateWidget(oldWidget);
    _termsLinkRecognizer.onTap = widget.onOpenTerms;
  }

  @override
  void dispose() {
    _termsLinkRecognizer.dispose();
    super.dispose();
  }

  List<String> _errorMessages(RegisterSubmitError error) {
    final fieldErrors = error.fieldErrors;
    if (fieldErrors == null || fieldErrors.isEmpty) return [error.message];
    return fieldErrors.expand((fieldError) => fieldError.errors).toList();
  }

  @override
  Widget build(BuildContext context) {
    final mutedColor = Theme.of(context).colorScheme.onSurfaceVariant;
    final error = widget.submitError;
    final errorMessages = error == null
        ? const <String>[]
        : _errorMessages(error);
    final terms = widget.currentTerms;

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
              RegisterSummaryRow(
                label: RegisterStrings.emailLabel,
                value: widget.data.email,
              ),
              RegisterSummaryRow(
                label: RegisterStrings.phoneLabel,
                value: widget.data.phone,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        CtmsSectionCard(
          title: RegisterStrings.personalSectionTitle,
          child: Column(
            children: [
              RegisterSummaryRow(
                label: RegisterStrings.fullNameLabel,
                value: widget.data.fullName,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        if (errorMessages.isNotEmpty) ...[
          CtmsAlertBanner(
            severity: CtmsAlertSeverity.danger,
            title: RegisterStrings.submitErrorTitle,
            message: errorMessages.join('\n'),
          ),
          const SizedBox(height: AppSpacing.lg),
        ],
        if (widget.hasTermsError) ...[
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: AppRadius.controlBorderRadius,
              border: Border.all(color: const Color(0xFFFDE68A)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  RegisterStrings.termsLoadError,
                  style: AppTypography.caption.copyWith(
                    color: const Color(0xFF92400E),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (widget.onRetryTerms != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  CtmsButton(
                    label: 'Tải lại điều khoản',
                    variant: CtmsButtonVariant.secondary,
                    onPressed: widget.onRetryTerms,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        Text(
          RegisterStrings.consentSectionTitle,
          style: AppTypography.bodyStrong.copyWith(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),

        // 1. Accuracy confirmation checkbox
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(
              key: const ValueKey('register-accuracy-checkbox'),
              value: widget.acceptedTerms,
              onChanged: (value) =>
                  widget.onAcceptedTermsChanged(value ?? false),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: GestureDetector(
                  onTap: () =>
                      widget.onAcceptedTermsChanged(!widget.acceptedTerms),
                  child: Text(
                    RegisterStrings.termsLabel,
                    style: AppTypography.body,
                  ),
                ),
              ),
            ),
          ],
        ),

        // 2. Mandatory Terms & Conditions consent checkbox with tappable link
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(
              key: const ValueKey('register-terms-checkbox'),
              value: widget.agreedToTermsDocument,
              onChanged: (widget.isLoadingTerms || terms == null)
                  ? null
                  : (value) =>
                        widget.onAgreedToTermsDocumentChanged(value ?? false),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    RichText(
                      text: TextSpan(
                        style: AppTypography.body.copyWith(
                          color: AppColors.textPrimary,
                        ),
                        children: [
                          const TextSpan(
                            text: RegisterStrings.termsAgreementPrefix,
                          ),
                          TextSpan(
                            text: RegisterStrings.termsAgreementLink,
                            style: AppTypography.body.copyWith(
                              color: AppColors.brandPrimary,
                              fontWeight: FontWeight.w700,
                              decoration: TextDecoration.underline,
                            ),
                            recognizer: _termsLinkRecognizer,
                          ),
                          const TextSpan(
                            text: RegisterStrings.termsAgreementSuffix,
                          ),
                        ],
                      ),
                    ),
                    if (terms != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Phiên bản ${formatTermsVersionLabel(terms.version)} · Hiệu lực ${formatTermsDate(terms.effectiveDate)}',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.brandPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
