import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../../offline_map/domain/synced_map_member.dart';
import '../../offline_map/presentation/widgets/offline_map_canvas.dart';
import '../../offline_packages/presentation/package_policy_copy.dart';
import '../application/member_locations_controller.dart';
import '../data/member_locations_api.dart';
import 'trip_member_location_tile.dart';

class TripMemberLocationsPanel extends ConsumerStatefulWidget {
  const TripMemberLocationsPanel({super.key, required this.tripId, this.clock});
  final String tripId;
  final DateTime Function()? clock;
  @override
  ConsumerState<TripMemberLocationsPanel> createState() =>
      _TripMemberLocationsPanelState();
}

class _TripMemberLocationsPanelState
    extends ConsumerState<TripMemberLocationsPanel>
    with WidgetsBindingObserver {
  final _mapKey = GlobalKey<OfflineMapCanvasState>();
  String? _selected;
  Timer? _ticker;
  Size _mapSize = const Size(320, 280);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _ticker = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ticker?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(memberLocationsControllerProvider(widget.tripId)).refresh();
    }
  }

  void _select(SyncedMapMember member) {
    setState(() => _selected = member.id);
    _mapKey.currentState?.focusOnSyncedMember(member, _mapSize);
  }

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(
      memberLocationsControllerProvider(widget.tripId),
    );
    final data = controller.data;
    final now = (widget.clock ?? DateTime.now)();
    final denied = [401, 403, 404, 409].contains(controller.errorStatus);
    final members =
        data?.members.where((member) => !member.hasLeft).toList() ?? [];
    members.sort(
      (a, b) => a.offRoute == b.offRoute
          ? a.displayName.compareTo(b.displayName)
          : a.offRoute
          ? -1
          : 1,
    );
    final markers = <SyncedMapMember>[
      for (final member in members)
        if (member.location != null)
          SyncedMapMember(
            id: member.id,
            label: member.displayName,
            latitude: member.location!.latitude,
            longitude: member.location!.longitude,
            routeLabel: member.routeLabel,
            offRoute: member.offRoute,
            stale:
                member.freshnessAt(now, data!.freshnessMaxAgeSeconds) !=
                LocationFreshness.fresh,
          ),
    ];
    return CtmsSectionCard(
      title: 'Vị trí các thành viên',
      trailing: IconButton(
        tooltip: 'Làm mới vị trí',
        icon: const Icon(Icons.refresh),
        onPressed: controller.isRefreshing ? null : controller.refresh,
      ),
      child: DefaultTextStyle.merge(
        style: const TextStyle(color: AppColors.textPrimary),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (controller.isLoading && data == null)
              const Center(child: CircularProgressIndicator())
            else if (denied)
              Text(
                controller.errorStatus == 401
                    ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
                    : controller.errorStatus == 409
                    ? 'Chỉ xem vị trí đoàn khi chuyến đi đang diễn ra.'
                    : 'Bạn không có quyền xem vị trí thành viên của chuyến này.',
              )
            else if (data == null) ...[
              const Text(
                'Không tải được vị trí thành viên. Kiểm tra kết nối mạng rồi thử lại.',
              ),
              TextButton(
                onPressed: controller.refresh,
                child: const Text('Thử lại'),
              ),
            ] else ...[
              if (controller.lastRefreshFailed)
                Text(
                  'Không cập nhật được. Đang hiển thị dữ liệu lúc ${packageTime(data.generatedAt.toIso8601String())}.',
                ),
              if (data.route != null)
                LayoutBuilder(
                  builder: (context, constraints) {
                    _mapSize = Size(constraints.maxWidth, 280);
                    return OfflineMapCanvas(
                      key: _mapKey,
                      route: data.route,
                      syncedMembers: markers,
                      selectedMemberId: _selected,
                      onSelectSyncedMember: _select,
                      clock: widget.clock,
                      overviewLabel: 'Sơ đồ tuyến và vị trí đã đồng bộ',
                    );
                  },
                )
              else
                const Text(
                  'Chưa có sơ đồ tuyến. Bạn vẫn có thể xem tọa độ và thời gian ghi nhận bên dưới.',
                ),
              if (markers.any((member) => member.id == _selected))
                Text(
                  'Đang xem: ${markers.firstWhere((member) => member.id == _selected).label}',
                ),
              if (members.isEmpty)
                const Text('Chưa có thành viên trong đoàn để hiển thị.'),
              for (final member in members)
                TripMemberLocationTile(
                  member: member,
                  now: now,
                  maxAgeSeconds: data.freshnessMaxAgeSeconds,
                  selected: member.id == _selected,
                  onSelect: data.route == null || member.location == null
                      ? null
                      : () => _select(
                          markers.firstWhere(
                            (marker) => marker.id == member.id,
                          ),
                        ),
                ),
              Text(
                'Cập nhật lúc ${packageTime(data.generatedAt.toIso8601String())}',
              ),
            ],
          ],
        ),
      ),
    );
  }
}
