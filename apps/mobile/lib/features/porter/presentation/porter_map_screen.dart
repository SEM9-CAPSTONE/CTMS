import 'package:flutter/material.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../gps_tracking/presentation/porter_gps_tracking_section.dart';

/// Porter Map screen displaying the verified offline map, checkpoints,
/// live GPS breadcrumbs, and team progress for the ongoing assigned trip.
class PorterMapScreen extends StatelessWidget {
  const PorterMapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return CtmsScaffold(
      title: 'Bản đồ',
      subtitle: 'Bản đồ tuyến trekking & trạm checkpoint ngoại tuyến',
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        children: const [
          PorterGpsTrackingSection(),
        ],
      ),
    );
  }
}
