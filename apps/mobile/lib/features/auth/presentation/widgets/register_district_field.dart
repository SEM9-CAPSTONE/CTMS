import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/widgets/ctms_error_state.dart';
import '../../../../core/widgets/ctms_loading_state.dart';
import '../../data/porter_coverage_repository.dart';
import '../register_strings.dart';

/// "Quận/Huyện mong muốn công tác" — a Porter picks one district at a
/// time; [RegisterCampsiteMultiSelect] then lists that district's
/// Host-managed locations. Reads [operatingDistrictsProvider], so once that
/// provider is backed by a real endpoint this widget needs no changes.
class RegisterDistrictField extends ConsumerWidget {
  const RegisterDistrictField({super.key, required this.selectedId, required this.onChanged});

  final String? selectedId;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final districtsAsync = ref.watch(operatingDistrictsProvider);

    return districtsAsync.when(
      data: (districts) => DropdownButtonFormField<String>(
        initialValue: selectedId,
        isExpanded: true,
        decoration: const InputDecoration(
          labelText: RegisterStrings.operatingDistrictLabel,
          prefixIcon: Icon(Icons.map_outlined),
        ),
        items: [
          for (final district in districts)
            DropdownMenuItem(value: district.id, child: Text(district.name)),
        ],
        onChanged: (value) {
          if (value != null) onChanged(value);
        },
        validator: (value) => value == null ? RegisterStrings.operatingDistrictError : null,
      ),
      loading: () => const CtmsLoadingState(),
      error: (error, _) => CtmsErrorState(
        message: '$error',
        onRetry: () => ref.invalidate(operatingDistrictsProvider),
      ),
    );
  }
}
