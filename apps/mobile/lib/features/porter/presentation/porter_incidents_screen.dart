import 'package:flutter/material.dart';

import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';

/// Placeholder for Figma frame #28 "Quản lý sự cố — Porter Dashboard"
/// (`docs/design/FIGMA-SCREEN-INVENTORY.md`). Reached from the porter
/// shell's "Thêm" sheet rather than the bottom nav itself. No API wiring
/// yet.
class PorterIncidentsScreen extends StatelessWidget {
  const PorterIncidentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const CtmsScaffold(
      title: 'Sự cố',
      subtitle: 'Báo cáo và theo dõi các sự cố trong chuyến trekking',
      body: CtmsEmptyState(
        icon: Icons.report_gmailerrorred_outlined,
        title: 'Quản lý sự cố — Porter Dashboard',
        message: 'Frame #28 · Đang được xây dựng.',
      ),
    );
  }
}
