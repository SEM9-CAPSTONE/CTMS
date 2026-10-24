import 'package:flutter/material.dart';

/// Design tokens — mirrors `apps/web/src/index.css` and the Web UI components.
/// Single source of truth for color in this app.
class AppColors {
  AppColors._();

  // Brand — (matches --brand-* in apps/web/src/index.css)
  static const brandPrimary = Color(0xFF164027); // #164027 Deep forest green (CTA, brand mark)
  static const brandSecondary = Color(0xFF2D5A27); // #2D5A27
  static const brandAccent = Color(0xFF276143); // #276143 Active link, accent
  static const brandLight = Color(0xFFEEF7F0); // #EEF7F0 Web signature light mint green
  static const brandLightBorder = Color(0xFFDFE8DF); // #DFE8DF Web card & component border
  static const brandLightSurface = Color(0xFFF8FAF7); // #F8FAF7 Softest surface
  static const brandLightMuted = Color(0xFFE2EFE5); // #E2EFE5
  static const brandBg = Color(0xFFF8FAF7); // #F8FAF7 Web Login page background (white / ultra-light gray)
  static const brandDark = Color(0xFF10221B); // #10221B Main typography text
  static const brandEmerald = Color(0xFF10B981); // Emerald accent

  // Status — matches Web StatusBadge.tsx
  // Success (emerald-50 / emerald-200 / emerald-700)
  static const statusSuccessBg = Color(0xFFECFDF5);
  static const statusSuccessBorder = Color(0xFFA7F3D0);
  static const statusSuccess = Color(0xFF047857);

  // Warning (amber-50 / amber-200 / amber-700)
  static const statusWarningBg = Color(0xFFFFFBEB);
  static const statusWarningBorder = Color(0xFFFDE68A);
  static const statusWarning = Color(0xFFB45309);

  // Danger (red-50 / red-200 / red-700)
  static const statusDangerBg = Color(0xFFFEF2F2);
  static const statusDangerBorder = Color(0xFFFECACA);
  static const statusDanger = Color(0xFFB91C1C);

  // Info (sky-50 / sky-200 / sky-700)
  static const statusInfoBg = Color(0xFFF0F9FF);
  static const statusInfoBorder = Color(0xFFBAE6FD);
  static const statusInfo = Color(0xFF0369A1);

  // Neutral (slate-100 / slate-200 / slate-600)
  static const statusNeutralBg = Color(0xFFF1F5F9);
  static const statusNeutralBorder = Color(0xFFE2E8F0);
  static const statusNeutral = Color(0xFF475569);

  // Neutral — Web tokens
  static const surface = Color(0xFFFFFFFF); // Pure white
  static const surfaceMuted = Color(0xFFF8FAF7);
  static const surfaceContainerHighest = Color(0xFF243B30);
  static const border = Color(0xFFDFE8DF); // #DFE8DF Matches web Card border
  static const borderStrong = Color(0xFFCBD5E1);
  static const textPrimary = Color(0xFF10221B); // #10221B Main heading text
  static const textSecondary = Color(0xFF425048); // #425048 Subheading text
  static const textMuted = Color(0xFF7B8C82); // #7B8C82 Caption & label text

  // Role accent
  static const porterClay = Color(0xFFA85F28);
  static const camperLake = Color(0xFF2C6E8E);

  // Reusable Shadows for White + Light Green Web Aesthetic
  static const cardShadowSm = [
    BoxShadow(
      color: Color(0x06164027),
      blurRadius: 4,
      offset: Offset(0, 1),
    ),
  ];

  static const cardShadow = [
    BoxShadow(
      color: Color(0x0A164027),
      blurRadius: 10,
      offset: Offset(0, 3),
    ),
    BoxShadow(
      color: Color(0x04164027),
      blurRadius: 3,
      offset: Offset(0, 1),
    ),
  ];

  static const cardShadowLg = [
    BoxShadow(
      color: Color(0x10164027),
      blurRadius: 16,
      offset: Offset(0, 4),
    ),
  ];

  static const gradientHero = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFFFFFFF),
      Color(0xFFEEF7F0),
    ],
  );

  static const gradientMintSubtle = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Color(0xFFFFFFFF),
      Color(0xFFF4FAF5),
    ],
  );
}
