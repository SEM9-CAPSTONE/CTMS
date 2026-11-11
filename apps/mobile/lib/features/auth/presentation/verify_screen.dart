import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../application/verify_otp_controller.dart';
import '../data/auth_api.dart';
import 'register_strings.dart';
import 'verify_strings.dart';
import 'widgets/register_summary_row.dart';

/// How long the success message stays on screen before auto-navigating to
/// Login -- same UX reasoning and delay as Web's useVerifyOtpForm.ts: a
/// manual "go now" action (the button below) is still offered for an
/// impatient user, this only governs the automatic redirect.
const _verifySuccessRedirectDelay = Duration(milliseconds: 2500);

/// `/verify` — reached only from [RegisterScreen] on a successful
/// `POST /auth/register` (see that screen's class doc), never entered
/// directly. Route arguments are the created account's [RegisterResult]
/// (id/email/phone/role — never `fullName`, which is UI-only and never
/// left RegisterFormData).
///
/// CTMS-02 [Mobile]. Real send-otp/resend/verify flow, wired to
/// [VerifyOtpController] -- same contract and UX Decision Gate already
/// built for the web app (apps/web/src/features/auth/pages/VerifyOtpPage.tsx):
/// no OTP is ever sent automatically on entry, the user must pick a channel
/// (Phone or Email) and press "Gửi mã OTP" first.
class VerifyScreen extends ConsumerStatefulWidget {
  const VerifyScreen({super.key, required this.account});

  final RegisterResult account;

  @override
  ConsumerState<VerifyScreen> createState() => _VerifyScreenState();
}

class _VerifyScreenState extends ConsumerState<VerifyScreen> {
  Timer? _redirectTimer;

  @override
  void dispose() {
    _redirectTimer?.cancel();
    super.dispose();
  }

  void _goToLogin() {
    if (mounted) context.go('/login');
  }

  void _scheduleAutoRedirect() {
    _redirectTimer ??= Timer(_verifySuccessRedirectDelay, _goToLogin);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(verifyOtpControllerProvider);
    final controller = ref.read(verifyOtpControllerProvider.notifier);
    final mutedColor = Theme.of(context).colorScheme.onSurfaceVariant;

    if (state.verifySuccess) {
      _scheduleAutoRedirect();
      return _VerifySuccessView(onGoToLoginNow: _goToLogin);
    }

    String destinationFor(OtpChannel channel) =>
        channel == OtpChannel.email ? (widget.account.email ?? '') : (widget.account.phone ?? '');

    final sendButtonLabel = state.isSending
        ? VerifyStrings.sending
        : state.countdown > 0
        ? '${VerifyStrings.resendOtp} (${state.countdown}s)'
        : state.hasSentCode
        ? VerifyStrings.resendOtp
        : VerifyStrings.sendOtp;

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
                      value: widget.account.email ?? '',
                    ),
                    RegisterSummaryRow(
                      label: VerifyStrings.phoneLabel,
                      value: widget.account.phone ?? '',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xxl),
              Text(
                state.hasSentCode && state.selectedChannel != null
                    ? '${VerifyStrings.sentCodeToPrefix}${destinationFor(state.selectedChannel!)}'
                    : VerifyStrings.chooseChannelHint,
                style: AppTypography.caption.copyWith(color: mutedColor),
              ),
              const SizedBox(height: AppSpacing.md),
              // Verification method selector -- Phone or Email, chosen fresh
              // on this screen every visit, same as Web (never carried from
              // Register, never persisted).
              Row(
                children: [
                  Expanded(
                    child: _ChannelButton(
                      icon: Icons.phone_outlined,
                      label: VerifyStrings.channelPhoneLabel,
                      destination: widget.account.phone ?? '—',
                      selected: state.selectedChannel == OtpChannel.phone,
                      onTap: () => controller.selectChannel(OtpChannel.phone),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: _ChannelButton(
                      icon: Icons.mail_outline,
                      label: VerifyStrings.channelEmailLabel,
                      destination: widget.account.email ?? '—',
                      selected: state.selectedChannel == OtpChannel.email,
                      onTap: () => controller.selectChannel(OtpChannel.email),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              CtmsButton(
                label: sendButtonLabel,
                icon: Icons.send_outlined,
                variant: CtmsButtonVariant.secondary,
                isLoading: state.isSending,
                onPressed: (state.isSending || state.countdown > 0 || state.selectedChannel == null)
                    ? null
                    : () => controller.sendCode(widget.account.id),
              ),
              const SizedBox(height: AppSpacing.lg),
              TextField(
                enabled: state.hasSentCode,
                keyboardType: TextInputType.number,
                onChanged: controller.setCode,
                decoration: InputDecoration(
                  labelText: VerifyStrings.otpLabel,
                  hintText: state.hasSentCode ? VerifyStrings.otpHint : VerifyStrings.chooseChannelHint,
                  prefixIcon: const Icon(Icons.password_outlined),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              CtmsButton(
                label: state.isVerifying ? VerifyStrings.verifying : VerifyStrings.verify,
                isLoading: state.isVerifying,
                onPressed: (state.isVerifying || !state.hasSentCode || state.code.isEmpty)
                    ? null
                    : () => controller.verify(widget.account.id),
              ),
              if (state.errorMessage != null) ...[
                const SizedBox(height: AppSpacing.lg),
                CtmsAlertBanner(
                  severity: CtmsAlertSeverity.danger,
                  title: VerifyStrings.appBarTitle,
                  message: state.errorMessage!,
                ),
              ],
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

class _ChannelButton extends StatelessWidget {
  const _ChannelButton({
    required this.icon,
    required this.label,
    required this.destination,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String destination;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        backgroundColor: selected ? scheme.primaryContainer : null,
        side: BorderSide(color: selected ? scheme.primary : scheme.outlineVariant),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: selected ? scheme.primary : scheme.onSurfaceVariant),
          const SizedBox(height: AppSpacing.xs),
          Text(
            label,
            textAlign: TextAlign.center,
            style: AppTypography.caption.copyWith(
              fontWeight: FontWeight.bold,
              color: selected ? scheme.primary : scheme.onSurfaceVariant,
            ),
          ),
          Text(
            destination,
            textAlign: TextAlign.center,
            style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _VerifySuccessView extends StatelessWidget {
  const _VerifySuccessView({required this.onGoToLoginNow});

  final VoidCallback onGoToLoginNow;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xxl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.verified_outlined, size: 56, color: scheme.primary),
                const SizedBox(height: AppSpacing.md),
                Text(
                  VerifyStrings.verifySuccessTitle,
                  style: AppTypography.h1,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  VerifyStrings.verifySuccessMessage,
                  style: AppTypography.body.copyWith(color: scheme.onSurfaceVariant),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.xxl),
                CtmsButton(label: VerifyStrings.goToLoginNow, onPressed: onGoToLoginNow),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
