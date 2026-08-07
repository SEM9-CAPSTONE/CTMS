import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/porter_coverage_repository.dart';
import '../../domain/porter_coverage_models.dart';
import '../register_strings.dart';
import 'register_summary_row.dart';

/// Step 5 recap of the Step 4 coverage picks — the district plus every
/// selected campsite, one per line
/// ("Hiển thị danh sách địa điểm theo dạng nhiều dòng để dễ đọc").
/// Resolves ids back to display names from the same providers Step 4 reads,
/// so it never drifts from what's actually selectable there.
class RegisterPorterCoverageSummary extends ConsumerWidget {
  const RegisterPorterCoverageSummary({
    super.key,
    required this.districtId,
    required this.campsiteIds,
  });

  final String districtId;
  final List<String> campsiteIds;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final districts = ref.watch(operatingDistrictsProvider).valueOrNull ?? const [];
    final campsites = ref.watch(campsitesInDistrictProvider(districtId)).valueOrNull ?? const [];

    final districtName = _nameFor(districts, districtId) ?? districtId;
    final campsiteNames = campsiteIds
        .map((id) => _campsiteNameFor(campsites, id) ?? id)
        .toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        RegisterSummaryRow(label: RegisterStrings.operatingDistrictLabel, value: districtName),
        if (campsiteNames.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            RegisterStrings.campsiteMultiSelectLabel,
            style: AppTypography.caption.copyWith(color: AppColors.textMuted),
          ),
          const SizedBox(height: 4),
          for (final name in campsiteNames)
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text('•  $name', style: AppTypography.bodyStrong),
            ),
        ],
      ],
    );
  }

  String? _nameFor(List<OperatingDistrict> districts, String id) {
    for (final district in districts) {
      if (district.id == id) return district.name;
    }
    return null;
  }

  String? _campsiteNameFor(List<PorterCampsiteOption> campsites, String id) {
    for (final campsite in campsites) {
      if (campsite.id == id) return campsite.name;
    }
    return null;
  }
}
