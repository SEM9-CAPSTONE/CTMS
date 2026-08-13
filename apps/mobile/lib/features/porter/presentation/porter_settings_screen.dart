import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/domain/auth_user.dart';

/// "Hồ sơ & cài đặt" — reached from the Porter "Thêm" sheet.
class PorterSettingsScreen extends ConsumerWidget {
  const PorterSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).valueOrNull;

    return CtmsScaffold(
      title: 'Hồ sơ & cài đặt',
      body: CtmsEmptyState(
        icon: Icons.person_outline,
        title: 'Hồ sơ & cài đặt',
        message: user == null
            ? 'Đang được xây dựng.'
            : '${user.displayName} · ${user.email}\nĐang được xây dựng.',
        action: CtmsButton(
          label: 'Đăng xuất',
          variant: CtmsButtonVariant.danger,
          onPressed: () => ref.read(authControllerProvider.notifier).logout(),
        ),
      ),
    );
  }
}
