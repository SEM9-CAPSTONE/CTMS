import 'package:flutter/widgets.dart';

/// Corner radii — mirrors `docs/design/CTMS-DESIGN-SYSTEM.md` §1.6 and Web rounded-2xl tokens.
class AppRadius {
  AppRadius._();

  static const card = 16.0;
  static const control = 10.0;
  static const pill = 999.0;
  static const avatar = 999.0;
  static const iconBox = 12.0;

  static const cardBorderRadius = BorderRadius.all(Radius.circular(card));
  static const controlBorderRadius = BorderRadius.all(Radius.circular(control));
  static const pillBorderRadius = BorderRadius.all(Radius.circular(pill));
  static const iconBoxBorderRadius = BorderRadius.all(Radius.circular(iconBox));
}
