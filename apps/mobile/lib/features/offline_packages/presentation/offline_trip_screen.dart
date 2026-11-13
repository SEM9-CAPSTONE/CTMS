import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_empty_state.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../application/offline_trip_providers.dart';
import '../application/package_download_controller.dart';
import '../domain/offline_trip.dart';
import '../../offline_map/presentation/widgets/offline_map_canvas.dart';

class OfflineTripScreen extends ConsumerWidget {
  const OfflineTripScreen({super.key, required this.selection, this.tripTitle});

  final OfflineTripSelection selection;
  final String? tripTitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(offlinePackageAccountProvider) != selection.accountId) {
      return const CtmsScaffold(
        title: 'Dữ liệu ngoại tuyến',
        body: _UnavailableTrip(),
      );
    }

    final trip = ref.watch(offlineTripProvider(selection));
    return trip.when(
      loading: () => CtmsScaffold(
        title: 'Dữ liệu ngoại tuyến',
        subtitle: tripTitle,
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (_, _) => CtmsScaffold(
        title: 'Dữ liệu ngoại tuyến',
        subtitle: tripTitle,
        body: const _UnavailableTrip(),
      ),
      data: (data) => data == null
          ? CtmsScaffold(
              title: 'Dữ liệu ngoại tuyến',
              subtitle: tripTitle,
              body: const _UnavailableTrip(),
            )
          : _TripTabs(trip: data, tripTitle: tripTitle, selection: selection),
    );
  }
}

class _UnavailableTrip extends StatelessWidget {
  const _UnavailableTrip();

  @override
  Widget build(BuildContext context) => const CtmsEmptyState(
    icon: Icons.file_download_off_outlined,
    title: 'Dữ liệu ngoại tuyến không khả dụng',
    message: 'Hãy mở chuyến đi và tải lại gói dữ liệu khi có mạng.',
  );
}

class _TripTabs extends StatelessWidget {
  const _TripTabs({
    required this.trip,
    required this.tripTitle,
    required this.selection,
  });

  final OfflineTrip trip;
  final String? tripTitle;
  final OfflineTripSelection selection;
  static final _sourceDate = DateFormat('dd/MM/yyyy HH:mm');

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 3,
    child: CtmsScaffold(
      title: 'Dữ liệu ngoại tuyến',
      subtitle: tripTitle,
      bottom: const TabBar(
        tabs: [
          Tab(text: 'Tuyến đường'),
          Tab(text: 'Điểm dừng'),
          Tab(text: 'Hướng dẫn'),
        ],
      ),
      body: TabBarView(
        children: [
          ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              CtmsSectionCard(
                title: 'Bản đồ tuyến đường',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _SavedRouteMap(selection: selection),
                    const SizedBox(height: AppSpacing.sm),
                    const Text(
                      'Các điểm đánh số là điểm dừng trong gói đã lưu.',
                    ),
                    for (
                      var index = 0;
                      index < trip.checkpoints.length;
                      index++
                    ) ...[
                      const SizedBox(height: AppSpacing.sm),
                      _CheckpointCard(
                        index: index,
                        checkpoint: trip.checkpoints[index],
                      ),
                    ],
                  ],
                ),
              ),
              if (trip.hazardSources.isNotEmpty)
                ExpansionTile(
                  title: const Text('Nguồn cảnh báo trong gói đã lưu'),
                  children: [
                    for (final source in trip.hazardSources)
                      ListTile(
                        title: Text(
                          source.id.isEmpty ? 'Nguồn chưa xác định' : source.id,
                        ),
                        subtitle: Text(
                          [
                            switch (source.outcome) {
                              OfflineHazardOutcome.activeAlerts =>
                                'Có cảnh báo khi kiểm tra',
                              OfflineHazardOutcome.noActiveAlert =>
                                'Không ghi nhận cảnh báo khi kiểm tra',
                              OfflineHazardOutcome.unknown =>
                                'Chưa xác định được tình trạng cảnh báo',
                            },
                            if (source.checkedAt case final checkedAt?)
                              'Đã kiểm tra ${_sourceDate.format(checkedAt.toLocal())}',
                            if (source.validUntil case final validUntil?)
                              'Hiệu lực nguồn đến ${_sourceDate.format(validUntil.toLocal())}',
                          ].join('\n'),
                        ),
                      ),
                  ],
                ),
            ],
          ),
          if (trip.checkpoints.isEmpty)
            const CtmsEmptyState(title: 'Gói này chưa có điểm dừng')
          else
            ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.lg),
              itemCount: trip.checkpoints.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
              itemBuilder: (_, index) => _CheckpointCard(
                index: index,
                checkpoint: trip.checkpoints[index],
              ),
            ),
          if (trip.guides.isEmpty)
            const CtmsEmptyState(title: 'Gói này chưa có hướng dẫn sinh tồn')
          else
            ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.lg),
              itemCount: trip.guides.length,
              separatorBuilder: (_, _) => const Divider(),
              itemBuilder: (_, index) => _GuideTile(guide: trip.guides[index]),
            ),
        ],
      ),
    ),
  );
}

class _SavedRouteMap extends ConsumerWidget {
  const _SavedRouteMap({required this.selection});
  final OfflineTripSelection selection;

  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(savedTripMapProvider(selection))
      .when(
        loading: () => const SizedBox(
          height: 320,
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (_, _) => const Text(
          'Không thể mở bản đồ của gói đã lưu. Hãy kiểm tra lại gói dữ liệu.',
        ),
        data: (map) => map == null
            ? const Text(
                'Gói đang xem không còn khả dụng. Hãy quay lại và mở gói hiện tại.',
              )
            : OfflineMapCanvas(
                route: map.context.route,
                checkpoints: map.context.checkpoints,
                mbtilesPath: map.basemapPath,
                height: 360,
              ),
      );
}

class _CheckpointCard extends StatelessWidget {
  const _CheckpointCard({required this.index, required this.checkpoint});

  final int index;
  final OfflineCheckpoint checkpoint;

  @override
  Widget build(BuildContext context) {
    final type = switch (checkpoint.type) {
      'start' => 'Điểm xuất phát',
      'rest' => 'Điểm nghỉ',
      'water' => 'Nguồn nước',
      'dangerous' => 'Điểm nguy hiểm',
      'emergency_shelter' => 'Nơi trú khẩn cấp',
      'finish' => 'Điểm kết thúc',
      _ => 'Điểm dừng',
    };
    final name = checkpoint.name.trim();
    final point = checkpoint.position;
    return CtmsSectionCard(
      title: '${index + 1}. ${name.isEmpty ? type : name}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (name.isNotEmpty) Text(type),
          Text(
            '${point.latitude.toStringAsFixed(5)}, ${point.longitude.toStringAsFixed(5)}',
          ),
          if (checkpoint.instructions.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(checkpoint.instructions),
          ],
        ],
      ),
    );
  }
}

class _GuideTile extends StatelessWidget {
  const _GuideTile({required this.guide});

  final OfflineGuide guide;

  @override
  Widget build(BuildContext context) => ExpansionTile(
    title: Text(guide.topic),
    subtitle: Text(guide.sourceTitle),
    expandedCrossAxisAlignment: CrossAxisAlignment.start,
    childrenPadding: const EdgeInsets.all(AppSpacing.lg),
    children: [
      SelectableText(guide.content),
      const SizedBox(height: AppSpacing.md),
      if (guide.attribution case final attribution? when attribution.isNotEmpty)
        Text(attribution),
      SelectableText('Phiên bản tài liệu · ${guide.documentVersionId}'),
      if (guide.sourceUrl case final url? when url.isNotEmpty)
        SelectableText(url),
      for (final ref in guide.pageRefs.toSet())
        Text('Trang ${ref.page} · ${ref.itemRef}'),
    ],
  );
}
