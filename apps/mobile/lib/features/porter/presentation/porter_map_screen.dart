import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_status_badge.dart';

class PorterMapScreen extends StatelessWidget {
  const PorterMapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return CtmsScaffold(
      title: 'Bản đồ',
      subtitle: 'Bản đồ tuyến trekking & trạm checkpoint ngoại tuyến',
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        children: [
          // 1. Current Telemetry Status Card
          Container(
            padding: const EdgeInsets.all(AppSpacing.cardPadding),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: AppRadius.cardBorderRadius,
              border: Border.all(color: AppColors.border, width: 1.0),
              boxShadow: AppColors.cardShadowSm,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Tuyến Sơn Trà – Bãi Bắc',
                      style: AppTypography.h3.copyWith(
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const CtmsStatusBadge(
                      label: 'GPS Đang bật',
                      status: CtmsStatus.success,
                      showDot: true,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Vị trí hiện tại: 11.5312° N, 108.4380° E • Suối Yavly',
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                ),
                const SizedBox(height: AppSpacing.md),
                const Divider(height: 1, thickness: 1, color: AppColors.border),
                const SizedBox(height: AppSpacing.md),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _MapStat(label: 'ĐỘ CAO', value: '1.120 m'),
                    Container(width: 1, height: 32, color: AppColors.border),
                    _MapStat(label: 'TỐC ĐỘ', value: '3.2 km/h'),
                    Container(width: 1, height: 32, color: AppColors.border),
                    _MapStat(label: 'QUÃNG ĐƯỜNG', value: '5.4 / 12.5 km'),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.lg),

          // 2. Map Visual Placeholder Frame
          Container(
            height: 200,
            decoration: BoxDecoration(
              color: AppColors.brandBg,
              borderRadius: AppRadius.cardBorderRadius,
              border: Border.all(color: AppColors.border, width: 1.0),
            ),
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.map_outlined, size: 48, color: AppColors.textPrimary),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Bản đồ địa hình ngoại tuyến đã sẵn sàng',
                    style: AppTypography.bodyStrong.copyWith(color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 2),
                  const Text('Gói bản đồ v2.4 • Đã lưu trên bộ nhớ máy', style: AppTypography.caption),
                ],
              ),
            ),
          ),

          const SizedBox(height: AppSpacing.xxl),

          // 3. Checkpoints on Route
          Text(
            'Các trạm Checkpoint trên tuyến',
            style: AppTypography.h3.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _CheckpointRow(
            number: '1',
            name: 'Trạm kiểm lâm Cổng Bắc (Xuất phát)',
            time: '06:30 • Đã hoàn thành',
            isCurrent: false,
            isPassed: true,
          ),
          const SizedBox(height: AppSpacing.sm),
          _CheckpointRow(
            number: '2',
            name: 'Suối Yavly (Nghỉ chân tiếp nước)',
            time: '13:45 • Vị trí hiện tại',
            isCurrent: true,
            isPassed: false,
          ),
          const SizedBox(height: AppSpacing.sm),
          _CheckpointRow(
            number: '3',
            name: 'Đồi Cỏ Cháy (Điểm ngắm hoàng hôn)',
            time: 'Dự kiến 15:30 • Cách 2.8 km',
            isCurrent: false,
            isPassed: false,
          ),
          const SizedBox(height: AppSpacing.sm),
          _CheckpointRow(
            number: '4',
            name: 'Bãi Bắc Basecamp (Điểm hạ trại)',
            time: 'Dự kiến 16:30 • Đích đến',
            isCurrent: false,
            isPassed: false,
          ),

          const SizedBox(height: AppSpacing.xxl),

          // 4. Action Buttons
          Row(
            children: [
              Expanded(
                child: CtmsButton(
                  label: 'Tải lại bản đồ',
                  icon: Icons.download_outlined,
                  variant: CtmsButtonVariant.secondary,
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Bản đồ ngoại tuyến đã cập nhật mới nhất')),
                    );
                  },
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: CtmsButton(
                  label: 'Đánh dấu tọa độ',
                  icon: Icons.add_location_alt_outlined,
                  variant: CtmsButtonVariant.primary,
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Đã ghim tọa độ hiện tại vào nhật ký ca trực')),
                    );
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MapStat extends StatelessWidget {
  const _MapStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: AppTypography.label.copyWith(fontSize: 10, color: AppColors.textSecondary)),
        const SizedBox(height: 2),
        Text(value, style: AppTypography.bodyStrong.copyWith(color: AppColors.textPrimary)),
      ],
    );
  }
}

class _CheckpointRow extends StatelessWidget {
  const _CheckpointRow({
    required this.number,
    required this.name,
    required this.time,
    required this.isCurrent,
    required this.isPassed,
  });

  final String number;
  final String name;
  final String time;
  final bool isCurrent;
  final bool isPassed;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(
          color: isCurrent ? AppColors.brandPrimary : AppColors.border,
          width: isCurrent ? 1.5 : 1.0,
        ),
        boxShadow: AppColors.cardShadowSm,
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 14,
            backgroundColor: isPassed
                ? AppColors.brandPrimary
                : (isCurrent ? AppColors.brandLight : AppColors.brandBg),
            child: Text(
              number,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: isPassed ? Colors.white : AppColors.textPrimary,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: AppTypography.bodyStrong.copyWith(color: AppColors.textPrimary),
                ),
                Text(time, style: AppTypography.caption.copyWith(color: AppColors.textSecondary)),
              ],
            ),
          ),
          if (isPassed)
            const Icon(Icons.check_circle, color: AppColors.brandPrimary, size: 18)
          else if (isCurrent)
            const CtmsStatusBadge(label: 'Hiện tại', status: CtmsStatus.info, showDot: true),
        ],
      ),
    );
  }
}
