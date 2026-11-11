import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../application/auth_controller.dart';
import '../domain/auth_user.dart';

class UnsupportedMobileRoleScreen extends ConsumerWidget {
  const UnsupportedMobileRoleScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).valueOrNull;
    final message = user == null
        ? 'Vai trò này chưa hỗ trợ trên ứng dụng mobile.'
        : '${user.displayName} · ${user.email}\nVai trò này quản lý CTMS trên web dashboard.';

    return CtmsScaffold(
      title: 'Không hỗ trợ trên mobile',
      body: CtmsEmptyState(
        icon: Icons.desktop_windows_outlined,
        title: 'Dùng web dashboard',
        message: message,
        action: CtmsButton(
          label: 'Đăng xuất',
          variant: CtmsButtonVariant.danger,
          onPressed: () => ref.read(authControllerProvider.notifier).logout(),
        ),
      ),
    );
  }
}
