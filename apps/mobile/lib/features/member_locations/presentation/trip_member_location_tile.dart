import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../../offline_packages/presentation/package_policy_copy.dart';
import '../data/member_locations_api.dart';

class TripMemberLocationTile extends StatelessWidget {
  const TripMemberLocationTile({
    super.key,
    required this.member,
    required this.now,
    required this.maxAgeSeconds,
    required this.onSelect,
    this.selected = false,
  });
  final MemberLocation member;
  final DateTime now;
  final int maxAgeSeconds;
  final VoidCallback? onSelect;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final freshness = member.freshnessAt(now, maxAgeSeconds);
    final fresh = freshness == LocationFreshness.fresh;
    final location = member.location;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  member.displayName,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: selected
                        ? AppColors.brandPrimary
                        : AppColors.textPrimary,
                  ),
                ),
              ),
              CtmsStatusBadge(
                label: location == null
                    ? 'Chưa có vị trí'
                    : fresh
                    ? 'Vị trí mới'
                    : 'Vị trí cũ',
                status: fresh ? CtmsStatus.success : CtmsStatus.neutral,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(member.isPorter ? 'Người dẫn đoàn' : 'Khách tham gia'),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              CtmsStatusBadge(
                label: member.routeLabel,
                status: member.offRoute
                    ? CtmsStatus.danger
                    : CtmsStatus.neutral,
              ),
              if (member.gpsDegraded)
                const CtmsStatusBadge(
                  label: 'Tín hiệu định vị yếu',
                  status: CtmsStatus.warning,
                ),
            ],
          ),
          if (member.routeEventAt != null)
            Text(
              'Trạng thái ghi lúc ${packageTime(member.routeEventAt!.toIso8601String())}',
            ),
          if (location != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Vị trí ghi lúc ${packageTime(location.eventTime.toIso8601String())}',
            ),
            Text(
              '${location.latitude.toStringAsFixed(5)}, ${location.longitude.toStringAsFixed(5)} · Sai số ${location.accuracyMeters.round()} m',
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: onSelect,
                child: Text(
                  selected ? 'Đang xem trên sơ đồ' : 'Xem vị trí trên sơ đồ',
                ),
              ),
            ),
          ] else
            const Text('Chưa nhận được vị trí đã đồng bộ của thành viên này.'),
        ],
      ),
    );
  }
}
