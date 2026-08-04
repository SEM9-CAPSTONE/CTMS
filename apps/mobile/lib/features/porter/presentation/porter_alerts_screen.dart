import 'package:flutter/material.dart';

import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';

/// Placeholder for Figma frame #31 "Trung tâm cảnh báo"
/// (`docs/design/FIGMA-SCREEN-INVENTORY.md`). No API wiring yet.
class PorterAlertsScreen extends StatelessWidget {
  const PorterAlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const CtmsScaffold(
      title: 'Cảnh báo',
      subtitle: 'Theo dõi các cảnh báo về chuyến đi, thời tiết, thành viên và hệ thống',
      body: CtmsEmptyState(
        icon: Icons.notifications_active_outlined,
        title: 'Trung tâm cảnh báo',
        message: 'Frame #31 · Đang được xây dựng.',
      ),
    );
  }
}
