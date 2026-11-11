import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../login_strings.dart';

/// "☐ Ghi nhớ — Quên mật khẩu?" row (§A.2).
class LoginRememberRow extends StatelessWidget {
  const LoginRememberRow({
    super.key,
    required this.rememberMe,
    required this.onRememberMeChanged,
    required this.onForgotPassword,
  });

  final bool rememberMe;
  final ValueChanged<bool> onRememberMeChanged;
  final VoidCallback onForgotPassword;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
          height: 24,
          width: 24,
          child: Checkbox(
            value: rememberMe,
            activeColor: AppColors.brandPrimary,
            side: const BorderSide(color: AppColors.borderStrong),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
            onChanged: (value) => onRememberMeChanged(value ?? false),
          ),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: () => onRememberMeChanged(!rememberMe),
          child: Text(
            LoginStrings.rememberMe,
            style: AppTypography.body.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        const Spacer(),
        TextButton(
          onPressed: onForgotPassword,
          style: TextButton.styleFrom(
            foregroundColor: AppColors.brandPrimary,
            padding: EdgeInsets.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: const Text(
            LoginStrings.forgotPassword,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.brandPrimary,
            ),
          ),
        ),
      ],
    );
  }
}
