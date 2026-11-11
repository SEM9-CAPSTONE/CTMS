import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../application/member_locations_controller.dart';
import '../data/member_locations_api.dart';

String _hhmm(DateTime? value) {
  if (value == null) return '—';
  final local = value.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(local.hour)}:${two(local.minute)}';
}

String _ago(DateTime value, DateTime now) {
  final seconds = now.difference(value).inSeconds;
  if (seconds < 60) return 'vừa xong';
  final minutes = seconds ~/ 60;
  if (minutes < 60) return '$minutes phút trước';
  return '${minutes ~/ 60} giờ ${minutes % 60} phút trước';
}

// CtmsSectionCard is always white, so text uses the fixed text tokens like its title.
final _body = AppTypography.body.copyWith(color: AppColors.textPrimary);
final _bodyStrong = AppTypography.bodyStrong.copyWith(
  color: AppColors.textPrimary,
);
final _caption = AppTypography.caption.copyWith(color: AppColors.textSecondary);

const _freshnessLabels = {
  LocationFreshness.fresh: 'Mới',
  LocationFreshness.stale: 'Cũ',
  LocationFreshness.unavailable: 'Chưa có dữ liệu',
};

const _freshnessTones = {
  LocationFreshness.fresh: CtmsStatus.success,
  LocationFreshness.stale: CtmsStatus.warning,
  LocationFreshness.unavailable: CtmsStatus.neutral,
};

const _freshnessRank = {
  LocationFreshness.stale: 1,
  LocationFreshness.unavailable: 2,
  LocationFreshness.fresh: 3,
};

DateTime _systemClock() => DateTime.now();

/// CTMS-066-T02: each Trip member's last server-confirmed location for the assigned Porter.
/// Only what the server returns is shown; the Porter's own unsynced samples are never merged in.
class PorterMemberLocationsPanel extends ConsumerStatefulWidget {
  const PorterMemberLocationsPanel({
    super.key,
    required this.tripId,
    this.clock = _systemClock,
  });

  final String tripId;
  final DateTime Function() clock;

  @override
  ConsumerState<PorterMemberLocationsPanel> createState() =>
      _PorterMemberLocationsPanelState();
}

class _PorterMemberLocationsPanelState
    extends ConsumerState<PorterMemberLocationsPanel> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    // Freshness labels follow the clock between fetches.
    _ticker = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(
      memberLocationsControllerProvider(widget.tripId),
    );
    final data = controller.data;
    final now = widget.clock();
    final children = <Widget>[
      Text(
        'Vị trí server đã nhận gần nhất, không phải vị trí trực tiếp.',
        style: _caption,
      ),
      const SizedBox(height: AppSpacing.sm),
    ];

    final status = controller.errorStatus;
    if (controller.isLoading && data == null) {
      children.add(Text('Đang tải vị trí thành viên…', style: _caption));
    } else if (controller.lastRefreshFailed &&
        (status == 403 || status == 404)) {
      children.add(
        const CtmsAlertBanner(
          key: Key('member-locations-restricted'),
          severity: CtmsAlertSeverity.info,
          title: 'Không có quyền xem',
          message:
              'Bạn không được phân công cho chuyến này nên không xem được vị trí thành viên.',
        ),
      );
    } else if (controller.lastRefreshFailed && status == 409) {
      children.add(
        Text('Chỉ theo dõi vị trí khi chuyến đi đang diễn ra.', style: _body),
      );
    } else if (data == null) {
      children.add(
        CtmsAlertBanner(
          severity: CtmsAlertSeverity.warning,
          title: 'Không tải được vị trí thành viên',
          message: 'Kiểm tra kết nối mạng rồi thử lại.',
          actions: [
            CtmsButton(
              label: 'Thử lại',
              variant: CtmsButtonVariant.soft,
              onPressed: controller.refresh,
            ),
          ],
        ),
      );
    } else {
      if (controller.lastRefreshFailed) {
        children
          ..add(
            Text(
              'Không cập nhật được — đang hiển thị dữ liệu lúc ${_hhmm(data.generatedAt)}.',
              key: const Key('member-locations-stale'),
              style: _caption,
            ),
          )
          ..add(const SizedBox(height: AppSpacing.sm));
      }
      if (data.members.isEmpty) {
        children.add(
          Text('Chuyến đi chưa có thành viên nào để theo dõi.', style: _body),
        );
      } else {
        final maxAge = data.freshnessMaxAgeSeconds;
        int rank(MemberLocation member) => member.hasSafetyWarning
            ? 0
            : _freshnessRank[member.freshnessAt(now, maxAge)]!;
        final members = [...data.members]
          ..sort((a, b) {
            final byRank = rank(a).compareTo(rank(b));
            return byRank != 0
                ? byRank
                : (a.name ?? '').compareTo(b.name ?? '');
          });
        for (final member in members) {
          children.add(
            _MemberRow(member: member, now: now, maxAgeSeconds: maxAge),
          );
        }
      }
      children.add(
        Row(
          children: [
            Expanded(
              child: Text(
                'Cập nhật lúc ${_hhmm(data.generatedAt)} · tự làm mới mỗi phút',
                style: _caption,
              ),
            ),
            CtmsButton(
              label: 'Làm mới',
              variant: CtmsButtonVariant.ghost,
              onPressed: controller.refresh,
            ),
          ],
        ),
      );
    }

    return CtmsSectionCard(
      title: 'Vị trí thành viên',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    );
  }
}

class _MemberRow extends StatelessWidget {
  const _MemberRow({
    required this.member,
    required this.now,
    required this.maxAgeSeconds,
  });

  final MemberLocation member;
  final DateTime now;
  final int maxAgeSeconds;

  @override
  Widget build(BuildContext context) {
    final freshness = member.freshnessAt(now, maxAgeSeconds);
    final role = member.isPorter ? 'Porter' : 'Camper';
    final location = member.location;
    final seen = member.lastSeenAt;
    final flags = <Widget>[
      if (member.hasLeft) const CtmsStatusBadge(label: 'Đã rời đoàn'),
      if (member.offRoute)
        const CtmsStatusBadge(label: 'Lệch tuyến', status: CtmsStatus.danger),
      if (member.gpsDegraded)
        const CtmsStatusBadge(label: 'GPS yếu', status: CtmsStatus.warning),
      if (member.isBehind)
        CtmsStatusBadge(
          label: member.behindStatus == 'SEVERELY_BEHIND'
              ? 'Chậm nghiêm trọng${member.lagMinutes != null ? ' · ${member.lagMinutes} phút' : ''}'
              : 'Chậm hơn đoàn${member.lagMinutes != null ? ' · ${member.lagMinutes} phút' : ''}',
          status: member.behindStatus == 'SEVERELY_BEHIND'
              ? CtmsStatus.danger
              : CtmsStatus.warning,
        ),
    ];
    return Padding(
      key: Key('member-location-${member.id}'),
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${member.name ?? role} · $role',
                  style: _bodyStrong,
                ),
              ),
              CtmsStatusBadge(
                key: Key('member-freshness-${member.id}-${freshness.name}'),
                label: _freshnessLabels[freshness]!,
                status: _freshnessTones[freshness]!,
              ),
            ],
          ),
          if (flags.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: flags,
            ),
          ],
          const SizedBox(height: AppSpacing.xs),
          if (location != null && seen != null) ...[
            Text('Ghi lúc ${_hhmm(seen)} (${_ago(seen, now)})', style: _body),
            Text(
              '${location.latitude.toStringAsFixed(5)}, ${location.longitude.toStringAsFixed(5)}'
              ' · ±${location.accuracyMeters.round()} m',
              style: _caption,
            ),
          ] else
            Text(
              'Server chưa nhận được vị trí nào của thành viên này.',
              style: _caption,
            ),
          if (member.lastCheckpointName != null)
            Text(
              'Checkpoint gần nhất: ${member.lastCheckpointName} · ${_hhmm(member.lastCheckpointAt)}',
              style: _caption,
            ),
          Text(
            'Đồng bộ gần nhất: ${_hhmm(member.lastSyncedAt)}',
            style: _caption,
          ),
        ],
      ),
    );
  }
}
