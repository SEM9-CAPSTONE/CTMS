import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../register_strings.dart';

/// Step 2 — Tài khoản: Email + Mật khẩu + Xác nhận mật khẩu. The confirm
/// field is validation-only — it never gets committed to
/// [RegisterFormData]/the API payload, it just catches typos before the
/// user moves on.
class RegisterAccountStep extends StatefulWidget {
  const RegisterAccountStep({
    super.key,
    required this.formKey,
    required this.emailController,
    required this.passwordController,
    required this.confirmPasswordController,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController emailController;
  final TextEditingController passwordController;
  final TextEditingController confirmPasswordController;

  @override
  State<RegisterAccountStep> createState() => _RegisterAccountStepState();
}

class _RegisterAccountStepState extends State<RegisterAccountStep> {
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  static final _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  @override
  Widget build(BuildContext context) {
    final mutedColor = Theme.of(context).colorScheme.onSurfaceVariant;

    return Form(
      key: widget.formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(RegisterStrings.accountStepTitle, style: AppTypography.h2),
          const SizedBox(height: AppSpacing.xs),
          Text(
            RegisterStrings.accountStepSubtitle,
            style: AppTypography.body.copyWith(color: mutedColor),
          ),
          const SizedBox(height: AppSpacing.xxl),
          TextFormField(
            controller: widget.emailController,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: RegisterStrings.emailLabel,
              prefixIcon: Icon(Icons.alternate_email),
            ),
            validator: (value) =>
                _emailPattern.hasMatch(value?.trim() ?? '') ? null : RegisterStrings.emailError,
          ),
          const SizedBox(height: AppSpacing.lg),
          TextFormField(
            controller: widget.passwordController,
            obscureText: _obscurePassword,
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              labelText: RegisterStrings.passwordLabel,
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                ),
                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
              ),
            ),
            validator: (value) =>
                (value == null || value.length < 6) ? RegisterStrings.passwordError : null,
          ),
          const SizedBox(height: AppSpacing.lg),
          TextFormField(
            controller: widget.confirmPasswordController,
            obscureText: _obscureConfirmPassword,
            textInputAction: TextInputAction.done,
            decoration: InputDecoration(
              labelText: RegisterStrings.confirmPasswordLabel,
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscureConfirmPassword
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                ),
                onPressed: () =>
                    setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
              ),
            ),
            validator: (value) => value == widget.passwordController.text
                ? null
                : RegisterStrings.confirmPasswordError,
          ),
        ],
      ),
    );
  }
}
