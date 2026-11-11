import 'package:flutter/material.dart';

/// Type scale — mirrors `docs/design/CTMS-DESIGN-SYSTEM.md` §1.5.
///
/// Font stays the platform default (system sans — SF Pro / Roboto), same
/// choice as `apps/web/src/index.css`'s `system-ui` stack, so no `fontFamily`
/// is set here.
///
/// These styles carry no [Color] — [AppTheme] applies the right
/// light/dark-aware color when it builds the [TextTheme]. `label` is
/// UPPERCASE per the design system; Flutter has no `text-transform`, so
/// callers must uppercase the string themselves, e.g. `Text(label.toUpperCase(), style: AppTypography.label)`.
class AppTypography {
  AppTypography._();

  static const display = TextStyle(fontSize: 32, fontWeight: FontWeight.w700, height: 40 / 32);

  static const h1 = TextStyle(fontSize: 28, fontWeight: FontWeight.w700, height: 36 / 28);

  static const h2 = TextStyle(fontSize: 20, fontWeight: FontWeight.w600, height: 28 / 20);

  static const h3 = TextStyle(fontSize: 16, fontWeight: FontWeight.w600, height: 24 / 16);

  static const body = TextStyle(fontSize: 14, fontWeight: FontWeight.w400, height: 20 / 14);

  static const bodyStrong = TextStyle(fontSize: 14, fontWeight: FontWeight.w600, height: 20 / 14);

  static const caption = TextStyle(fontSize: 12, fontWeight: FontWeight.w400, height: 16 / 12);

  static const label = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    height: 16 / 11,
    letterSpacing: 11 * 0.06,
  );
}
