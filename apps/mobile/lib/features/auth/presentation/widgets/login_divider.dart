import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';

/// The "Hoặc đăng nhập bằng" rule-with-label between the primary form and
/// the social buttons (§A.2).
class LoginDivider extends StatelessWidget {
  const LoginDivider({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Row(
      children: [
        Expanded(child: Divider(color: scheme.outline)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          child: Text(label, style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant)),
        ),
        Expanded(child: Divider(color: scheme.outline)),
      ],
    );
  }
}
