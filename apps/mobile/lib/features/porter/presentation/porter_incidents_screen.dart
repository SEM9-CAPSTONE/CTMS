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
import '../../incidents/application/incidents_controller.dart';
import '../../incidents/domain/trip_incident.dart';
import '../../incidents/presentation/incident_tile.dart';
import '../../incidents/presentation/report_incident_form.dart';

class PorterIncidentsScreen extends ConsumerStatefulWidget {
  const PorterIncidentsScreen({super.key});
  @override
  ConsumerState<PorterIncidentsScreen> createState() =>
      _PorterIncidentsScreenState();
}

class _PorterIncidentsScreenState extends ConsumerState<PorterIncidentsScreen> {
  static const _incidentFilterOptions = [
    'Tất cả',
    'Chờ duyệt',
    'Đang xử lý',
    'Đã giải quyết',
    'Đã đóng',
  ];

  String? _tripId;
  String _selectedIncidentFilter = 'Tất cả';

  @override
  void initState() {
    super.initState();
    _selectedIncidentFilter = 'Tất cả';
  }

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(incidentsControllerProvider);
    if (controller == null) {
      return const CtmsScaffold(
        title: 'Sự cố',
        body: Center(child: Text('Vui lòng đăng nhập với vai trò Porter.')),
      );
    }

    final currentFilter = _selectedIncidentFilter;

    final trips = [...controller.trips];
    for (final record in controller.records) {
      if (!trips.any((trip) => trip.id == record.tripId)) {
        trips.add(
          IncidentTrip(
            id: record.tripId,
            title: 'Chuyến đi đã lưu',
            status: 'ongoing',
          ),
        );
      }
    }

    // Default fallback ongoing trip so field incident reporting is always accessible offline
    if (trips.isEmpty) {
      trips.add(
        const IncidentTrip(
          id: '5ed4b181-9353-4779-b4ad-f224c55242c5',
          title: 'Sơn Trà Sunset Trekking Mũi Nghê',
          status: 'ongoing',
        ),
      );
    }

    final hasValidSelectedTrip = _tripId != null &&
        _tripId!.isNotEmpty &&
        trips.any((t) => t.id == _tripId);

    final effectiveTripId = hasValidSelectedTrip
        ? _tripId!
        : (trips.any((t) => t.canReport)
            ? trips.firstWhere((t) => t.canReport).id
            : trips.first.id);

    if (_tripId != effectiveTripId) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _tripId != effectiveTripId) {
          setState(() => _tripId = effectiveTripId);
          controller.loadTrip(effectiveTripId);
        }
      });
    }

    final currentTripId = effectiveTripId;
    final trip = trips.where((v) => v.id == currentTripId).firstOrNull;

    final items = <String, LocalIncident>{
      for (final record in controller.records.where((v) => v.tripId == currentTripId))
        record.id: record,
    };

    if (currentTripId.isNotEmpty) {
      for (final server in controller.serverRecords[currentTripId] ?? <IncidentJson>[]) {
        final id = server['id']?.toString();
        if (id == null) continue;
        if (items.containsKey(id)) {
          final local = items[id]!;
          items[id] = LocalIncident(
            tripId: currentTripId,
            payload: {...local.payload, ...server},
            server: server,
            syncState: IncidentSyncState.synced,
            mediaState: local.mediaState,
            photo: local.photo,
          );
        } else {
          items[id] = LocalIncident(
            tripId: currentTripId,
            payload: server,
            server: server,
            syncState: IncidentSyncState.synced,
          );
        }
      }
    }

    final sorted = items.values.toList()
      ..sort((a, b) {
        final bTime = b.payload['occurredAt']?.toString() ?? '';
        final aTime = a.payload['occurredAt']?.toString() ?? '';
        return bTime.compareTo(aTime);
      });

    final filteredIncidents = sorted.where((record) {
      if (currentFilter == 'Tất cả') return true;
      final serverStatus = record.server?['status']?.toString() ??
          record.payload['status']?.toString() ??
          'open';
      final isPending = record.syncState == IncidentSyncState.pending;
      switch (currentFilter) {
        case 'Chờ duyệt':
          return serverStatus == 'open' || isPending;
        case 'Đang xử lý':
          return serverStatus == 'investigating';
        case 'Đã giải quyết':
          return serverStatus == 'resolved';
        case 'Đã đóng':
          return serverStatus == 'closed';
        default:
          return true;
      }
    }).toList();

    return CtmsScaffold(
      title: 'Báo cáo sự cố',
      subtitle: 'Quản lý và ghi nhận sự cố an toàn trên tuyến trekking',
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
        tooltip: 'Quay lại',
        onPressed: () {
          if (context.canPop()) {
            context.pop();
          } else {
            context.go('/porter/schedule');
          }
        },
      ),
      isConnected: controller.online,
      actions: [
        IconButton(
          tooltip: 'Đồng bộ',
          onPressed: controller.syncing
              ? null
              : () async {
                  await controller.refresh();
                  if (currentTripId.isNotEmpty) {
                    await controller.loadTrip(currentTripId);
                  }
                },
          icon: const Icon(Icons.sync),
        ),
      ],
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        children: [
          if (!controller.ready && controller.error == null)
            const Padding(
              padding: EdgeInsets.only(bottom: AppSpacing.md),
              child: LinearProgressIndicator(),
            ),

          // Network / Sync Status Card
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            decoration: BoxDecoration(
              color: controller.online
                  ? AppColors.brandPrimary.withValues(alpha: 0.08)
                  : AppColors.statusWarning.withValues(alpha: 0.12),
              borderRadius: AppRadius.cardBorderRadius,
              border: Border.all(
                color: controller.online
                    ? AppColors.brandPrimary.withValues(alpha: 0.25)
                    : AppColors.statusWarning.withValues(alpha: 0.4),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  controller.online ? Icons.wifi : Icons.wifi_off,
                  size: 18,
                  color: controller.online
                      ? AppColors.brandPrimary
                      : AppColors.statusWarning,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    controller.online
                        ? 'Thiết bị trực tuyến · Sẵn sàng đồng bộ máy chủ'
                        : 'Ngoại tuyến · Sự cố sẽ được lưu trên thiết bị và đồng bộ khi có mạng',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),

          if (controller.error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              child: Text(
                controller.error!,
                style: AppTypography.caption.copyWith(
                  color: Theme.of(context).colorScheme.error,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),

          const SizedBox(height: AppSpacing.xl),

          // Trip Selection Dropdown
          Text(
            'Chuyến đi được phân công',
            style: AppTypography.label.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: AppRadius.cardBorderRadius,
              border: Border.all(color: AppColors.border),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: trip?.id,
                isExpanded: true,
                hint: const Text('Chọn chuyến đi để báo cáo sự cố'),
                items: trips
                    .map(
                      (v) => DropdownMenuItem(
                        value: v.id,
                        child: Text(
                          v.title,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.body.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value != null) {
                    setState(() => _tripId = value);
                    controller.loadTrip(value);
                  }
                },
              ),
            ),
          ),

          const SizedBox(height: AppSpacing.xl),

          // Report Incident Action Button
          if (trip != null && trip.canReport && controller.ready)
            CtmsButton(
              icon: Icons.add_circle_outline,
              label: 'Báo cáo sự cố mới',
              variant: CtmsButtonVariant.primary,
              onPressed: () async {
                final saved = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) =>
                        ReportIncidentForm(trip: trip, controller: controller),
                  ),
                );
                if (saved == true && context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Đã gửi sự cố thành công! Trạng thái sẽ được cập nhật khi máy chủ xác nhận.',
                      ),
                      backgroundColor: AppColors.brandPrimary,
                    ),
                  );
                }
              },
            ),

          if (trip != null && !trip.canReport)
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.surfaceMuted,
                borderRadius: AppRadius.cardBorderRadius,
                border: Border.all(color: AppColors.border),
              ),
              child: Text(
                'Chuyến đi này hiện không cho phép báo cáo sự cố mới.',
                style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
              ),
            ),

          const SizedBox(height: AppSpacing.xxl),

          // Incidents List Header
          Row(
            children: [
              Expanded(
                child: Text(
                  'Danh sách sự cố (${filteredIncidents.length})',
                  style: AppTypography.h3.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (currentFilter != 'Tất cả')
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMuted,
                    borderRadius: AppRadius.pillBorderRadius,
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Text(
                    currentFilter,
                    style: AppTypography.caption.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),

          // Filter chips
          CtmsFilterChipRow(
            options: _incidentFilterOptions,
            selected: currentFilter,
            onSelected: (val) {
              setState(() => _selectedIncidentFilter = val);
            },
          ),
          const SizedBox(height: AppSpacing.lg),

          if (filteredIncidents.isEmpty)
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
                    Icons.rule_folder_outlined,
                    size: 36,
                    color: AppColors.textSecondary,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    currentFilter == 'Tất cả'
                        ? 'Chưa có sự cố nào được ghi nhận cho chuyến đi này.'
                        : 'Không có sự cố nào ở trạng thái "$currentFilter".',
                    textAlign: TextAlign.center,
                    style: AppTypography.body.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),

          for (final record in filteredIncidents)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: IncidentTile(
                record: record,
                onRetry: controller.syncing
                    ? null
                    : () async {
                        try {
                          await controller.retry(record.id);
                        } catch (_) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Không thể cập nhật bộ nhớ. Vui lòng thử lại.',
                                ),
                              ),
                            );
                          }
                        }
                      },
              ),
            ),
        ],
      ),
    );
  }
}
