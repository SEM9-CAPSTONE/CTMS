import 'package:flutter/material.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';

class CamperExploreScreen extends StatelessWidget {
  const CamperExploreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return CtmsScaffold(
      title: 'Khám phá',
      subtitle: 'Tìm tuyến trekking cho chuyến đi tiếp theo',
      body: const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: CtmsEmptyState(
          icon: Icons.route_outlined,
          title: 'Tính năng khám phá tuyến đang được cập nhật',
          message: 'Phạm vi hiện tại tập trung vào tuyến trekking và trip.',
        ),
      ),
    );
  }
}
