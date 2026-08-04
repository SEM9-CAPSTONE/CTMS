import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_error_state.dart';
import '../../../../core/widgets/ctms_loading_state.dart';
import '../../data/porter_coverage_repository.dart';
import '../../domain/porter_coverage_models.dart';
import '../register_strings.dart';

/// "Địa điểm có thể dẫn đoàn" — multi-select over the Host-managed
/// campsites in [districtId], via [campsitesInDistrictProvider]. A Porter
/// can cover several locations across different Hosts, so this is a
/// checklist, not a single choice. Nothing here is district-specific
/// beyond the provider key, so it scales to any number of
/// districts/campsites without changes once real data replaces the mock.
class RegisterCampsiteMultiSelect extends ConsumerWidget {
  const RegisterCampsiteMultiSelect({
    super.key,
    required this.districtId,
    required this.selectedIds,
    required this.onToggle,
  });

  final String districtId;
  final List<String> selectedIds;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final optionsAsync = ref.watch(campsitesInDistrictProvider(districtId));
    final scheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(RegisterStrings.campsiteMultiSelectLabel, style: AppTypography.bodyStrong),
        const SizedBox(height: 2),
        Text(
          RegisterStrings.campsiteMultiSelectHelper,
          style: AppTypography.caption.copyWith(color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: AppSpacing.sm),
        optionsAsync.when(
          data: (options) => options.isEmpty
              ? _EmptyDistrictNotice(color: scheme.onSurfaceVariant)
              : _CampsiteList(options: options, selectedIds: selectedIds, onToggle: onToggle),
          loading: () => const CtmsLoadingState(),
          error: (error, _) => CtmsErrorState(
            message: '$error',
            onRetry: () => ref.invalidate(campsitesInDistrictProvider(districtId)),
          ),
        ),
      ],
    );
  }
}

class _EmptyDistrictNotice extends StatelessWidget {
  const _EmptyDistrictNotice({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: AppColors.border),
      ),
      child: Text(
        RegisterStrings.campsiteEmptyForDistrict,
        style: AppTypography.body.copyWith(color: color),
      ),
    );
  }
}

class _CampsiteList extends StatelessWidget {
  const _CampsiteList({required this.options, required this.selectedIds, required this.onToggle});

  final List<PorterCampsiteOption> options;
  final List<String> selectedIds;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: AppRadius.cardBorderRadius,
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < options.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: AppColors.border),
            CheckboxListTile(
              value: selectedIds.contains(options[i].id),
              onChanged: (_) => onToggle(options[i].id),
              controlAffinity: ListTileControlAffinity.leading,
              title: Text(options[i].name, style: AppTypography.body),
              subtitle: Text(
                options[i].hostName,
                style: AppTypography.caption.copyWith(color: AppColors.textMuted),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
