import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../application/package_download_controller.dart';
import '../domain/offline_package.dart';

class OfflinePackageScreen extends StatelessWidget {
  const OfflinePackageScreen({super.key, required this.tripId});
  final String tripId;
  @override
  Widget build(BuildContext context) => CtmsScaffold(
    title: 'Dữ liệu ngoại tuyến',
    body: ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [OfflinePackagePanel(tripId: tripId)],
    ),
  );
}

class OfflinePackagePanel extends ConsumerWidget {
  const OfflinePackagePanel({super.key, required this.tripId});
  final String tripId;
  static String formatBytes(int bytes) =>
      '${(bytes / (1024 * 1024)).toStringAsFixed(2)} MB';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(packageDownloadControllerProvider(tripId));
    final package = controller.package;
    final local = controller.local;
    final complete = local?.status == PackageDownloadStatus.downloaded;
    return CtmsSectionCard(
      title: 'Gói dữ liệu chuyến đi',
      trailing: IconButton(
        tooltip: 'Làm mới',
        onPressed: controller.loading || controller.downloading
            ? null
            : controller.load,
        icon: const Icon(Icons.refresh),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (controller.loading)
            const Center(child: CircularProgressIndicator())
          else if (package != null) ...[
            Text(
              'Phiên bản ${package.packageVersion} · ${formatBytes(package.sizeBytes)}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.md),
            LinearProgressIndicator(
              value: local?.progress ?? 0,
              minHeight: 6,
              color: AppColors.brandPrimary,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              '${formatBytes(local?.downloadedBytes ?? 0)} / ${formatBytes(package.sizeBytes)} · ${((local?.progress ?? 0) * 100).floor()}%',
            ),
            const SizedBox(height: AppSpacing.md),
            if (complete)
              const Text(
                'Đã tải xuống · Chưa xác minh',
                style: TextStyle(fontWeight: FontWeight.w600),
              )
            else if (controller.downloading)
              OutlinedButton.icon(
                onPressed: controller.pause,
                icon: const Icon(Icons.pause),
                label: const Text('Tạm dừng'),
              )
            else
              FilledButton.icon(
                onPressed: controller.start,
                icon: const Icon(Icons.download_outlined),
                label: Text(
                  (local?.downloadedBytes ?? 0) > 0
                      ? 'Tiếp tục tải'
                      : 'Tải về thiết bị',
                ),
              ),
            if (complete)
              const Padding(
                padding: EdgeInsets.only(top: AppSpacing.sm),
                child: Text(
                  'Gói dữ liệu cần được xác minh trước khi sử dụng ngoại tuyến.',
                ),
              ),
            if (controller.versions.any(
              (item) =>
                  item.package.packageVersion < package.packageVersion &&
                  item.status == PackageDownloadStatus.downloaded,
            ))
              const Padding(
                padding: EdgeInsets.only(top: AppSpacing.md),
                child: Text('Bản đã tải trước đó vẫn được giữ trên thiết bị.'),
              ),
          ],
          if (controller.error != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.md),
              child: Text(
                controller.error!,
                style: const TextStyle(color: AppColors.statusDanger),
              ),
            ),
          if (!controller.loading && package == null)
            OutlinedButton(
              onPressed: controller.load,
              child: const Text('Thử lại'),
            ),
        ],
      ),
    );
  }
}
