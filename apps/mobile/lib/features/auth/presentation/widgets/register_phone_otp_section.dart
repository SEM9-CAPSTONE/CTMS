import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_button.dart';
import '../../../../core/widgets/ctms_status_badge.dart';
import '../../application/register_controller.dart';
import '../register_strings.dart';

/// Phone verification part of Step 3 ("Thông tin cá nhân & xác thực"):
/// phone → OTP → verified. Once verified it collapses to a compact
/// success badge — there's nothing left for the user to do with this
/// phone number in this step.
class RegisterPhoneOtpSection extends ConsumerWidget {
  const RegisterPhoneOtpSection({
    super.key,
    required this.phoneController,
    required this.otpController,
  });

  final TextEditingController phoneController;
  final TextEditingController otpController;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wizardState = ref.watch(registerControllerProvider);
    final controller = ref.read(registerControllerProvider.notifier);
    final scheme = Theme.of(context).colorScheme;

    if (wizardState.data.phoneVerifiedAt != null) {
      return Row(
        children: [
          const CtmsStatusBadge(
            label: RegisterStrings.phoneVerifiedLabel,
            status: CtmsStatus.success,
            icon: Icons.check_circle_outline,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              phoneController.text,
              style: AppTypography.bodyStrong,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextFormField(
          controller: phoneController,
          enabled: !wizardState.otpSent,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(
            labelText: RegisterStrings.phoneLabel,
            prefixIcon: Icon(Icons.call_outlined),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (!wizardState.otpSent)
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: phoneController,
            builder: (context, value, _) {
              final canSend = value.text.trim().length >= 9;
              return Align(
                alignment: Alignment.centerLeft,
                child: CtmsButton(
                  label: RegisterStrings.sendOtp,
                  variant: CtmsButtonVariant.secondary,
                  isLoading: wizardState.isProcessingOtp,
                  onPressed: canSend && !wizardState.isProcessingOtp
                      ? () => controller.sendOtp(value.text)
                      : null,
                ),
              );
            },
          )
        else ...[
          Text(
            RegisterStrings.otpHint,
            style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextFormField(
            controller: otpController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: RegisterStrings.otpLabel,
              prefixIcon: const Icon(Icons.password_outlined),
              errorText: wizardState.otpError,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: CtmsButton(
                  label: RegisterStrings.verifyOtp,
                  isLoading: wizardState.isProcessingOtp,
                  onPressed: wizardState.isProcessingOtp
                      ? null
                      : () => controller.verifyOtp(otpController.text),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              CtmsButton(
                label: RegisterStrings.resendOtp,
                variant: CtmsButtonVariant.ghost,
                onPressed: wizardState.isProcessingOtp
                    ? null
                    : () => controller.sendOtp(phoneController.text),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
