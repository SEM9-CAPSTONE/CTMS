import 'package:flutter/material.dart';

import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';

/// Placeholder for Figma frame #22 "Chuyến đi của tôi", plus the sidebar's
/// "Đơn đặt chỗ" item folded in as a sub-tab (no dedicated Camper frame in
/// `docs/design/FIGMA-SCREEN-INVENTORY.md` — bookings only get a full page
/// on the Admin/Host side). No API wiring yet.
class CamperTripsScreen extends StatelessWidget {
  const CamperTripsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: CtmsScaffold(
        title: 'Chuyến đi',
        subtitle: 'Quản lý các chuyến cắm trại và trekking của bạn',
        bottom: const TabBar(
          tabs: [Tab(text: 'Chuyến đi của tôi'), Tab(text: 'Đơn đặt chỗ')],
        ),
        body: const TabBarView(
          children: [
            CtmsEmptyState(
              icon: Icons.hiking_outlined,
              title: 'Chuyến đi của tôi',
              message: 'Frame #22 · Đang được xây dựng.',
            ),
            CtmsEmptyState(
              icon: Icons.event_note_outlined,
              title: 'Đơn đặt chỗ',
              message: 'Đang được xây dựng.',
            ),
          ],
        ),
      ),
    );
  }
}
