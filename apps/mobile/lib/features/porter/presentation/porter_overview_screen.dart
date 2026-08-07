import 'package:flutter/material.dart';

import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';

/// Placeholder for Figma frame #27 "Tổng quan — Porter Dashboard"
/// (`docs/design/FIGMA-SCREEN-INVENTORY.md`). No API wiring yet.
class PorterOverviewScreen extends StatelessWidget {
  const PorterOverviewScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const CtmsScaffold(
      title: 'Tổng quan',
      body: CtmsEmptyState(
        icon: Icons.dashboard_outlined,
        title: 'Tổng quan — Porter Dashboard',
        message: 'Frame #27 · Đang được xây dựng.',
      ),
    );
  }
}
