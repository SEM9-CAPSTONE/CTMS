import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

/// Standard CTMS Brand Logo widget with asset loading & resilient web fallbacks.
class CtmsLogo extends StatelessWidget {
  const CtmsLogo({
    super.key,
    this.size = 28.0,
    this.showText = true,
    this.badgeText,
  });

  final double size;
  final bool showText;
  final String? badgeText;

  @override
  Widget build(BuildContext context) {
    final logoImage = Image.asset(
      'assets/images/ctms_logo.png',
      width: size,
      height: size,
      fit: BoxFit.contain,
      errorBuilder: (context, error, stackTrace) => Image.network(
        'ctms_logo.png',
        width: size,
        height: size,
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) => Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: AppColors.brandPrimary,
            borderRadius: BorderRadius.circular(size * 0.25),
          ),
          alignment: Alignment.center,
          child: Icon(Icons.terrain, color: Colors.white, size: size * 0.6),
        ),
      ),
    );

    if (!showText && badgeText == null) {
      return logoImage;
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        logoImage,
        if (showText) ...[
          const SizedBox(width: AppSpacing.sm),
          const Text(
            'CTMS',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: 18,
              letterSpacing: -0.5,
            ),
          ),
        ],
        if (badgeText != null) ...[
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppColors.border),
            ),
            child: Text(
              badgeText!,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
