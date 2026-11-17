import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_section_card.dart';
import '../application/package_download_controller.dart';
import '../data/camper_package_preparation_api.dart';

class CamperPackagePreparationPanel extends ConsumerStatefulWidget {
  const CamperPackagePreparationPanel({
    super.key,
    required this.tripId,
    required this.onDownload,
  });

  final String tripId;
  final VoidCallback? onDownload;

  @override
  ConsumerState<CamperPackagePreparationPanel> createState() =>
      _CamperPackagePreparationPanelState();
}

class _CamperPackagePreparationPanelState
    extends ConsumerState<CamperPackagePreparationPanel> {
  (String?, String)? _postponedScope;

  @override
  Widget build(BuildContext context) {
    final tripId = widget.tripId;
    ref.listen(
      packageDownloadControllerProvider(
        tripId,
      ).select((value) => value.policy?.lockedId ?? value.policy?.requiredId),
      (_, _) => ref.invalidate(camperPreparationProvider(tripId)),
    );
    final preparationState = ref.watch(camperPreparationProvider(tripId));
    final preparation = preparationState.isLoading
        ? null
        : preparationState.asData?.value;
    final local = ref.watch(
      packageDownloadControllerProvider(tripId).select(
        (value) => (
          active: value.active,
          expectedId: value.policy?.lockedId ?? value.policy?.requiredId,
        ),
      ),
    );
    final applicableId = preparation?.packageId ?? local.expectedId;
    if (local.active != null &&
        (applicableId == null || local.active?.id == applicableId)) {
      return const SizedBox.shrink();
    }

    final failure = preparationState.error;
    final offline =
        failure is ApiException &&
        (failure.kind == ApiExceptionKind.network ||
            failure.kind == ApiExceptionKind.timeout);
    if (preparation?.acknowledged == true || offline) {
      return const Padding(
        padding: EdgeInsets.only(bottom: AppSpacing.sm),
        child: Text(
          'Chưa có gói an toàn phù hợp trên thiết bị. Khi mất mạng, bạn chưa dùng được bản đồ tuyến, cảnh báo lệch tuyến và hướng dẫn trong gói.',
        ),
      );
    }
    if (preparation == null) return const SizedBox.shrink();

    final download = preparation.status == 'published'
        ? widget.onDownload
        : null;
    final scope = (preparation.packageId, preparation.policyVersion);
    if (_postponedScope == scope) {
      return Align(
        alignment: Alignment.centerLeft,
        child: TextButton(
          onPressed: () => _confirm(context, preparation, download),
          child: const Text('Tiếp tục khi chưa tải'),
        ),
      );
    }

    final departureIn = preparation.startsAt?.difference(DateTime.now());
    final approachingDeparture =
        preparation.status == 'published' &&
        departureIn != null &&
        !departureIn.isNegative &&
        departureIn <= const Duration(hours: 24);
    return CtmsSectionCard(
      title: 'Một chút chuẩn bị cho chuyến đi 🌿',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Gói an toàn sẽ giúp bạn xem tuyến đường, nhận cảnh báo lệch tuyến và tra cứu hướng dẫn ngay cả khi không có mạng.',
          ),
          if (approachingDeparture)
            const Padding(
              padding: EdgeInsets.only(top: AppSpacing.xs),
              child: Text(
                'Chuyến đi sắp bắt đầu. Bạn vẫn có thể tải gói để chuẩn bị.',
              ),
            ),
          const SizedBox(height: AppSpacing.sm),
          if (preparation.status == 'published')
            CtmsButton(
              label: 'Tải gói an toàn',
              icon: Icons.download_outlined,
              onPressed: download,
            ),
          TextButton(
            onPressed: () => setState(() => _postponedScope = scope),
            child: const Text('Để sau nhé'),
          ),
        ],
      ),
    );
  }

  Future<void> _confirm(
    BuildContext context,
    CamperPackagePreparation preparation,
    VoidCallback? download,
  ) async {
    final tripId = widget.tripId;
    final api = ref.read(camperPreparationApiProvider);
    final account = ref.read(offlinePackageAccountProvider);
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => CamperOfflineLimitationsDialog(
        onDownload: download,
        beforeDeparture: preparation.status == 'published',
        onConfirm: () async {
          if (!mounted || ref.read(offlinePackageAccountProvider) != account) {
            throw StateError('Account changed');
          }
          await api.acknowledge(tripId, preparation);
        },
      ),
    );
    if (mounted && result != null) {
      ref.invalidate(camperPreparationProvider(tripId));
    }
  }
}

class CamperOfflineLimitationsDialog extends StatefulWidget {
  const CamperOfflineLimitationsDialog({
    super.key,
    required this.onConfirm,
    required this.beforeDeparture,
    this.onDownload,
  });

  final Future<void> Function() onConfirm;
  final bool beforeDeparture;
  final VoidCallback? onDownload;

  @override
  State<CamperOfflineLimitationsDialog> createState() =>
      _CamperOfflineLimitationsDialogState();
}

class _CamperOfflineLimitationsDialogState
    extends State<CamperOfflineLimitationsDialog> {
  bool _checked = false;
  bool _saving = false;
  bool _failed = false;

  Future<void> _confirm() async {
    setState(() {
      _saving = true;
      _failed = false;
    });
    try {
      await widget.onConfirm();
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    icon: const Icon(Icons.eco_outlined),
    title: const Text('Bạn vẫn muốn tiếp tục chứ?'),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Chuyến đi vẫn đang chờ bạn! 🌱'),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Chỉ có một điều nhỏ cần lưu ý: khi chưa tải gói an toàn, ứng dụng có thể không phát hiện được lúc bạn đi lệch tuyến hoặc hiển thị hướng dẫn khi mất mạng.',
          ),
          if (widget.beforeDeparture) ...[
            const SizedBox(height: AppSpacing.sm),
            const Text(
              'Bạn có thể tải gói trước khi chuyến đi bắt đầu để có trải nghiệm đầy đủ hơn.',
            ),
          ],
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            title: const Text(
              'Mình đã hiểu những giới hạn khi không tải gói an toàn và muốn tiếp tục.',
            ),
            value: _checked,
            onChanged: _saving
                ? null
                : (value) => setState(() => _checked = value == true),
          ),
          if (_failed)
            const Text('Chưa lưu được xác nhận. Bạn có thể đóng hoặc thử lại.'),
        ],
      ),
    ),
    actions: [
      if (widget.onDownload != null)
        TextButton(
          onPressed: _saving
              ? null
              : () {
                  Navigator.of(context).pop();
                  widget.onDownload?.call();
                },
          child: const Text('Tải gói an toàn'),
        ),
      FilledButton(
        onPressed: _checked && !_saving ? _confirm : null,
        child: const Text('Tiếp tục khi chưa tải'),
      ),
    ],
  );
}
