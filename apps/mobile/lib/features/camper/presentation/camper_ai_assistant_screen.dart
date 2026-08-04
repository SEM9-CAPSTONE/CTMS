import 'package:flutter/material.dart';

import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';

/// Placeholder for Figma frame #24 "Trợ lý sinh tồn AI"
/// (`docs/design/FIGMA-SCREEN-INVENTORY.md`). No API wiring yet.
class CamperAiAssistantScreen extends StatelessWidget {
  const CamperAiAssistantScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const CtmsScaffold(
      title: 'Trợ lý AI',
      body: CtmsEmptyState(
        icon: Icons.smart_toy_outlined,
        title: 'Trợ lý sinh tồn AI',
        message: 'Frame #24 · Đang được xây dựng.',
      ),
    );
  }
}
