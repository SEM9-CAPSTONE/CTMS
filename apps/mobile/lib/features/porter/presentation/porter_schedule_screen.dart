import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_filter_chip_row.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_status_badge.dart';
import '../../sync/presentation/device_sync_status_screen.dart';
import '../../offline_packages/application/package_download_controller.dart';
import '../../offline_packages/presentation/saved_offline_packages_screen.dart';
import 'porter_offline_trips_screen.dart';

class _PorterShift {
  const _PorterShift({
    required this.id,
    required this.title,
    required this.time,
    required this.location,
    required this.membersText,
    required this.status,
    required this.statusType,
    required this.actionLabel,
    required this.actionVariant,
    this.isToday = false,
    this.tripId,
  });

  final String id;
  final String title;
  final String time;
  final String location;
  final String membersText;
  final String status;
  final CtmsStatus statusType;
  final String actionLabel;
  final CtmsButtonVariant actionVariant;
  final bool isToday;
  final String? tripId;
}

class PorterScheduleScreen extends ConsumerStatefulWidget {
  const PorterScheduleScreen({super.key});

  @override
  ConsumerState<PorterScheduleScreen> createState() => _PorterScheduleScreenState();
}

class _PorterScheduleScreenState extends ConsumerState<PorterScheduleScreen> {
  static const _filterOptions = [
    'Tất cả',
    'Đang diễn ra',
    'Chờ xác nhận',
    'Đã xác nhận',
    'Hoàn thành',
  ];

  String _selectedFilter = 'Tất cả';

  late List<_PorterShift> _shifts;

  @override
  void initState() {
    super.initState();
    _shifts = [
      const _PorterShift(
        id: 'shift-1',
        title: 'Trekking Sơn Trà – Bãi Bắc',
        time: 'Hôm nay • 06:30 – 16:30',
        location: 'Điểm tập kết: Trạm Kiểm lâm Cổng Bắc',
        membersText: 'Đoàn 24 khách • 4 porter phụ trách',
        status: 'Đang diễn ra',
        statusType: CtmsStatus.success,
        actionLabel: 'Đồng bộ dữ liệu ca',
        actionVariant: CtmsButtonVariant.primary,
        isToday: true,
        tripId: '5ed4b181-9353-4779-b4ad-f224c55242c5',
      ),
      const _PorterShift(
        id: 'shift-2',
        title: 'Chinh phục Đỉnh Bidoup Núi Bà',
        time: '15/08/2026 – 16/08/2026 (2 ngày 1 đêm)',
        location: 'Điểm tập kết: Vườn Quốc gia Bidoup',
        membersText: 'Đoàn 12 khách • Hỗ trợ thiết bị & y tế',
        status: 'Chờ xác nhận',
        statusType: CtmsStatus.warning,
        actionLabel: 'Xác nhận nhận ca',
        actionVariant: CtmsButtonVariant.primary,
        isToday: false,
      ),
      const _PorterShift(
        id: 'shift-3',
        title: 'Trekking Tà Năng – Phan Dũng',
        time: '28/07/2026 – 30/07/2026 (3 ngày 2 đêm)',
        location: 'Điểm tập kết: Xã Đa Quyn, Đức Trọng, Lâm Đồng',
        membersText: 'Đoàn 8 khách • Dẫn đầu & chốt đoàn',
        status: 'Đã xác nhận',
        statusType: CtmsStatus.neutral,
        actionLabel: 'Xem chi tiết ca',
        actionVariant: CtmsButtonVariant.secondary,
        isToday: false,
      ),
      const _PorterShift(
        id: 'shift-4',
        title: 'Khám phá Bán Đảo Sơn Trà - Mũi Nghê',
        time: '10/07/2026 • 05:00 – 12:00',
        location: 'Điểm tập kết: Bán đảo Sơn Trà',
        membersText: 'Đoàn 16 khách • 2 porter phụ trách',
        status: 'Hoàn thành',
        statusType: CtmsStatus.neutral,
        actionLabel: 'Xem tổng kết ca',
        actionVariant: CtmsButtonVariant.secondary,
        isToday: false,
      ),
    ];
  }

  void _handleShiftAction(_PorterShift shift) {
    if (shift.tripId != null) {
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => DeviceSyncStatusScreen(
            tripId: shift.tripId!,
          ),
        ),
      );
    } else if (shift.status == 'Chờ xác nhận') {
      setState(() {
        final index = _shifts.indexWhere((s) => s.id == shift.id);
        if (index != -1) {
          _shifts[index] = _PorterShift(
            id: shift.id,
            title: shift.title,
            time: shift.time,
            location: shift.location,
            membersText: shift.membersText,
            status: 'Đã xác nhận',
            statusType: CtmsStatus.neutral,
            actionLabel: 'Xem chi tiết ca',
            actionVariant: CtmsButtonVariant.secondary,
            isToday: shift.isToday,
            tripId: shift.tripId,
          );
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Đã xác nhận nhận ca "${shift.title}" thành công'),
          backgroundColor: AppColors.brandPrimary,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Chi tiết "${shift.title}" đang được tải'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final accountId = ref.watch(offlinePackageAccountProvider);
    final filteredShifts = _selectedFilter == 'Tất cả'
        ? _shifts
        : _shifts.where((s) => s.status == _selectedFilter).toList();

    final todayShifts = filteredShifts.where((s) => s.isToday).toList();
    final otherShifts = filteredShifts.where((s) => !s.isToday).toList();

    return CtmsScaffold(
      title: 'Lịch phân công',
      subtitle: 'Theo dõi và xác nhận các ca trekking được giao cho bạn',
      actions: [
        const SavedOfflinePackagesButton(),
        IconButton(
          tooltip: 'Báo cáo sự cố',
          icon: const Icon(Icons.report_problem_outlined),
          onPressed: () => context.push('/porter/incidents'),
        ),
      ],
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        children: [
          if (accountId != null) ...[
            OutlinedButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => PorterOfflineTripsScreen(accountId: accountId),
                ),
              ),
              icon: const Icon(Icons.download_outlined),
              label: const Text('Tải dữ liệu chuyến đi'),
            ),
            const SizedBox(height: AppSpacing.lg),
          ],
          // Filter Chips Row
          CtmsFilterChipRow(
            options: _filterOptions,
            selected: _selectedFilter,
            onSelected: (val) {
              setState(() => _selectedFilter = val);
            },
          ),
          const SizedBox(height: AppSpacing.xl),

          if (filteredShifts.isEmpty) ...[
            Container(
              padding: const EdgeInsets.all(AppSpacing.xxl),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppRadius.cardBorderRadius,
                border: Border.all(color: AppColors.border),
                boxShadow: AppColors.cardShadowSm,
              ),
              child: Column(
                children: [
                  const Icon(
                    Icons.event_busy_outlined,
                    size: 40,
                    color: AppColors.textSecondary,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    'Không có chuyến đi nào ở trạng thái "$_selectedFilter"',
                    textAlign: TextAlign.center,
                    style: AppTypography.body.copyWith(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ] else if (_selectedFilter == 'Tất cả') ...[
            // Section 1: Ca hôm nay
            if (todayShifts.isNotEmpty) ...[
              Text(
                'Ca trực hôm nay',
                style: AppTypography.h3.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              for (final shift in todayShifts)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                  child: _ShiftCard(
                    shift: shift,
                    onAction: () => _handleShiftAction(shift),
                  ),
                ),
              const SizedBox(height: AppSpacing.md),
            ],

            // Section 2: Ca sắp tới
            if (otherShifts.isNotEmpty) ...[
              Text(
                'Lịch phân công sắp tới',
                style: AppTypography.h3.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              for (final shift in otherShifts)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                  child: _ShiftCard(
                    shift: shift,
                    onAction: () => _handleShiftAction(shift),
                  ),
                ),
            ],
          ] else ...[
            // Filtered specific status section
            Row(
              children: [
                Text(
                  'Danh sách ca: $_selectedFilter',
                  style: AppTypography.h3.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMuted,
                    borderRadius: AppRadius.pillBorderRadius,
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Text(
                    '${filteredShifts.length}',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            for (final shift in filteredShifts)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                child: _ShiftCard(
                  shift: shift,
                  onAction: () => _handleShiftAction(shift),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _ShiftCard extends StatelessWidget {
  const _ShiftCard({
    required this.shift,
    required this.onAction,
  });

  final _PorterShift shift;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  shift.title,
                  style: AppTypography.h3.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              CtmsStatusBadge(label: shift.status, status: shift.statusType, showDot: true),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.schedule_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Text(
                shift.time,
                style: AppTypography.body.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  shift.location,
                  style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.groups_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Text(
                shift.membersText,
                style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            alignment: WrapAlignment.end,
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              if (shift.status == 'Đang diễn ra')
                OutlinedButton.icon(
                  onPressed: () => context.push('/porter/incidents'),
                  icon: const Icon(Icons.report_problem_outlined, size: 16, color: AppColors.statusDanger),
                  label: const Text(
                    'Báo cáo sự cố',
                    style: TextStyle(
                      color: AppColors.statusDanger,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.statusDangerBorder),
                    shape: RoundedRectangleBorder(borderRadius: AppRadius.pillBorderRadius),
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 8),
                  ),
                ),
              CtmsButton(
                label: shift.actionLabel,
                variant: shift.actionVariant,
                onPressed: onAction,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
