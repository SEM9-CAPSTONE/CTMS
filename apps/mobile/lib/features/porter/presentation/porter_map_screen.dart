import 'package:flutter/material.dart';

import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';

/// Placeholder for Figma frame #29 "Bản đồ chuyến đi"
/// (`docs/design/FIGMA-SCREEN-INVENTORY.md`). No API wiring yet.
class PorterMapScreen extends StatelessWidget {
  const PorterMapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const CtmsScaffold(
      title: 'Bản đồ',
      body: CtmsEmptyState(
        icon: Icons.map_outlined,
        title: 'Bản đồ chuyến đi',
        message: 'Frame #29 · Đang được xây dựng.',
      ),
    );
  }
}
