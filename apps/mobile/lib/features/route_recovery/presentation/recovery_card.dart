import 'dart:math' show pi;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_spacing.dart';
import '../application/recovery_controller.dart';
import '../domain/recovery_geometry.dart';
import '../domain/recovery_state.dart';

const recoveryMessages = <RecoveryDisplay, String>{
  RecoveryDisplay.artifactInvalid:
      'Gói bản đồ này thiếu hoặc hỏng dữ liệu tuyến. Cần tải lại gói hợp lệ; tạm ẩn hướng quay lại.',
  RecoveryDisplay.loading: 'Đang kiểm tra dữ liệu tuyến…',
  RecoveryDisplay.packageMissing: 'Cần gói bản đồ ngoại tuyến đã xác thực.',
  RecoveryDisplay.restricted:
      'Không có quyền sử dụng dữ liệu chuyến đi. Kết nối mạng và kiểm tra quyền truy cập.',
  RecoveryDisplay.staleRoute:
      'Dữ liệu tuyến đã cũ. Tạm ẩn hướng quay lại; liên hệ người dẫn đoàn.',
  RecoveryDisplay.mismatch:
      'Gói bản đồ không khớp dữ liệu chuyến đi. Cần tải lại gói hợp lệ; tạm ẩn hướng quay lại.',
  RecoveryDisplay.unavailable:
      'Dữ liệu tuyến chưa dùng được. Kết nối mạng và tải lại gói của chuyến đi. Nếu chưa có gói mới, liên hệ người dẫn đoàn.',
  RecoveryDisplay.serverError:
      'Không xác thực được dữ liệu với máy chủ. Vui lòng thử lại.',
  RecoveryDisplay.unverified:
      'Chưa xác thực với máy chủ. Kết nối mạng trước khi dùng hướng quay lại.',
  RecoveryDisplay.gpsMissing:
      'Chưa có vị trí GPS dùng được. Kiểm tra quyền và dịch vụ vị trí.',
  RecoveryDisplay.gpsStale: 'Mẫu GPS đã cũ. Đang chờ vị trí mới để tính hướng.',
  RecoveryDisplay.gpsPoor: 'GPS độ chính xác thấp. Tạm ẩn hướng quay lại.',
  RecoveryDisplay.contextMismatch:
      'Dữ liệu phát hiện lệch tuyến không khớp gói bản đồ đang dùng.',
  RecoveryDisplay.notOffRoute:
      'Chưa xác nhận lệch tuyến. Tiếp tục theo dõi vị trí.',
};

class RecoveryCard extends ConsumerStatefulWidget {
  const RecoveryCard({super.key, required this.tripId, required this.onFocus});
  final String tripId;
  final VoidCallback onFocus;
  @override
  ConsumerState<RecoveryCard> createState() => _RecoveryCardState();
}

class _RecoveryCardState extends ConsumerState<RecoveryCard>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(recoveryControllerProvider(widget.tripId)).refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(recoveryControllerProvider(widget.tripId));
    return RecoveryCardContent(
      view: controller.view,
      onRetry: controller.refresh,
      onFocus: widget.onFocus,
    );
  }
}

class RecoveryCardContent extends StatefulWidget {
  const RecoveryCardContent({
    super.key,
    required this.view,
    required this.onRetry,
    required this.onFocus,
  });
  final RecoveryView view;
  final VoidCallback onRetry, onFocus;
  @override
  State<RecoveryCardContent> createState() => _RecoveryCardContentState();
}

class _RecoveryCardContentState extends State<RecoveryCardContent> {
  bool _offlineNoticeDismissed = false;
  @override
  void didUpdateWidget(covariant RecoveryCardContent oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.view.display != widget.view.display) {
      _offlineNoticeDismissed = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final view = widget.view;
    final onRetry = widget.onRetry;
    final onFocus = widget.onFocus;
    final target = view.guides ? view.target : null;
    final bearing = target?.bearingDegrees;
    final distance = target == null
        ? ''
        : target.distanceMeters < 1000
        ? '${target.distanceMeters.round()} m'
        : '${(target.distanceMeters / 1000).toStringAsFixed(1)} km';
    final direction = bearing == null
        ? 'Ngay tại điểm quay lại; không có hướng di chuyển xác định'
        : '${recoveryDirection(bearing)} · ${bearing.round() % 360}°';
    return Container(
      key: const Key('route-recovery-card'),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE0E5DF)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Quay lại tuyến',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Color(0xFF311B65),
            ),
          ),
          const SizedBox(height: 8),
          if (target == null) ...[
            Text(
              recoveryMessages[view.display] ?? 'Chưa có hướng quay lại.',
              style: const TextStyle(color: Color(0xFF311B65)),
            ),
            if ([
              RecoveryDisplay.artifactInvalid,
              RecoveryDisplay.serverError,
              RecoveryDisplay.unverified,
              RecoveryDisplay.staleRoute,
              RecoveryDisplay.mismatch,
              RecoveryDisplay.restricted,
              RecoveryDisplay.unavailable,
            ].contains(view.display))
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: OutlinedButton.icon(
                  key: const Key('recovery-retry'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                  ),
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Kiểm tra lại'),
                ),
              ),
          ] else ...[
            if (view.display == RecoveryDisplay.offlineReady &&
                !_offlineNoticeDismissed)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Expanded(
                    child: Text(
                      'Chưa xác thực lại với máy chủ · Dùng tuyến đã xác thực trên thiết bị',
                      style: TextStyle(
                        color: Color(0xFF5C3500),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  IconButton(
                    key: const Key('dismiss-recovery-offline-notice'),
                    tooltip: 'Đóng thông báo chưa xác thực lại',
                    onPressed: () =>
                        setState(() => _offlineNoticeDismissed = true),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            Semantics(
              label:
                  'Điểm quay lại tuyến cách $distance. $direction. Phương vị theo bắc thật.',
              excludeSemantics: true,
              child: Wrap(
                spacing: 16,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    distance,
                    style: const TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF311B65),
                    ),
                  ),
                  if (bearing != null)
                    Transform.rotate(
                      angle: bearing * pi / 180,
                      child: const Icon(
                        Icons.north,
                        color: Color(0xFF512DA8),
                        size: 28,
                      ),
                    ),
                  Text(
                    direction,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF311B65),
                    ),
                  ),
                ],
              ),
            ),
            const Text(
              'Đường chim bay, theo bắc thật',
              style: TextStyle(color: Color(0xFF311B65)),
            ),
            const Text(
              'Kiểm tra địa hình trước khi di chuyển.',
              style: TextStyle(
                color: Color(0xFF27352D),
                fontWeight: FontWeight.w700,
              ),
            ),
            if (view.observedAt != null)
              Text(
                'Tuyến xác thực với máy chủ lúc ${DateFormat('HH:mm dd/MM').format(view.observedAt!.toLocal())}',
                style: const TextStyle(fontSize: 14, color: Color(0xFF37423A)),
              ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: onFocus,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF512DA8),
                foregroundColor: Colors.white,
              ),
              icon: const Icon(Icons.turn_left),
              label: const Text('Xem điểm quay lại'),
            ),
          ],
        ],
      ),
    );
  }
}
