import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';

/// §2.9 AlertBanner. `emergency` is the full-bleed solid variant (e.g. the
/// `SOS: 01 YÊU CẦU HỖ TRỢ CHƯA XỬ LÝ` banner) — every other severity is the
/// left-border-4px, 8%-tint card.
///
/// ```dart
/// CtmsAlertBanner(
///   severity: CtmsAlertSeverity.warning,
///   title: 'Cảnh báo lệch tuyến',
///   message: 'Trần Cường lệch tuyến 15m — 5 phút trước',
///   timestamp: '5 phút trước',
///   actions: [
///     CtmsButton(label: 'Xem trên bản đồ', onPressed: openMap),
///   ],
/// )
/// CtmsAlertBanner(
///   severity: CtmsAlertSeverity.emergency,
///   title: 'SOS: 01 yêu cầu chưa xử lý',
///   message: 'Vị trí: Trạm kiểm soát số 3 - Nhóm Tà Năng 02',
///   actions: [CtmsButton(label: 'XỬ LÝ NGAY', onPressed: handleSos)],
/// )
/// ```
enum CtmsAlertSeverity { info, warning, danger, emergency }

class CtmsAlertBanner extends StatelessWidget {
  const CtmsAlertBanner({
    super.key,
    required this.severity,
    required this.title,
    required this.message,
    this.timestamp,
    this.icon,
    this.actions = const [],
  });

  final CtmsAlertSeverity severity;
  final String title;
  final String message;
  final String? timestamp;
  final IconData? icon;
  final List<Widget> actions;

  Color get _color => switch (severity) {
    CtmsAlertSeverity.info => AppColors.statusInfo,
    CtmsAlertSeverity.warning => AppColors.statusWarning,
    CtmsAlertSeverity.danger || CtmsAlertSeverity.emergency => AppColors.statusDanger,
  };

  IconData get _icon =>
      icon ??
      switch (severity) {
        CtmsAlertSeverity.info => Icons.info_outline,
        CtmsAlertSeverity.warning => Icons.warning_amber_outlined,
        CtmsAlertSeverity.danger => Icons.dangerous_outlined,
        CtmsAlertSeverity.emergency => Icons.sos_outlined,
      };

  @override
  Widget build(BuildContext context) {
    final isEmergency = severity == CtmsAlertSeverity.emergency;
    final color = _color;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: isEmergency ? color : color.withValues(alpha: 0.08),
        borderRadius: AppRadius.cardBorderRadius,
        border: isEmergency ? null : Border(left: BorderSide(color: color, width: 4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: isEmergency ? Colors.white.withValues(alpha: 0.16) : color.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(_icon, size: 18, color: isEmergency ? Colors.white : color),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTypography.h3.copyWith(color: isEmergency ? Colors.white : color),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      message,
                      style: AppTypography.body.copyWith(
                        color: isEmergency ? Colors.white : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              if (timestamp != null) ...[
                const SizedBox(width: AppSpacing.sm),
                Text(
                  timestamp!,
                  style: AppTypography.caption.copyWith(
                    color: isEmergency ? Colors.white.withValues(alpha: 0.85) : AppColors.textMuted,
                  ),
                ),
              ],
            ],
          ),
          if (actions.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Wrap(spacing: AppSpacing.sm, runSpacing: AppSpacing.sm, children: actions),
          ],
        ],
      ),
    );
  }
}
