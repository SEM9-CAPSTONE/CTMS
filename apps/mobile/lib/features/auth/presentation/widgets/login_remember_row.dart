import 'package:flutter/material.dart';

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
    final scheme = Theme.of(context).colorScheme;

    return Row(
      children: [
        SizedBox(
          height: 24,
          width: 24,
          child: Checkbox(
            value: rememberMe,
            onChanged: (value) => onRememberMeChanged(value ?? false),
          ),
        ),
        const SizedBox(width: 6),
        GestureDetector(
          onTap: () => onRememberMeChanged(!rememberMe),
          child: Text(
            LoginStrings.rememberMe,
            style: AppTypography.body.copyWith(color: scheme.onSurface),
          ),
        ),
        const Spacer(),
        TextButton(
          onPressed: onForgotPassword,
          child: const Text(LoginStrings.forgotPassword),
        ),
      ],
    );
  }
}
