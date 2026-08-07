import 'package:flutter/material.dart';

import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';

/// Placeholder for Figma frame #30 "Thành viên đoàn"
/// (`docs/design/FIGMA-SCREEN-INVENTORY.md`). Reached from the porter
/// shell's "Thêm" sheet rather than the bottom nav itself. No API wiring
/// yet.
class PorterTeamScreen extends StatelessWidget {
  const PorterTeamScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const CtmsScaffold(
      title: 'Thành viên đoàn',
      body: CtmsEmptyState(
        icon: Icons.groups_outlined,
        title: 'Thành viên đoàn',
        message: 'Frame #30 · Đang được xây dựng.',
      ),
    );
  }
}
