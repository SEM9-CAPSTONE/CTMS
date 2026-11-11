import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../application/package_download_controller.dart';
import '../domain/offline_package.dart';
import 'offline_trip_screen.dart';

class OfflinePackageScreen extends ConsumerWidget {
  const OfflinePackageScreen({
    super.key,
    required this.tripId,
    required this.accountId,
    required this.tripTitle,
  });

  final String tripId;
  final String accountId;
  final String tripTitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ownsSelection = ref.watch(offlinePackageAccountProvider) == accountId;
    return CtmsScaffold(
      title: 'Dữ liệu ngoại tuyến',
      subtitle: ownsSelection ? tripTitle : null,
      body: ownsSelection
          ? ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                OfflinePackagePanel(tripId: tripId, tripTitle: tripTitle),
              ],
            )
          : const Center(child: Text('Dữ liệu ngoại tuyến không khả dụng')),
    );
  }
}

class OfflinePackagePanel extends ConsumerWidget {
  const OfflinePackagePanel({
    super.key,
    required this.tripId,
    this.tripTitle,
    this.summaryOnly = false,
  });

  final String tripId;
  final String? tripTitle;
  final bool summaryOnly;

  String _formatSize(int bytes) => bytes < 1024 * 1024
      ? '${(bytes / 1024).ceil()} KB'
      : '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(packageDownloadControllerProvider(tripId));
    final accountId = ref.watch(offlinePackageAccountProvider);
    final package = controller.package;
    final local = controller.local;
    final active = controller.active;
    final verification = controller.verification;
    final progress = local?.progress ?? 0.0;
    final percentage = '${(progress * 100).floor()}%';
    final transferred = local?.status == PackageDownloadStatus.downloaded;
    Future<void> startDownload() => controller.start(tripTitle: tripTitle);

    final (message, label, action, transferProgress) = switch (verification) {
      _ when controller.downloadingBasemap => (
        'Đang tải nền bản đồ · ${(controller.basemapProgress * 100).floor()}%',
        'Tạm dừng',
        controller.pause,
        controller.basemapProgress,
      ),
      _
          when active != null &&
              verification != PackageVerificationStatus.failed &&
              !controller.loading &&
              !controller.downloading &&
              !controller.readyForOffline =>
        (
          controller.basemapError ??
              'Dữ liệu chuyến đi đã có. Chưa tải nền bản đồ.',
          'Tải nền bản đồ',
          controller.start,
          null,
        ),
      PackageVerificationStatus.verifying => (
        'Đang hoàn tất dữ liệu…',
        null,
        null,
        null,
      ),
      PackageVerificationStatus.failed when !controller.loading => (
        'Không thể hoàn tất dữ liệu ngoại tuyến',
        'Tải lại',
        startDownload,
        null,
      ),
      PackageVerificationStatus.pending
          when transferred && controller.error == null =>
        ('Đang hoàn tất dữ liệu…', null, null, null),
      _ when controller.downloading => (
        'Đang tải · $percentage',
        'Tạm dừng',
        controller.pause,
        progress,
      ),
      _
          when controller.readyForOffline &&
              active != null &&
              (controller.loading ||
                  package == null ||
                  active.sameArtifact(package) ||
                  package.activationAllowed == false ||
                  verification == PackageVerificationStatus.verified) =>
        ('Sẵn sàng sử dụng ngoại tuyến', null, null, null),
      _ when controller.loading => ('Đang tải thông tin…', null, null, null),
      _ when package == null && controller.error != null => (
        controller.error!,
        'Thử lại',
        controller.load,
        null,
      ),
      _ when package == null => (
        'Chưa có dữ liệu ngoại tuyến',
        'Thử lại',
        controller.load,
        null,
      ),
      PackageVerificationStatus.verified => (
        package.activationAllowed == false
            ? 'Gói đã tải nhưng chưa được kích hoạt. Chuyến đi đã bắt đầu nên không thể kích hoạt gói mới. Vui lòng liên hệ ban tổ chức.'
            : 'Gói đã tải nhưng chưa được kích hoạt. Vui lòng kiểm tra lại.',
        'Kiểm tra lại',
        controller.load,
        null,
      ),
      _ when progress > 0 => (
        'Đã tải $percentage',
        'Tiếp tục tải',
        startDownload,
        progress,
      ),
      _ when controller.error != null => (
        'Không thể tải dữ liệu ngoại tuyến',
        'Tải lại',
        startDownload,
        null,
      ),
      _ => (
        'Chưa tải · ${_formatSize(package.sizeBytes)}',
        'Tải xuống',
        startDownload,
        null,
      ),
    };

    return CtmsSectionCard(
      title: 'Dữ liệu ngoại tuyến',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(liveRegion: transferProgress == null, child: Text(message)),
          if (!summaryOnly && transferProgress != null) ...[
            const SizedBox(height: AppSpacing.sm),
            LinearProgressIndicator(
              value: transferProgress,
              semanticsLabel: 'Tiến độ tải dữ liệu ngoại tuyến',
              semanticsValue: '${(transferProgress * 100).floor()}%',
            ),
          ],
          if (!summaryOnly && controller.storageBlocked) ...[
            const SizedBox(height: AppSpacing.sm),
            const Text('Kiểm tra dung lượng trống trên thiết bị.'),
          ],
          if (!summaryOnly &&
              verification == PackageVerificationStatus.failed &&
              active != null) ...[
            const SizedBox(height: AppSpacing.sm),
            const Text('Bản trước vẫn dùng được ngoại tuyến.'),
          ],
          if (!summaryOnly && action != null) ...[
            const SizedBox(height: AppSpacing.md),
            FilledButton(onPressed: action, child: Text(label!)),
          ],
          if (!summaryOnly && active != null && accountId != null) ...[
            const SizedBox(height: AppSpacing.md),
            OutlinedButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => OfflineTripScreen(
                    tripTitle: tripTitle,
                    selection: (
                      accountId: accountId,
                      tripId: tripId,
                      version: active.packageVersion,
                    ),
                  ),
                ),
              ),
              child: const Text('Xem dữ liệu'),
            ),
          ],
        ],
      ),
    );
  }
}
