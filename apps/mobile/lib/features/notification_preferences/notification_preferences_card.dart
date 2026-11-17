import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/ctms_button.dart';
import '../../core/widgets/ctms_section_card.dart';
import 'notification_preferences_api.dart';
import 'notification_preferences_controller.dart';

class NotificationPreferencesCard extends ConsumerWidget {
  const NotificationPreferencesCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(notificationPreferencesProvider);
    if (controller == null) return const SizedBox.shrink();
    final current = controller.current;
    return CtmsSectionCard(
      title: 'Cài đặt thông báo',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Chọn loại thông báo nhận trên điện thoại. Thông báo trong ứng dụng vẫn được giữ nguyên.',
          ),
          const SizedBox(height: AppSpacing.md),
          if (controller.loading) const LinearProgressIndicator(),
          if (current != null) ...[
            if (current.categories.isEmpty)
              const Text('Chưa có loại thông báo để cấu hình.'),
            for (final item in current.categories)
              Material(
                color: Colors.transparent,
                child: _CategoryRow(item: item, controller: controller),
              ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Thay đổi áp dụng từ đợt gửi kế tiếp. Thông báo đã gửi không bị thu hồi.',
              style: AppTypography.caption.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            if (controller.dirty) ...[
              const SizedBox(height: AppSpacing.sm),
              const Text(
                'Bạn có thay đổi chưa lưu. Hãy kiểm tra các lựa chọn trước khi lưu.',
              ),
            ],
          ],
          if (controller.error != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              controller.error!,
              style: const TextStyle(color: AppColors.statusDanger),
            ),
            const SizedBox(height: AppSpacing.sm),
            CtmsButton(
              label: current == null ? 'Thử lại' : 'Tải lại tùy chọn',
              variant: CtmsButtonVariant.secondary,
              onPressed: controller.loading || controller.saving
                  ? null
                  : controller.load,
            ),
          ],
          if (current != null && current.categories.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            CtmsButton(
              label: 'Lưu tùy chọn',
              isLoading: controller.saving,
              onPressed:
                  controller.loading ||
                      controller.needsReload ||
                      !controller.dirty
                  ? null
                  : () async {
                      final result = await controller.save();
                      if (!context.mounted ||
                          ref.read(notificationPreferencesProvider) !=
                              controller) {
                        return;
                      }
                      if (result == PreferenceSaveResult.ignored) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            result == PreferenceSaveResult.saved
                                ? 'Đã lưu cài đặt thông báo.'
                                : controller.error!,
                          ),
                        ),
                      );
                    },
            ),
          ],
        ],
      ),
    );
  }
}

class _CategoryRow extends StatelessWidget {
  const _CategoryRow({required this.item, required this.controller});
  final NotificationCategory item;
  final NotificationPreferencesController controller;

  @override
  Widget build(BuildContext context) {
    final locked = !item.configurable;
    final explanation = locked
        ? 'Luôn bật để bảo đảm an toàn. Không thể tắt loại thông báo này.'
        : item.mandatoryOverride == 'red_weather'
        ? 'Chỉ tắt thông báo thời tiết thường. Cảnh báo thời tiết đỏ luôn được gửi.'
        : null;
    return SwitchListTile(
      key: ValueKey('preference-${item.id}'),
      contentPadding: EdgeInsets.zero,
      title: Text(
        item.label,
        style: AppTypography.body.copyWith(fontWeight: FontWeight.w600),
      ),
      subtitle: explanation == null ? null : Text(explanation),
      secondary: locked
          ? const Icon(Icons.lock_outline, semanticLabel: 'Bị khóa, luôn bật')
          : null,
      value: controller.value(item),
      onChanged: locked || controller.loading || controller.saving
          ? null
          : (value) => controller.change(item, value),
    );
  }
}
