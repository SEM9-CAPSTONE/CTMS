/// 4pt spacing grid — mirrors `docs/design/CTMS-DESIGN-SYSTEM.md` §1.6.
class AppSpacing {
  AppSpacing._();

  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 20.0;
  static const xxl = 24.0;
  static const xxxl = 32.0;
  static const xxxxl = 40.0;

  /// Card padding — design system calls for 20–24, this app standardizes on
  /// the lower bound ([xl]).
  static const cardPadding = xl;

  /// Gap between sibling cards in a list/grid.
  static const cardGap = lg;
}
