import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_alert_banner.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../application/schedule_progress_controller.dart';
import '../data/schedule_progress_api.dart';

String _hhmm(DateTime value) {
  final local = value.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(local.hour)}:${two(local.minute)}';
}

// CtmsSectionCard is always white, so text uses the fixed text tokens like its title.
final _body = AppTypography.body.copyWith(color: AppColors.textPrimary);
final _bodyStrong = AppTypography.bodyStrong.copyWith(
  color: AppColors.textPrimary,
);
final _caption = AppTypography.caption.copyWith(color: AppColors.textSecondary);

const _statusLabels = {
  ScheduleStatus.onTrack: 'Theo kịp đoàn',
  ScheduleStatus.behind: 'Chậm hơn đoàn',
  ScheduleStatus.severelyBehind: 'Chậm nghiêm trọng',
  ScheduleStatus.locationUnknown: 'Chưa rõ vị trí',
};

const _statusTones = {
  ScheduleStatus.onTrack: CtmsStatus.success,
  ScheduleStatus.behind: CtmsStatus.warning,
  ScheduleStatus.severelyBehind: CtmsStatus.danger,
  ScheduleStatus.locationUnknown: CtmsStatus.neutral,
};

/// Most urgent first, so the Porter sees who needs an on-site decision (spec §13.5).
const _statusOrder = [
  ScheduleStatus.severelyBehind,
  ScheduleStatus.behind,
  ScheduleStatus.locationUnknown,
  ScheduleStatus.onTrack,
];

/// Loading / error / stale / not-running states shared by the Camper and Porter views.
class _ProgressFrame extends StatelessWidget {
  const _ProgressFrame({required this.controller, required this.builder});

  final ScheduleProgressController controller;
  final Widget Function(ScheduleProgress data) builder;

  @override
  Widget build(BuildContext context) {
    final data = controller.data;
    final children = <Widget>[];
    if (controller.isLoading && data == null) {
      children.add(Text('Đang tải tiến độ…', style: _caption));
    } else if (data == null) {
      children.add(
        CtmsAlertBanner(
          severity: CtmsAlertSeverity.warning,
          title: 'Không tải được tiến độ',
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
              'Không cập nhật được — đang hiển thị dữ liệu lúc ${_hhmm(data.evaluatedAt)}.',
              key: const Key('schedule-progress-stale'),
              style: _caption,
            ),
          )
          ..add(const SizedBox(height: AppSpacing.sm));
      }
      if (!data.isOngoing) {
        children.add(
          Text(
            'Chỉ theo dõi tiến độ khi chuyến đi đang diễn ra.',
            style: _body,
          ),
        );
      } else {
        children.add(builder(data));
      }
      children
        ..add(const SizedBox(height: AppSpacing.sm))
        ..add(
          Row(
            children: [
              Expanded(
                child: Text(
                  'Cập nhật lúc ${_hhmm(data.evaluatedAt)} · tự làm mới mỗi phút',
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    );
  }
}

/// CTMS-063-T02, Camper: their own status against the Porter, with the server's safe checkpoint and
/// guidance shown verbatim. Location unknown is never presented as "behind".
class CamperScheduleProgressPanel extends ConsumerWidget {
  const CamperScheduleProgressPanel({super.key, required this.tripId});

  final String tripId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(scheduleProgressControllerProvider(tripId));
    return CtmsSectionCard(
      title: 'Tiến độ so với đoàn',
      child: _ProgressFrame(
        controller: controller,
        builder: (data) {
          if (data.members.isEmpty) {
            return Text(
              'Bạn cần check-in tham gia chuyến đi để theo dõi tiến độ.',
              style: _body,
            );
          }
          return _CamperStatus(member: data.members.first);
        },
      ),
    );
  }
}

class _CamperStatus extends StatelessWidget {
  const _CamperStatus({required this.member});

  final MemberScheduleProgress member;

  @override
  Widget build(BuildContext context) {
    final reference = member.reference;
    switch (member.status) {
      case ScheduleStatus.behind:
      case ScheduleStatus.severelyBehind:
        final severe = member.status == ScheduleStatus.severelyBehind;
        return CtmsAlertBanner(
          key: Key('camper-schedule-${member.status.name}'),
          severity: severe
              ? CtmsAlertSeverity.danger
              : CtmsAlertSeverity.warning,
          title: severe
              ? 'Bạn đã tụt lại xa sau đoàn'
              : 'Bạn đang chậm hơn đoàn',
          message: [
            if (member.guidance != null) member.guidance!,
            if (reference != null)
              'Porter tới ${reference.checkpointName} lúc ${_hhmm(reference.porterArrivedAt)}.',
            'Điểm an toàn: ${member.safeCheckpointName ?? 'không có checkpoint an toàn gần đây'}',
          ].join('\n'),
        );
      case ScheduleStatus.locationUnknown:
        return CtmsAlertBanner(
          key: const Key('camper-schedule-locationUnknown'),
          severity: CtmsAlertSeverity.info,
          title: 'Chưa đánh giá được tiến độ',
          message:
              '${member.guidance ?? 'Không xác định được vị trí của bạn.'} '
              'Hãy bật theo dõi GPS để so sánh với đoàn.',
        );
      case ScheduleStatus.onTrack:
        return Column(
          key: const Key('camper-schedule-onTrack'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CtmsStatusBadge(
              label: _statusLabels[member.status]!,
              status: _statusTones[member.status]!,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              reference == null
                  ? 'Chưa có checkpoint nào được Porter xác nhận để so sánh.'
                  : 'Porter đã tới ${reference.checkpointName} lúc ${_hhmm(reference.porterArrivedAt)}.',
              style: _caption,
            ),
          ],
        );
    }
  }
}

/// CTMS-063-T02, Porter: every joined Camper's status, most urgent first, so the Porter decides on
/// site whether the group continues or turns back (spec §13.5).
class PorterTeamProgressPanel extends ConsumerWidget {
  const PorterTeamProgressPanel({super.key, required this.tripId});

  final String tripId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(scheduleProgressControllerProvider(tripId));
    return CtmsSectionCard(
      title: 'Tiến độ thành viên',
      child: _ProgressFrame(
        controller: controller,
        builder: (data) {
          if (data.members.isEmpty) {
            return Text('Chưa có Camper nào đã check-in.', style: _body);
          }
          final members = [...data.members]
            ..sort(
              (a, b) => _statusOrder
                  .indexOf(a.status)
                  .compareTo(_statusOrder.indexOf(b.status)),
            );
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final member in members) _PorterMemberRow(member: member),
            ],
          );
        },
      ),
    );
  }
}

class _PorterMemberRow extends StatelessWidget {
  const _PorterMemberRow({required this.member});

  final MemberScheduleProgress member;

  @override
  Widget build(BuildContext context) {
    final lag = member.isWarning && member.lagMinutes != null
        ? ' · chậm ${member.lagMinutes} phút'
        : '';
    return Padding(
      key: Key('porter-member-${member.userId}'),
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(member.fullName ?? 'Camper', style: _bodyStrong),
              ),
              CtmsStatusBadge(
                label: _statusLabels[member.status]!,
                status: _statusTones[member.status]!,
              ),
            ],
          ),
          if (member.reference != null)
            Text(
              'Mốc: ${member.reference!.checkpointName}$lag',
              style: _caption,
            ),
          if (member.isWarning)
            Text(
              'Điểm an toàn: ${member.safeCheckpointName ?? 'không có checkpoint an toàn gần đây'}',
              style: _caption,
            ),
        ],
      ),
    );
  }
}
