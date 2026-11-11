import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';

/// §2.15 Button — mirrors Web Button styles (HeroSection / Button.tsx).
/// Supports primary, secondary, soft (light green mint), ghost, and danger.
enum CtmsButtonVariant { primary, secondary, soft, ghost, danger }

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
    final height = size == CtmsButtonSize.lg ? 48.0 : 42.0;
    final horizontalPadding = size == CtmsButtonSize.lg ? AppSpacing.xxl : AppSpacing.xl;

    final onColor = switch (variant) {
      CtmsButtonVariant.primary => Colors.white,
      CtmsButtonVariant.secondary => Colors.black, // Pure black on white background
      CtmsButtonVariant.soft => AppColors.brandPrimary,
      CtmsButtonVariant.ghost => Colors.black,
      CtmsButtonVariant.danger => Colors.white,
    };

    final child = isLoading
        ? SizedBox(
            height: 18,
            width: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: onColor),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[Icon(icon, size: 18, color: onColor), const SizedBox(width: AppSpacing.sm)],
              Text(
                label,
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: onColor),
              ),
            ],
          );

    final pressed = isLoading ? null : onPressed;
    final sizeStyle = ButtonStyle(
      minimumSize: WidgetStatePropertyAll(Size(64, height)),
      padding: WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: horizontalPadding)),
      shape: const WidgetStatePropertyAll(StadiumBorder()),
    );

    return switch (variant) {
      CtmsButtonVariant.primary => ElevatedButton(
        onPressed: pressed,
        style: sizeStyle.copyWith(
          backgroundColor: const WidgetStatePropertyAll(AppColors.brandPrimary),
          foregroundColor: const WidgetStatePropertyAll(Colors.white),
          elevation: const WidgetStatePropertyAll(0),
        ),
        child: child,
      ),
      CtmsButtonVariant.secondary => OutlinedButton(
        onPressed: pressed,
        style: sizeStyle.copyWith(
          backgroundColor: const WidgetStatePropertyAll(Colors.white),
          foregroundColor: const WidgetStatePropertyAll(Colors.black),
          side: const WidgetStatePropertyAll(
            BorderSide(color: AppColors.borderStrong, width: 1.2),
          ),
          elevation: const WidgetStatePropertyAll(0),
        ),
        child: child,
      ),
      CtmsButtonVariant.soft => ElevatedButton(
        onPressed: pressed,
        style: sizeStyle.copyWith(
          backgroundColor: const WidgetStatePropertyAll(AppColors.brandLight),
          foregroundColor: const WidgetStatePropertyAll(AppColors.brandPrimary),
          elevation: const WidgetStatePropertyAll(0),
          side: const WidgetStatePropertyAll(
            BorderSide(color: AppColors.brandLightBorder, width: 1.2),
          ),
        ),
        child: child,
      ),
      CtmsButtonVariant.ghost => TextButton(
        onPressed: pressed,
        style: sizeStyle.copyWith(
          foregroundColor: const WidgetStatePropertyAll(Colors.black),
        ),
        child: child,
      ),
      CtmsButtonVariant.danger => ElevatedButton(
        onPressed: pressed,
        style: sizeStyle.copyWith(
          backgroundColor: const WidgetStatePropertyAll(AppColors.statusDanger),
          foregroundColor: const WidgetStatePropertyAll(Colors.white),
          elevation: const WidgetStatePropertyAll(0),
          textStyle: const WidgetStatePropertyAll(AppTypography.bodyStrong),
        ),
        child: child,
      ),
    };
  }
}
