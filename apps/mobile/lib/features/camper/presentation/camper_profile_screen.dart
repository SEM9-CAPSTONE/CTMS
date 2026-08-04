import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../auth/application/auth_controller.dart';

/// Placeholder for Figma frame #25 "Hồ sơ & Cài đặt"
/// (`docs/design/FIGMA-SCREEN-INVENTORY.md`). The profile form itself isn't
/// built yet, but sign-out is real (it only clears local secure storage —
/// no API call), so the auth loop stays testable end to end.
class CamperProfileScreen extends ConsumerWidget {
  const CamperProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).valueOrNull;

    return CtmsScaffold(
      title: 'Hồ sơ',
      body: CtmsEmptyState(
        icon: Icons.person_outline,
        title: 'Hồ sơ & Cài đặt',
        message: user == null
            ? 'Frame #25 · Đang được xây dựng.'
            : '${user.fullName} · ${user.email}\nFrame #25 · Đang được xây dựng.',
        action: CtmsButton(
          label: 'Đăng xuất',
          variant: CtmsButtonVariant.danger,
          onPressed: () => ref.read(authControllerProvider.notifier).logout(),
        ),
      ),
    );
  }
}
