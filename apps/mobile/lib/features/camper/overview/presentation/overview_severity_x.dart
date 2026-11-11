import '../../../../core/widgets/ctms_status_badge.dart';
import '../domain/camper_overview_models.dart';

/// Maps the domain-level [OverviewSeverity] to the UI's [CtmsStatus] —
/// kept as a presentation-layer extension so `camper_overview_models.dart`
/// stays free of any widget import.
extension OverviewSeverityX on OverviewSeverity {
  CtmsStatus get ctmsStatus => switch (this) {
    OverviewSeverity.info => CtmsStatus.info,
    OverviewSeverity.warning => CtmsStatus.warning,
    OverviewSeverity.danger => CtmsStatus.danger,
    OverviewSeverity.success => CtmsStatus.success,
    OverviewSeverity.neutral => CtmsStatus.neutral,
  };
}
