import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/domain/auth_user.dart';
import '../../auth/presentation/widgets/logout_actions.dart';

class PorterSettingsScreen extends ConsumerWidget {
  const PorterSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).valueOrNull;

    return CtmsScaffold(
      title: 'Hồ sơ & cài đặt',
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CtmsEmptyState(
              icon: Icons.person_outline,
              title: 'Hồ sơ & cài đặt',
              message: user == null
                  ? 'Đang được xây dựng.'
                  : '${user.displayName} · ${user.email}\nĐang được xây dựng.',
            ),

            const SizedBox(height: 24),

            const LogoutActions(),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}