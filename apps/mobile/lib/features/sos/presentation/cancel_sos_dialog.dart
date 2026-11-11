import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../application/sos_controller.dart';
import '../domain/sos_alert.dart';

class CancelSosDialog extends ConsumerStatefulWidget {
  const CancelSosDialog({
    super.key,
    required this.tripId,
    required this.alert,
  });

  final String tripId;
  final SosAlert alert;

  static Future<SosAlert?> show(
    BuildContext context, {
    required String tripId,
    required SosAlert alert,
  }) {
    return showModalBottomSheet<SosAlert>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CancelSosDialog(tripId: tripId, alert: alert),
    );
  }

  @override
  ConsumerState<CancelSosDialog> createState() => _CancelSosDialogState();
}

class _CancelSosDialogState extends ConsumerState<CancelSosDialog> {
  final _reasonController = TextEditingController();
  String? _localError;

  static const _quickReasons = [
    'Cấn nút điện thoại khi chụp ảnh / xem bản đồ',
    'Trượt tay bấm nhầm nút khẩn cấp',
    'Thử nghiệm tính năng hệ thống',
    'Tình huống đã an toàn, không cần cứu hộ',
  ];

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  void _selectQuickReason(String reason) {
    setState(() {
      _reasonController.text = reason;
      _localError = null;
    });
  }

  Future<void> _submitCancellation() async {
    final reason = _reasonController.text.trim();
    if (reason.isEmpty) {
      setState(() => _localError = 'Vui lòng cung cấp lý do hủy báo động');
      return;
    }
    if (reason.length > 500) {
      setState(() => _localError = 'Lý do hủy không được vượt quá 500 ký tự');
      return;
    }

    setState(() => _localError = null);

    final controller = ref.read(sosControllerProvider(widget.tripId));
    final result = await controller.cancel(
      sosId: widget.alert.id,
      reason: reason,
    );

    if (!mounted) return;

    if (result != null) {
      Navigator.of(context).pop(result);
    } else {
      setState(() {
        _localError = controller.error ?? 'Hủy SOS thất bại. Vui lòng thử lại.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(sosControllerProvider(widget.tripId));
    final isSubmitting = controller.submitting;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.lg,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.xl,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Drag handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.statusDangerBg,
                    borderRadius: AppRadius.controlBorderRadius,
                  ),
                  child: const Icon(
                    Icons.warning_amber_rounded,
                    color: AppColors.statusDanger,
                    size: 22,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'HỦY BÁO ĐỘNG SOS',
                        style: AppTypography.h3.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.statusDanger,
                        ),
                      ),
                      Text(
                        'Xác nhận hủy tín hiệu khẩn cấp gửi nhầm',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),

            const SizedBox(height: AppSpacing.md),

            // Warning Notice
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: AppRadius.controlBorderRadius,
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.info_outline,
                    size: 18,
                    color: Colors.amber.shade900,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      'Hành động này sẽ thông báo ngay lập tức cho Trưởng đoàn & Đội cứu hộ rằng bạn an toàn. Lịch sử cảnh báo vẫn được lưu vết đầy đủ trong hệ thống theo quy định.',
                      style: AppTypography.caption.copyWith(
                        color: Colors.amber.shade900,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: AppSpacing.md),

            // Quick Reasons Title
            Text(
              'Chọn nhanh lý do gửi nhầm:',
              style: AppTypography.label.copyWith(
                fontWeight: FontWeight.w700,
                color: Colors.black,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),

            // Quick Reason Chips
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: _quickReasons.map((reason) {
                final isSelected = _reasonController.text == reason;
                return ChoiceChip(
                  label: Text(
                    reason,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected ? Colors.white : Colors.black87,
                    ),
                  ),
                  selected: isSelected,
                  selectedColor: AppColors.brandPrimary,
                  backgroundColor: AppColors.surfaceMuted,
                  onSelected: (_) => _selectQuickReason(reason),
                );
              }).toList(),
            ),

            const SizedBox(height: AppSpacing.md),

            // Custom Reason Input
            Text(
              'Hoặc tự nhập lý do chi tiết (bắt buộc):',
              style: AppTypography.label.copyWith(
                fontWeight: FontWeight.w700,
                color: Colors.black,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),

            TextField(
              controller: _reasonController,
              maxLines: 3,
              maxLength: 500,
              decoration: InputDecoration(
                hintText: 'Nhập rõ nguyên nhân gửi nhầm tín hiệu...',
                hintStyle: AppTypography.caption.copyWith(
                  color: AppColors.textMuted,
                ),
                filled: true,
                fillColor: AppColors.surfaceMuted,
                border: OutlineInputBorder(
                  borderRadius: AppRadius.controlBorderRadius,
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                contentPadding: const EdgeInsets.all(AppSpacing.md),
              ),
              onChanged: (_) {
                if (_localError != null) setState(() => _localError = null);
              },
            ),

            // Error display
            if (_localError != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                _localError!,
                style: AppTypography.caption.copyWith(
                  color: AppColors.statusDanger,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],

            const SizedBox(height: AppSpacing.lg),

            // Action Buttons
            Row(
              children: [
                Expanded(
                  child: CtmsButton(
                    label: 'Đóng',
                    variant: CtmsButtonVariant.secondary,
                    onPressed: isSubmitting
                        ? null
                        : () => Navigator.of(context).pop(),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  flex: 2,
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: CtmsButton(
                      label: isSubmitting ? 'ĐANG HỦY...' : 'XÁC NHẬN HỦY SOS',
                      variant: CtmsButtonVariant.danger,
                      isLoading: isSubmitting,
                      icon: Icons.cancel_outlined,
                      onPressed: isSubmitting ? null : _submitCancellation,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
