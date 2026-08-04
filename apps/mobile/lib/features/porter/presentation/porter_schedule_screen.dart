import 'package:flutter/material.dart';

import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';

/// Placeholder for Figma frame #26 "Lịch phân công"
/// (`docs/design/FIGMA-SCREEN-INVENTORY.md`). No API wiring yet.
class PorterScheduleScreen extends StatelessWidget {
  const PorterScheduleScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const CtmsScaffold(
      title: 'Lịch',
      subtitle: 'Theo dõi và xác nhận các ca trekking được giao cho bạn',
      body: CtmsEmptyState(
        icon: Icons.event_note_outlined,
        title: 'Lịch phân công',
        message: 'Frame #26 · Đang được xây dựng.',
      ),
    );
  }
}
