import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../application/register_controller.dart';
import '../register_strings.dart';
import 'register_campsite_multi_select.dart';
import 'register_district_field.dart';

/// Step 4 for the Porter role. A Porter is a trekking/camping guide, not a
/// porter-as-luggage-carrier, and isn't tied to one fixed location — they
/// pick a district, then declare which of the Host-managed campsites in it
/// they know well enough to guide at. Host assigns the actual bookings
/// later; this step is just the coverage profile Host sees when doing that.
class RegisterPorterProfessionalStep extends ConsumerWidget {
  const RegisterPorterProfessionalStep({
    super.key,
    required this.formKey,
    required this.experienceYearsController,
    required this.certificationCodeController,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController experienceYearsController;
  final TextEditingController certificationCodeController;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mutedColor = Theme.of(context).colorScheme.onSurfaceVariant;
    final wizardData = ref.watch(registerControllerProvider.select((state) => state.data));
    final controller = ref.read(registerControllerProvider.notifier);

    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(RegisterStrings.porterProfileStepTitle, style: AppTypography.h2),
          const SizedBox(height: AppSpacing.xs),
          Text(
            RegisterStrings.porterProfileStepSubtitle,
            style: AppTypography.body.copyWith(color: mutedColor),
          ),
          const SizedBox(height: AppSpacing.xxl),
          TextFormField(
            controller: experienceYearsController,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: RegisterStrings.experienceYearsLabel,
              prefixIcon: Icon(Icons.hiking_outlined),
            ),
            validator: (value) {
              final years = int.tryParse(value?.trim() ?? '');
              return (years == null || years < 0) ? RegisterStrings.experienceYearsError : null;
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          RegisterDistrictField(
            selectedId: wizardData.operatingDistrictId,
            onChanged: controller.setOperatingDistrict,
          ),
          if (wizardData.operatingDistrictId != null) ...[
            const SizedBox(height: AppSpacing.lg),
            RegisterCampsiteMultiSelect(
              districtId: wizardData.operatingDistrictId!,
              selectedIds: wizardData.preferredCampsiteIds,
              onToggle: controller.toggleCampsite,
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          TextFormField(
            controller: certificationCodeController,
            textInputAction: TextInputAction.done,
            decoration: const InputDecoration(
              labelText: RegisterStrings.certificationCodeLabel,
              hintText: RegisterStrings.certificationCodeHint,
              prefixIcon: Icon(Icons.verified_outlined),
            ),
          ),
        ],
      ),
    );
  }
}
