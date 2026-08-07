import 'package:flutter/material.dart';

import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';

/// Placeholder for Figma frame #21 "Khám phá khu cắm trại"
/// (`docs/design/FIGMA-SCREEN-INVENTORY.md`). No API wiring yet.
class CamperExploreScreen extends StatelessWidget {
  const CamperExploreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const CtmsScaffold(
      title: 'Khám phá',
      subtitle: 'Tìm địa điểm cho chuyến đi tiếp theo',
      body: CtmsEmptyState(
        icon: Icons.explore_outlined,
        title: 'Khám phá khu cắm trại',
        message: 'Frame #21 · Đang được xây dựng.',
      ),
    );
  }
}
