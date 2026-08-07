import 'package:flutter/material.dart';

/// Design tokens — mirrors `docs/design/CTMS-DESIGN-SYSTEM.md` §1 and the
/// CSS variables in `apps/web/src/index.css`. Single source of truth for
/// color in this app; nothing outside `core/theme/` should hardcode a hex
/// value.
class AppColors {
  AppColors._();

  // Brand — §1.1 (matches --brand-* in apps/web/src/index.css)
  static const brandPrimary = Color(0xFF164027);
  static const brandSecondary = Color(0xFF2D5A27);
  static const brandAccent = Color(0xFF276143);
  static const brandLight = Color(0xFFEEF7F0);
  static const brandBg = Color(0xFFF4F7F2);
  static const brandDark = Color(0xFF10221B);

  // Status — §1.2 (matches --status-* in apps/web/src/index.css)
  static const statusSuccess = Color(0xFF16A34A);
  static const statusWarning = Color(0xFFD97706);
  static const statusDanger = Color(0xFFDC2626);
  static const statusInfo = Color(0xFF0284C7);
  static const statusNeutral = Color(0xFF64748B);

  // Neutral — §1.3
  static const surface = Color(0xFFFFFFFF);
  static const surfaceMuted = Color(0xFFF8FAF8);
  static const border = Color(0xFFE5EAE6);
  static const borderStrong = Color(0xFFCBD5E1);
  static const textPrimary = Color(0xFF10221B);
  static const textSecondary = Color(0xFF4B5563);
  static const textMuted = Color(0xFF9CA3AF);

  // Role accent — §1.4 (icon/nhấn phụ theo persona, brandPrimary vẫn là nền tảng)
  static const porterClay = Color(0xFFA85F28);
  static const camperLake = Color(0xFF2C6E8E);
}
