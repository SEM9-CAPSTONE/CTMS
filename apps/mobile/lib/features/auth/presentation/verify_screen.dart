import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../data/auth_api.dart';
import 'register_strings.dart';
import 'verify_strings.dart';
import 'widgets/register_summary_row.dart';

/// `/verify` — reached only from [RegisterScreen] on a successful
/// `POST /auth/register` (see that screen's class doc), never entered
/// directly. Route arguments are the created account's [RegisterResult]
/// (id/email/phone/role — never `fullName`, which is UI-only and never
/// left RegisterFormData).
///
/// CTMS-01-T03 scope only builds this screen's shell: layout, account
/// context, and disabled controls, matching the exact structure the real
/// screen will need. CTMS-02 [Mobile] (a separate Jira subtask — "Verify
/// Account via OTP or Email") replaces [_ComingSoonNotice] with a real
/// controller wired to `POST /auth/send-otp`, `/auth/resend`, and
/// `/auth/verify` (same endpoints and channel-selection UX already built
/// for the web app) — no other widget on this screen, and no router
/// change, should be needed to do that.
class VerifyScreen extends StatelessWidget {
  const VerifyScreen({super.key, required this.account});

  final RegisterResult account;

  @override
  Widget build(BuildContext context) {
    final mutedColor = Theme.of(context).colorScheme.onSurfaceVariant;

    return Scaffold(
      appBar: AppBar(title: const Text(VerifyStrings.appBarTitle), automaticallyImplyLeading: false),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xxl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(VerifyStrings.title, style: AppTypography.h1),
              const SizedBox(height: AppSpacing.xs),
              Text(
                VerifyStrings.subtitle,
                style: AppTypography.body.copyWith(color: mutedColor),
              ),
              const SizedBox(height: AppSpacing.xxl),
              CtmsSectionCard(
                title: RegisterStrings.accountSectionTitle,
                child: Column(
                  children: [
                    RegisterSummaryRow(
                      label: VerifyStrings.emailLabel,
                      value: account.email ?? '',
                    ),
                    RegisterSummaryRow(
                      label: VerifyStrings.phoneLabel,
                      value: account.phone ?? '',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xxl),
              // Disabled shell only — CTMS-02 [Mobile] replaces this block
              // with a real channel selector + OTP input wired to a
              // controller. No send/verify/resend call happens here.
              const TextField(
                enabled: false,
                decoration: InputDecoration(
                  labelText: VerifyStrings.otpLabel,
                  hintText: VerifyStrings.otpHint,
                  prefixIcon: Icon(Icons.password_outlined),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                children: [
                  Expanded(
                    child: CtmsButton(
                      label: VerifyStrings.sendOtp,
                      variant: CtmsButtonVariant.secondary,
                      onPressed: null,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: CtmsButton(label: VerifyStrings.verify, onPressed: null),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xxl),
              const CtmsAlertBanner(
                severity: CtmsAlertSeverity.info,
                title: VerifyStrings.appBarTitle,
                message: VerifyStrings.comingSoonNotice,
              ),
              const SizedBox(height: AppSpacing.xxl),
              CtmsButton(
                label: VerifyStrings.backToLogin,
                variant: CtmsButtonVariant.ghost,
                onPressed: () => context.go('/login'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
