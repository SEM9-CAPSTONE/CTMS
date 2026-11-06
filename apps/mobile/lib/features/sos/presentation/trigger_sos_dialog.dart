import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../application/sos_controller.dart';
import '../domain/sos_alert.dart';
import 'sos_active_screen.dart';

class TriggerSosDialog extends ConsumerStatefulWidget {
  const TriggerSosDialog({
    super.key,
    required this.tripId,
  });

  final String tripId;

  static Future<SosAlert?> show(BuildContext context, {required String tripId}) {
    return showDialog<SosAlert?>(
      context: context,
      barrierDismissible: true,
      builder: (_) => TriggerSosDialog(tripId: tripId),
    );
  }

  @override
  ConsumerState<TriggerSosDialog> createState() => _TriggerSosDialogState();
}

class _TriggerSosDialogState extends ConsumerState<TriggerSosDialog> {
  String _selectedType = 'medical';
  final _notesController = TextEditingController();
  bool _submitting = false;
  String? _error;

  static const _types = [
    (key: 'medical', label: 'Cấp cứu y tế', icon: Icons.medical_services_outlined),
    (key: 'injury', label: 'Chấn thương thể chất', icon: Icons.healing_outlined),
    (key: 'lost', label: 'Lạc đường / Tách đoàn', icon: Icons.explore_off_outlined),
    (key: 'natural_hazard', label: 'Thiên tai / Sạt lở', icon: Icons.landslide_outlined),
    (key: 'other', label: 'Khẩn cấp khác', icon: Icons.warning_amber_rounded),
  ];

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _handleTrigger() async {
    setState(() {
      _submitting = true;
      _error = null;
    });

    double? lat;
    double? lng;
    try {
      final pos = await Geolocator.getLastKnownPosition();
      if (pos != null) {
        lat = pos.latitude;
        lng = pos.longitude;
      }
    } catch (_) {}

    final controller = ref.read(sosControllerProvider(widget.tripId));
    final alert = await controller.triggerSos(
      emergencyType: _selectedType,
      notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      latitude: lat,
      longitude: lng,
    );

    if (!mounted) return;

    if (alert != null) {
      Navigator.of(context).pop(alert);
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => SosActiveScreen(
            tripId: widget.tripId,
            alert: alert,
          ),
        ),
      );
    } else {
      setState(() {
        _submitting = false;
        _error = controller.error ?? 'Không thể khởi tạo tín hiệu SOS';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: AppRadius.cardBorderRadius),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.cardPadding),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.statusDangerBg,
                        borderRadius: AppRadius.controlBorderRadius,
                      ),
                      child: const Icon(
                        Icons.sos_rounded,
                        color: AppColors.statusDanger,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Phát tín hiệu cứu hộ SOS',
                            style: AppTypography.h3.copyWith(
                              fontWeight: FontWeight.w800,
                              color: AppColors.statusDanger,
                            ),
                          ),
                          Text(
                            'Hoạt động ngay cả khi hoàn toàn mất mạng',
                            style: AppTypography.caption.copyWith(
                              color: Colors.black54,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  'Chọn loại tình huống khẩn cấp:',
                  style: AppTypography.caption.copyWith(
                    fontWeight: FontWeight.w700,
                    color: Colors.black,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: _types.map((type) {
                    final selected = _selectedType == type.key;
                    return InkWell(
                      borderRadius: AppRadius.controlBorderRadius,
                      onTap: () => setState(() => _selectedType = type.key),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: selected ? AppColors.statusDangerBg : Colors.grey.shade50,
                          borderRadius: AppRadius.controlBorderRadius,
                          border: Border.all(
                            color: selected ? AppColors.statusDanger : AppColors.border,
                            width: selected ? 1.5 : 1.0,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              type.icon,
                              size: 16,
                              color: selected ? AppColors.statusDanger : Colors.black87,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              type.label,
                              style: AppTypography.caption.copyWith(
                                fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                                color: selected ? AppColors.statusDanger : Colors.black87,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Mô tả thêm tình trạng (nếu có thể):',
                  style: AppTypography.caption.copyWith(
                    fontWeight: FontWeight.w700,
                    color: Colors.black,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                TextField(
                  controller: _notesController,
                  maxLines: 2,
                  style: const TextStyle(fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Ví dụ: Nạn nhân bị trẹo mắt cá chân, đang ở gần mỏm đá...',
                    hintStyle: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                    contentPadding: const EdgeInsets.all(AppSpacing.md),
                    border: OutlineInputBorder(
                      borderRadius: AppRadius.controlBorderRadius,
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    _error!,
                    style: AppTypography.caption.copyWith(
                      color: AppColors.statusDanger,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                Row(
                  children: [
                    Expanded(
                      child: CtmsButton(
                        label: 'Quay lại',
                        variant: CtmsButtonVariant.secondary,
                        onPressed: _submitting ? null : () => Navigator.of(context).pop(),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      flex: 2,
                      child: CtmsButton(
                        label: _submitting ? 'ĐANG PHÁT...' : 'PHÁT TÍN HIỆU NGAY',
                        variant: CtmsButtonVariant.danger,
                        icon: Icons.emergency,
                        isLoading: _submitting,
                        onPressed: _submitting ? null : _handleTrigger,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
