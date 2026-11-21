import 'package:flutter/material.dart';
import 'package_policy_copy.dart';
import '../application/package_download_controller.dart';
import '../domain/offline_package.dart';

/// Independent evidence labels: a good hash never implies fresh safety sources.
class PackagePolicyDetails extends StatelessWidget {
  const PackagePolicyDetails({
    super.key,
    required this.controller,
    this.isPorter = false,
  });
  final PackageDownloadController controller;
  final bool isPorter;

  @override
  Widget build(BuildContext context) {
    final policy = controller.policy;
    final selected = controller.active ?? controller.package;
    if (selected == null) return const SizedBox.shrink();
    final locked = controller.replacementLocked;
    final replacement =
        controller.active != null &&
        controller.package != null &&
        !controller.active!.sameArtifact(controller.package!);
    final newerCandidate =
        replacement &&
        controller.package!.packageVersion > controller.active!.packageVersion;
    final newerAvailable = policy?.newerAvailable == true || newerCandidate;
    final candidateDownloaded =
        controller.local?.status == PackageDownloadStatus.downloaded &&
        controller.local?.package.sameArtifact(
              controller.package ?? selected,
            ) ==
            true;
    final requiredMissing =
        policy?.requiredId != null &&
        controller.active?.id != policy?.requiredId;
    final candidateVersion =
        controller.package?.packageVersion ?? selected.packageVersion;
    final candidateLabel = 'Gói v$candidateVersion';
    final readinessReason = controller.awaitingActivation
        ? null
        : controller.downloading
        ? 'Đang tải'
        : controller.verification == PackageVerificationStatus.failed
        ? 'Tải lại bản v$candidateVersion'
        : requiredMissing
        ? 'Tải bản v${policy?.requiredVersion} trước'
        : controller.policyOffline
        ? 'Kết nối mạng để xác nhận.'
        : policy?.sourceState == 'expired'
        ? 'Dữ liệu đã hết hạn.'
        : policy?.sourceState != 'current'
        ? 'Chờ xác nhận độ mới dữ liệu.'
        : null;
    final canConfirm =
        !requiredMissing &&
        !controller.policyOffline &&
        !controller.awaitingActivation &&
        !controller.downloading &&
        !controller.confirmingDeparture &&
        policy?.sourceState == 'current';
    final selectedContext = policy?.json['selected'];
    final serverUpdatedAt =
        selectedContext is Map && selectedContext['packageId'] == selected.id
        ? selectedContext['updatedAt'] as String?
        : null;
    const secondaryStyle = TextStyle(
      fontSize: 14,
      height: 1.5,
      color: Color(0xff334438),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 12),
        Text(
          controller.active != null
              ? locked && !controller.activeMatchesTripLock
                    ? 'Gói đang lưu trên thiết bị: v${selected.packageVersion}'
                    : 'Gói đang sử dụng: v${selected.packageVersion}'
              : (controller.local?.downloadedBytes ?? 0) > 0
              ? 'Gói trên thiết bị: v${selected.packageVersion}'
              : policy?.hasRequirement == false && !controller.policyOffline
              ? 'Bản mới nhất: v${selected.packageVersion}'
              : 'Bản cần dùng: v${selected.packageVersion}',
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 4),
        if (locked &&
            policy?.lockedId != null &&
            !controller.activeMatchesTripLock)
          Text(
            policy!.lockedId == policy.requiredId &&
                    policy.requiredVersion != null
                ? 'Bản đã khóa cho chuyến: v${policy.requiredVersion}'
                : 'Chuyến đã khóa một gói khác với gói trên thiết bị.',
            style: secondaryStyle,
          ),
        Text(
          'Cập nhật gói: ${packageTime(serverUpdatedAt ?? selected.generatedAt.toIso8601String())}',
          style: secondaryStyle,
        ),
        const SizedBox(height: 16),
        _EvidenceRow(
          icon: controller.verification == PackageVerificationStatus.failed
              ? Icons.error_outline
              : Icons.verified_user_outlined,
          text: switch (controller.verification) {
            PackageVerificationStatus.verified =>
              '$candidateLabel: Đã kiểm tra trên thiết bị',
            PackageVerificationStatus.failed =>
              '$candidateLabel: Bị lỗi, cần tải lại',
            _
                when !candidateDownloaded &&
                    !controller.downloading &&
                    (replacement || controller.active == null) =>
              '$candidateLabel: Chưa tải',
            _ when controller.downloading => '$candidateLabel: Đang tải',
            _ => '$candidateLabel: Đang chờ kiểm tra',
          },
        ),
        _EvidenceRow(
          icon: Icons.update,
          text: switch (policy?.sourceState) {
            'current' => 'Độ mới dữ liệu: Còn hiệu lực',
            'expired' => 'Độ mới dữ liệu: Đã hết hạn',
            _ => 'Chưa xác nhận dữ liệu là bản cập nhật mới nhất',
          },
        ),
        if (!locked &&
            !controller.awaitingActivation &&
            (requiredMissing ||
                newerAvailable ||
                policy == null ||
                ['current', 'expired'].contains(policy.sourceState)))
          _EvidenceRow(
            icon: newerAvailable || requiredMissing
                ? Icons.system_update_alt
                : Icons.inventory_2_outlined,
            emphasized: requiredMissing,
            text: requiredMissing
                ? isPorter
                      ? 'Bản bắt buộc: v${policy!.requiredVersion}'
                      : 'Cần tải bản v${policy!.requiredVersion} trước chuyến đi'
                : newerAvailable
                ? (policy?.updateRequired == true ||
                              (policy?.requiredId != null &&
                                  controller.active?.id !=
                                      policy?.requiredId)) &&
                          policy?.requiredVersion != null
                      ? 'Cần cập nhật lên v${policy!.requiredVersion} trước chuyến đi'
                      : 'Có bản mới v${controller.package?.packageVersion ?? policy?.section('publication')['latestVersion']} (không bắt buộc)'
                : policy == null
                ? 'Chưa kiểm tra bản mới'
                : 'Chưa có bản mới',
          ),
        if (policy != null) ...[
          const SizedBox(height: 8),
          Text(
            'Máy chủ kiểm tra: ${packageTime(policy.checkedAt)}',
            style: secondaryStyle,
          ),
        ],
        if (controller.policyError != null && !controller.awaitingActivation)
          Text(controller.policyError!),
        if (controller.awaitingActivation)
          Text(
            controller.active != null
                ? 'Gói cũ vẫn dùng được.'
                : 'Đồng bộ xong mới dùng được gói.',
          ),
        if (isPorter && policy?.hasRequirement == true && !locked) ...[
          const SizedBox(height: 16),
          if (readinessReason != null) Text(readinessReason),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: canConfirm ? controller.confirmDeparture : null,
            child: const Text('Xác nhận thiết bị sẵn sàng'),
          ),
        ],
        if (!locked &&
            canConfirm &&
            !controller.awaitingActivation &&
            controller.departureMessage != null)
          Text(controller.departureMessage!),
      ],
    );
  }
}

class _EvidenceRow extends StatelessWidget {
  const _EvidenceRow({
    required this.icon,
    required this.text,
    this.emphasized = false,
  });
  final IconData icon;
  final String text;
  final bool emphasized;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: emphasized ? const Color(0xfffff3d6) : const Color(0xfff3f5f3),
      border: emphasized
          ? Border.all(color: const Color(0xff996000), width: 1.5)
          : null,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          icon,
          size: 22,
          color: emphasized ? const Color(0xff704200) : const Color(0xff46564c),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: emphasized
                ? const TextStyle(
                    color: Color(0xff704200),
                    fontWeight: FontWeight.bold,
                  )
                : null,
          ),
        ),
      ],
    ),
  );
}
