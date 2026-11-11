import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/auth_controller.dart';

class LogoutActions extends ConsumerStatefulWidget {
  const LogoutActions({super.key});

  @override
  ConsumerState<LogoutActions> createState() => _LogoutActionsState();
}

class _LogoutActionsState extends ConsumerState<LogoutActions> {
  bool _isSubmitting = false;
  String? _errorMessage;

  Future<void> _logout({required bool allDevices}) async {
    if (_isSubmitting) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      await ref
          .read(authControllerProvider.notifier)
          .logout(allDevices: allDevices);
    } catch (_) {
      if (!mounted) return;

      setState(() {
        _errorMessage =
            'Không thể đăng xuất lúc này. Vui lòng thử lại.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Future<void> _confirmLogoutAllDevices() async {
    if (_isSubmitting) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Đăng xuất khỏi tất cả thiết bị?'),
          content: const Text(
            'Bạn sẽ bị đăng xuất khỏi tất cả thiết bị đang sử dụng tài khoản này.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Đăng xuất tất cả'),
            ),
          ],
        );
      },
    );

    if (confirmed == true) {
      await _logout(allDevices: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        OutlinedButton.icon(
          key: const Key('logout-current-device'),
          onPressed: _isSubmitting
              ? null
              : () => _logout(allDevices: false),
          icon: const Icon(Icons.logout),
          label: const Text('Đăng xuất thiết bị này'),
        ),

        const SizedBox(height: 12),

        OutlinedButton.icon(
          key: const Key('logout-all-devices'),
          onPressed:
              _isSubmitting ? null : _confirmLogoutAllDevices,
          icon: const Icon(Icons.devices),
          label: const Text('Đăng xuất tất cả thiết bị'),
        ),

        if (_isSubmitting) ...[
          const SizedBox(height: 16),
          const Center(
            child: CircularProgressIndicator(),
          ),
        ],

        if (_errorMessage != null) ...[
          const SizedBox(height: 12),
          Text(
            _errorMessage!,
            key: const Key('logout-error'),
            style: TextStyle(
              color: Theme.of(context).colorScheme.error,
            ),
          ),
        ],
      ],
    );
  }
}