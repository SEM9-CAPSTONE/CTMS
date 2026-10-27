import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_radius.dart';
import 'app_spacing.dart';
import 'app_typography.dart';

/// Builds the Material 3 [ThemeData] for both brightnesses straight from
/// [AppColors]/[AppTypography]/[AppSpacing]/[AppRadius].
///
/// Features a fresh, modern White + Light Green palette mirroring the web app.
class AppTheme {
  AppTheme._();

  static ThemeData light() => _build(_lightScheme);

  static ThemeData dark() => _build(_darkScheme);

  static const _lightScheme = ColorScheme.light(
    primary: AppColors.brandPrimary,
    onPrimary: Colors.white,
    primaryContainer: AppColors.brandLight,
    onPrimaryContainer: AppColors.brandPrimary,
    secondary: AppColors.brandSecondary,
    onSecondary: Colors.white,
    tertiary: AppColors.brandAccent,
    onTertiary: Colors.white,
    error: AppColors.statusDanger,
    onError: Colors.white,
    surface: AppColors.surface,
    onSurface: AppColors.textPrimary,
    surfaceContainerHighest: AppColors.surfaceMuted,
    onSurfaceVariant: AppColors.textSecondary,
    outline: AppColors.border,
    outlineVariant: AppColors.borderStrong,
  );

  static const _darkScheme = ColorScheme.dark(
    primary: AppColors.brandAccent,
    onPrimary: AppColors.brandLight,
    primaryContainer: AppColors.brandPrimary,
    onPrimaryContainer: AppColors.brandLight,
    secondary: AppColors.brandSecondary,
    onSecondary: AppColors.brandLight,
    tertiary: AppColors.brandSecondary,
    onTertiary: AppColors.brandLight,
    error: AppColors.statusDanger,
    onError: Colors.white,
    surface: AppColors.brandDark,
    onSurface: AppColors.brandLight,
    surfaceContainerHighest: AppColors.surfaceContainerHighest,
    onSurfaceVariant: AppColors.textMuted,
    outline: AppColors.textSecondary,
    outlineVariant: AppColors.textMuted,
  );

  static ThemeData _build(ColorScheme scheme) {
    final isDark = scheme.brightness == Brightness.dark;
    final scaffoldBackground = isDark ? AppColors.brandDark : AppColors.brandBg;
    final inputFill = isDark ? scheme.surface : AppColors.surface;

    return ThemeData(
      useMaterial3: true,
      brightness: scheme.brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: scaffoldBackground,
      textTheme: _textTheme(scheme),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.textPrimary,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: AppTypography.h2.copyWith(
          color: isDark ? Colors.white : AppColors.textPrimary,
          fontWeight: FontWeight.w800,
        ),
        iconTheme: IconThemeData(
          color: isDark ? Colors.white : AppColors.textPrimary,
        ),
      ),
      cardTheme: CardThemeData(
        color: scheme.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.cardBorderRadius,
          side: BorderSide(
            color: isDark ? scheme.outline : AppColors.border,
            width: 1.2,
          ),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.brandPrimary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: scheme.outline,
          disabledForegroundColor: scheme.onSurfaceVariant,
          minimumSize: const Size(64, 42),
          elevation: 0,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          textStyle: AppTypography.bodyStrong,
          shape: const StadiumBorder(),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          backgroundColor: isDark ? Colors.transparent : Colors.white,
          foregroundColor: isDark ? Colors.white : Colors.black,
          side: BorderSide(
            color: isDark ? scheme.outlineVariant : AppColors.border,
            width: 1.2,
          ),
          minimumSize: const Size(64, 42),
          elevation: 0,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          textStyle: AppTypography.bodyStrong,
          shape: const StadiumBorder(),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: isDark ? AppColors.brandLight : AppColors.brandAccent,
          textStyle: AppTypography.bodyStrong,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: inputFill,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        labelStyle: AppTypography.body.copyWith(color: scheme.onSurfaceVariant),
        floatingLabelStyle: AppTypography.body.copyWith(
          color: isDark ? Colors.white : AppColors.textPrimary,
          fontWeight: FontWeight.w600,
        ),
        hintStyle: AppTypography.body.copyWith(color: AppColors.textMuted),
        border: OutlineInputBorder(
          borderRadius: AppRadius.controlBorderRadius,
          borderSide: BorderSide(color: scheme.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.controlBorderRadius,
          borderSide: BorderSide(color: scheme.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.controlBorderRadius,
          borderSide: const BorderSide(color: AppColors.brandPrimary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadius.controlBorderRadius,
          borderSide: BorderSide(color: scheme.error),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: scheme.surfaceContainerHighest,
        selectedColor: scheme.primaryContainer,
        labelStyle: AppTypography.caption.copyWith(color: scheme.onSurface),
        side: BorderSide(color: scheme.outline),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
        shape: const StadiumBorder(),
      ),
      dividerTheme: DividerThemeData(color: scheme.outline, thickness: 1, space: 1),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: scheme.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        indicatorColor: isDark ? scheme.primaryContainer : AppColors.brandLight,
        indicatorShape: const StadiumBorder(),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final isSelected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: isSelected
                ? (isDark ? Colors.white : AppColors.brandPrimary)
                : AppColors.textMuted,
            size: 24,
          );
        }),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) {
            final isSelected = states.contains(WidgetState.selected);
            return AppTypography.caption.copyWith(
              color: isSelected
                  ? (isDark ? Colors.white : AppColors.brandPrimary)
                  : AppColors.textMuted,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            );
          },
        ),
      ),
    );
  }

  static TextTheme _textTheme(ColorScheme scheme) {
    return TextTheme(
      displayLarge: AppTypography.display.copyWith(color: scheme.onSurface),
      headlineLarge: AppTypography.h1.copyWith(color: scheme.onSurface),
      headlineMedium: AppTypography.h2.copyWith(color: scheme.onSurface),
      headlineSmall: AppTypography.h3.copyWith(color: scheme.onSurface),
      titleMedium: AppTypography.bodyStrong.copyWith(color: scheme.onSurface),
      bodyLarge: AppTypography.body.copyWith(color: scheme.onSurface),
      bodyMedium: AppTypography.body.copyWith(color: scheme.onSurface),
      bodySmall: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
      labelLarge: AppTypography.bodyStrong.copyWith(color: scheme.onSurface),
      labelMedium: AppTypography.label.copyWith(color: scheme.onSurfaceVariant),
      labelSmall: AppTypography.label.copyWith(color: scheme.onSurfaceVariant),
    );
  }
}
