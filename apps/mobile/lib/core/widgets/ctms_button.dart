import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';

/// §2.15 Button. Wraps the Material button matching each [variant] — the
/// global [ElevatedButtonTheme]/[OutlinedButtonTheme]/[TextButtonTheme] set
/// in `app_theme.dart` already cover `primary`/`secondary`/`ghost`;
/// `danger` overrides the fill color inline since it has no dedicated theme.
///
/// ```dart
/// CtmsButton(
///   label: 'Báo cáo sự cố',
///   icon: Icons.report_outlined,
///   onPressed: () => reportIncident(),
/// )
/// CtmsButton(
///   label: 'Xoá tài khoản',
///   variant: CtmsButtonVariant.danger,
///   size: CtmsButtonSize.lg,
///   isLoading: isDeleting,
///   onPressed: isDeleting ? null : onDelete,
/// )
/// ```
enum CtmsButtonVariant { primary, secondary, ghost, danger }

enum CtmsButtonSize { md, lg }

class CtmsButton extends StatelessWidget {
  const CtmsButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = CtmsButtonVariant.primary,
    this.size = CtmsButtonSize.md,
    this.isLoading = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final CtmsButtonVariant variant;
  final CtmsButtonSize size;
  final bool isLoading;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final height = size == CtmsButtonSize.lg ? 48.0 : 40.0;
    final horizontalPadding = size == CtmsButtonSize.lg ? AppSpacing.xxl : AppSpacing.xl;
    final onColor = variant == CtmsButtonVariant.secondary || variant == CtmsButtonVariant.ghost
        ? Theme.of(context).colorScheme.onSurface
        : Colors.white;

    final child = isLoading
        ? SizedBox(
            height: 18,
            width: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: onColor),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: AppSpacing.sm)],
              Text(label),
            ],
          );

    final pressed = isLoading ? null : onPressed;
    final sizeStyle = ButtonStyle(
      minimumSize: WidgetStatePropertyAll(Size(64, height)),
      padding: WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: horizontalPadding)),
    );

    return switch (variant) {
      CtmsButtonVariant.primary => ElevatedButton(
        onPressed: pressed,
        style: sizeStyle,
        child: child,
      ),
      CtmsButtonVariant.secondary => OutlinedButton(
        onPressed: pressed,
        style: sizeStyle,
        child: child,
      ),
      CtmsButtonVariant.ghost => TextButton(onPressed: pressed, style: sizeStyle, child: child),
      CtmsButtonVariant.danger => ElevatedButton(
        onPressed: pressed,
        style: sizeStyle.copyWith(
          backgroundColor: const WidgetStatePropertyAll(AppColors.statusDanger),
          foregroundColor: const WidgetStatePropertyAll(Colors.white),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: AppRadius.controlBorderRadius),
          ),
          textStyle: WidgetStatePropertyAll(AppTypography.bodyStrong),
        ),
        child: child,
      ),
    };
  }
}
