import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../application/checkpoint_arrival_controller.dart';
import '../domain/checkpoint_arrival_models.dart';
import 'widgets/checkpoint_reached_dialog.dart';

/// Panel hiển thị tiến độ và trạng thái phát hiện tự động điểm kiểm tra (CTMS-061).
class CheckpointArrivalPanel extends ConsumerStatefulWidget {
  const CheckpointArrivalPanel({
    super.key,
    required this.tripId,
    this.onSelectCheckpoint,
    this.showReachedDialog = true,
    this.distanceNote,
    this.showDistances = true,
  });

  final String tripId;
  final bool showReachedDialog;
  final bool showDistances;
  final String? distanceNote;
  final ValueChanged<RouteCheckpoint>? onSelectCheckpoint;

  @override
  ConsumerState<CheckpointArrivalPanel> createState() =>
      _CheckpointArrivalPanelState();
}

class _CheckpointArrivalPanelState
    extends ConsumerState<CheckpointArrivalPanel> {
  String? _dialogShownForId;

  void _maybeShowReachedDialog(CheckpointArrivalController controller) {
    final reached = controller.activeReachedDialog;
    if (reached == null) {
      if (_dialogShownForId != null &&
          !controller.record.arrivals.any(
            (a) => a.checkpointId == _dialogShownForId,
          )) {
        _dialogShownForId = null;
      }
      return;
    }
    if (reached.id == _dialogShownForId) return;

    _dialogShownForId = reached.id;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(
        showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (dialogContext) => CheckpointReachedDialog(
            checkpoint: reached,
            onDismiss: () {
              _dialogShownForId = null;
              controller.dismissReachedDialog();
              Navigator.of(dialogContext).pop();
            },
          ),
        ),
      );
    });
  }

  (String, CtmsStatus) _statusBadge(CheckpointArrivalController controller) =>
      switch (controller.status) {
        CheckpointArrivalStatus.checking => ('Đang tải...', CtmsStatus.neutral),
        CheckpointArrivalStatus.active => ('Đang theo dõi', CtmsStatus.success),
        CheckpointArrivalStatus.paused => ('Tạm dừng', CtmsStatus.warning),
        CheckpointArrivalStatus.unavailable => (
          'Chưa có dữ liệu',
          CtmsStatus.neutral,
        ),
      };

  (String, CtmsStatus) _itemBadge(CheckpointUiItem item) {
    if (!item.isReached) {
      return ('Chưa đến', CtmsStatus.neutral);
    }
    return switch (item.syncState) {
      CheckpointSyncState.synced => ('Đã đồng bộ', CtmsStatus.success),
      CheckpointSyncState.pending => ('Đã đến (Ngoại tuyến)', CtmsStatus.info),
      CheckpointSyncState.paused => ('Tạm dừng đồng bộ', CtmsStatus.warning),
      CheckpointSyncState.failed => ('Lỗi đồng bộ', CtmsStatus.danger),
      null => ('Đã đến', CtmsStatus.success),
    };
  }

  String _formatTime(DateTime? time) {
    if (time == null) return '';
    final local = time.toLocal();
    final h = local.hour.toString().padLeft(2, '0');
    final m = local.minute.toString().padLeft(2, '0');
    final s = local.second.toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(
      checkpointArrivalControllerProvider(widget.tripId),
    );
    if (widget.showReachedDialog) _maybeShowReachedDialog(controller);

    final (statusLabel, statusColor) = _statusBadge(controller);
    final items = controller.uiItems;

    return CtmsSectionCard(
      title: 'Điểm kiểm tra tự động',
      trailing: CtmsStatusBadge(
        label: statusLabel,
        status: statusColor,
        showDot: controller.status == CheckpointArrivalStatus.active,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Placeholder khi chưa có ngữ cảnh dữ liệu điểm kiểm tra
          if (controller.context == null || items.isEmpty) ...[
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppColors.statusNeutralBg,
                borderRadius: AppRadius.controlBorderRadius,
                border: Border.all(color: AppColors.statusNeutralBorder),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.location_off_outlined,
                    color: AppColors.statusNeutral,
                    size: 24,
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Text(
                      'Chưa phát hiện được vì chưa có dữ liệu điểm kiểm tra',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.statusNeutral,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ] else ...[
            // 2. Thanh tiến độ tóm tắt
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              decoration: BoxDecoration(
                color: AppColors.brandLight,
                borderRadius: AppRadius.controlBorderRadius,
                border: Border.all(color: AppColors.brandLightBorder),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.flag_outlined,
                    color: AppColors.brandPrimary,
                    size: 20,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    'Đã ghi nhận: ${controller.reachedCount}/${controller.totalCount} trạm',
                    style: AppTypography.bodyStrong.copyWith(
                      color: AppColors.brandPrimary,
                    ),
                  ),
                  const Spacer(),
                  if (controller.pendingCount > 0)
                    CtmsStatusBadge(
                      label: '${controller.pendingCount} chờ gửi',
                      status: CtmsStatus.info,
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // Tiêu đề lộ trình điểm kiểm tra
            Text(
              widget.onSelectCheckpoint == null
                  ? 'Lộ trình điểm kiểm tra'
                  : 'Chọn trạm để xem trên bản đồ · Khoảng cách đường chim bay',
              style: AppTypography.caption.copyWith(
                fontWeight: FontWeight.w700,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),

            // 3. Danh sách các điểm kiểm tra
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: items.length,
              separatorBuilder: (context, index) =>
                  const Divider(height: 1, color: AppColors.border),
              itemBuilder: (context, index) {
                final item = items[index];
                final (badgeLabel, badgeStatus) = _itemBadge(item);

                return InkWell(
                  onTap: widget.onSelectCheckpoint == null
                      ? null
                      : () => widget.onSelectCheckpoint!(item.checkpoint),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: AppSpacing.sm,
                      horizontal: AppSpacing.xs,
                    ),
                    child: Row(
                      children: [
                        // Vòng tròn đánh số thứ tự
                        Container(
                          width: 28,
                          height: 28,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: item.isReached
                                ? AppColors.statusSuccessBg
                                : AppColors.statusNeutralBg,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: item.isReached
                                  ? AppColors.statusSuccessBorder
                                  : AppColors.statusNeutralBorder,
                            ),
                          ),
                          child: Text(
                            '${index + 1}',
                            style: AppTypography.caption.copyWith(
                              color: item.isReached
                                  ? AppColors.statusSuccess
                                  : AppColors.statusNeutral,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),

                        // Tên trạm và cự ly / thời gian
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.checkpoint.name.isNotEmpty
                                    ? item.checkpoint.name
                                    : 'Trạm kiểm tra #${index + 1}',
                                style: AppTypography.bodyStrong.copyWith(
                                  color: Colors.black,
                                ),
                              ),
                              if (item.isReached && item.confirmedAt != null)
                                Text(
                                  'Đã đến lúc: ${_formatTime(item.confirmedAt)}',
                                  style: AppTypography.caption.copyWith(
                                    color: AppColors.statusNeutral,
                                  ),
                                )
                              else if (widget.showDistances &&
                                  item.lastDistanceMeters != null)
                                Wrap(
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    Text(
                                      'Cách: ${item.lastDistanceMeters!.round()} m${widget.distanceNote == null ? '' : ' · ${widget.distanceNote}'}',
                                      style: AppTypography.caption.copyWith(
                                        color: item.lastDistanceMeters! <= 20.0
                                            ? AppColors.statusSuccess
                                            : AppColors.statusNeutral,
                                        fontWeight:
                                            item.lastDistanceMeters! <= 20.0
                                            ? FontWeight.w700
                                            : FontWeight.normal,
                                      ),
                                    ),
                                    if (item.lastDistanceMeters! <= 20.0 &&
                                        item.qualifyingSamplesCount > 0) ...[
                                      const SizedBox(width: AppSpacing.xs),
                                      Text(
                                        '(Đang xác nhận ${item.qualifyingSamplesCount}/3)',
                                        style: AppTypography.caption.copyWith(
                                          color: AppColors.statusSuccess,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),

                        // Badge trạng thái từng trạm
                        CtmsStatusBadge(label: badgeLabel, status: badgeStatus),
                      ],
                    ),
                  ),
                );
              },
            ),

            // 4. Báo lỗi nếu có
            if (controller.error != null) ...[
              const SizedBox(height: AppSpacing.md),
              CtmsAlertBanner(
                severity: CtmsAlertSeverity.warning,
                title: 'Lỗi đồng bộ',
                message: controller.error!,
              ),
            ],

            const SizedBox(height: AppSpacing.md),

            // 5. Nút Đồng bộ ngay
            SizedBox(
              width: double.infinity,
              child: CtmsButton(
                key: const Key('checkpoint-arrivals-manual-sync'),
                label: controller.syncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay',
                variant: CtmsButtonVariant.secondary,
                isLoading: controller.syncing,
                icon: Icons.sync,
                onPressed: controller.syncing
                    ? null
                    : () => controller.manualSync(force: true),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
