import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/offline_map_models.dart';

/// Renders the verified checkpoints from the active offline package.
///
/// Distances from current GPS location are calculated via direct Haversine formula
/// and explicitly labeled as straight-line distance ("đường chim bay") to prevent
/// confusion with remaining trail walking distance.
class OfflineMapCheckpointList extends StatelessWidget {
  const OfflineMapCheckpointList({
    super.key,
    required this.checkpoints,
    this.currentLocation,
    this.isStale = false,
    this.onSelectCheckpoint,
  });

  final List<OfflineMapCheckpoint> checkpoints;
  final OfflineMapLocationState? currentLocation;
  final bool isStale;
  final ValueChanged<OfflineMapCheckpoint>? onSelectCheckpoint;

  String _formatDistance(double meters) {
    if (meters < 1000) {
      return '${meters.round()} m';
    }
    return '${(meters / 1000.0).toStringAsFixed(1)} km';
  }

  @override
  Widget build(BuildContext context) {
    if (checkpoints.isEmpty) {
      return const SizedBox.shrink();
    }

    final sample = currentLocation?.sample;
    final hasFix = sample != null && currentLocation?.status == OfflineMapGpsStatus.ready;
    final isPoor = currentLocation?.quality == GpsSignalQuality.poor;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          children: [
            Text(
              'Các trạm kiểm tra trên tuyến (${checkpoints.length})',
              style: AppTypography.bodyStrong.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
            if (hasFix)
              Text(
                'Khoảng cách đường chim bay',
                style: AppTypography.caption.copyWith(
                  color: AppColors.textMuted,
                  fontSize: 10.5,
                ),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        for (int i = 0; i < checkpoints.length; i++) ...[
          () {
            final distMeters = hasFix
                ? OfflineRoutePoint(
                    latitude: sample.latitude,
                    longitude: sample.longitude,
                  ).distanceTo(
                    OfflineRoutePoint(
                      latitude: checkpoints[i].latitude,
                      longitude: checkpoints[i].longitude,
                    ),
                  )
                : null;
            final isArrived = distMeters != null && distMeters <= checkpoints[i].radiusMeters;
            return _CheckpointItemCard(
              order: i + 1,
              checkpoint: checkpoints[i],
              distanceText: distMeters != null ? _formatDistance(distMeters) : null,
              isArrived: isArrived,
              isStale: isStale,
              isPoor: isPoor,
              onTap: onSelectCheckpoint != null ? () => onSelectCheckpoint!(checkpoints[i]) : null,
            );
          }(),
          if (i < checkpoints.length - 1) const SizedBox(height: AppSpacing.xs),
        ],
      ],
    );
  }
}

class _CheckpointItemCard extends StatelessWidget {
  const _CheckpointItemCard({
    required this.order,
    required this.checkpoint,
    this.distanceText,
    this.isArrived = false,
    required this.isStale,
    required this.isPoor,
    this.onTap,
  });

  final int order;
  final OfflineMapCheckpoint checkpoint;
  final String? distanceText;
  final bool isArrived;
  final bool isStale;
  final bool isPoor;
  final VoidCallback? onTap;

  static String _cleanName(String name) {
    return name.replaceAllMapped(RegExp(r'\((\d+)\s*m\)'), (m) => '(độ cao ↑${m[1]} m)');
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.controlBorderRadius,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: isArrived ? const Color(0xFFF4F9F2) : AppColors.surface,
            borderRadius: AppRadius.controlBorderRadius,
            border: Border.all(
              color: isArrived ? const Color(0xFF81C784) : AppColors.border,
              width: isArrived ? 1.5 : 1.0,
            ),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 12,
                backgroundColor: isArrived ? const Color(0xFF2E7D32) : AppColors.brandLight,
                child: isArrived
                    ? const Icon(Icons.check, size: 14, color: Colors.white)
                    : Text(
                        '$order',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: AppColors.brandPrimary,
                        ),
                      ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _cleanName(checkpoint.name),
                      style: AppTypography.bodyStrong.copyWith(
                        color: isArrived ? const Color(0xFF1B5E20) : AppColors.textPrimary,
                        fontSize: 13,
                      ),
                    ),
                    Text(
                      'Loại: ${checkpoint.type} · Bán kính ${checkpoint.radiusMeters.round()} m',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                    if (checkpoint.instructions != null && checkpoint.instructions!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        checkpoint.instructions!,
                        style: AppTypography.caption.copyWith(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                          fontStyle: FontStyle.italic,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              if (isArrived)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text(
                      'ĐÃ TỚI',
                      style: TextStyle(
                        color: Color(0xFF2E7D32),
                        fontWeight: FontWeight.w900,
                        fontSize: 11.5,
                      ),
                    ),
                    Text(
                      'Bán kính ${checkpoint.radiusMeters.round()} m',
                      style: AppTypography.caption.copyWith(
                        color: const Color(0xFF388E3C),
                        fontSize: 9.5,
                      ),
                    ),
                  ],
                )
              else if (distanceText != null)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Cách ~$distanceText',
                      style: AppTypography.caption.copyWith(
                        color: isStale ? AppColors.textMuted : AppColors.brandPrimary,
                        fontWeight: FontWeight.w800,
                        fontSize: 11.5,
                      ),
                    ),
                    if (isStale)
                      Text(
                        '(Mẫu cũ)',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.statusWarning,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      )
                    else if (isPoor)
                      Text(
                        '(Sai số >20m)',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.statusWarning,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                  ],
                )
              else
                Text(
                  'Chưa có GPS',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.textMuted,
                    fontSize: 11,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

