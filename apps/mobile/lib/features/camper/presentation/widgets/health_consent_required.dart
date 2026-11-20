import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/ctms_button.dart';
import '../../../../core/widgets/ctms_empty_state.dart';
import '../camper_profile_screen.dart';

class HealthConsentRequired extends StatelessWidget {
  const HealthConsentRequired({super.key, this.onRetry});

  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      CtmsEmptyState(
        icon: Icons.health_and_safety_outlined,
        title: 'Cần cho phép chia sẻ hồ sơ sức khỏe',
        message:
            'Vào Hồ sơ → Sức khỏe và thể lực, cập nhật thông tin và bật chia sẻ để hệ thống có thể phân tích và gợi ý chuyến đi.',
        action: CtmsButton(
          label: 'Mở hồ sơ sức khỏe',
          onPressed: () async {
            await Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const CamperProfileScreen(initialTab: 1),
              ),
            );
            if (context.mounted) onRetry?.call();
          },
        ),
      ),
      if (onRetry != null) ...[
        const SizedBox(height: AppSpacing.sm),
        CtmsButton(
          label: 'Kiểm tra lại quyền chia sẻ',
          onPressed: onRetry,
          variant: CtmsButtonVariant.ghost,
        ),
      ],
    ],
  );
}
