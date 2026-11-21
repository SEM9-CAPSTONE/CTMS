import 'package:flutter/material.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../profile/domain/activity_profile.dart';

class ActivityProfileEditor extends StatefulWidget {
  const ActivityProfileEditor({
    super.key,
    this.initial,
    required this.enabled,
    required this.onChanged,
  });
  final ActivityProfile? initial;
  final bool enabled;
  final ValueChanged<ActivityProfile> onChanged;
  @override
  State<ActivityProfileEditor> createState() => _ActivityProfileEditorState();
}

class _ActivityProfileEditorState extends State<ActivityProfileEditor> {
  late final _distance = TextEditingController(
    text: widget.initial?.comfortableDistanceKm?.toString() ?? '',
  );
  late final _minutes = TextEditingController(
    text: widget.initial?.comfortableWalkingMinutes?.toString() ?? '',
  );
  late final _notes = TextEditingController(
    text: widget.initial?.activityNotes ?? '',
  );
  int? _integerValue(String text) {
    final value = double.tryParse(text.replaceAll(',', '.'));
    return value != null && value.isFinite && value == value.roundToDouble()
        ? value.toInt()
        : null;
  }

  void _changed() => widget.onChanged(
    ActivityProfile(
      comfortableDistanceKm: double.tryParse(
        _distance.text.replaceAll(',', '.'),
      ),
      comfortableWalkingMinutes: _integerValue(_minutes.text),
      activityNotes: _notes.text.trim(),
      confirmedAt: widget.initial?.confirmedAt,
    ),
  );
  @override
  void dispose() {
    for (final controller in [_distance, _minutes, _notes]) {
      controller.dispose();
    }
    super.dispose();
  }

  Widget _number(
    TextEditingController controller,
    String label,
    double min,
    double max, {
    bool integer = true,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.md),
    child: TextFormField(
      controller: controller,
      enabled: widget.enabled,
      decoration: InputDecoration(labelText: label),
      keyboardType: TextInputType.numberWithOptions(decimal: !integer),
      onChanged: (_) => _changed(),
      validator: (value) {
        if (value == null || value.trim().isEmpty) return null;
        final number = double.tryParse(value.replaceAll(',', '.'));
        if (number == null ||
            !number.isFinite ||
            number < min ||
            number > max ||
            (integer && number != number.roundToDouble())) {
          return 'Vui lòng nhập số từ $min đến $max.';
        }
        return null;
      },
    ),
  );
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _number(
        _distance,
        'Quãng đường đi bộ quen thuộc (km/ngày)',
        0,
        200,
        integer: false,
      ),
      _number(_minutes, 'Thời gian đi bộ quen thuộc (phút/ngày)', 0, 1440),
      TextFormField(
        controller: _notes,
        enabled: widget.enabled,
        maxLength: 1200,
        maxLines: 3,
        decoration: const InputDecoration(labelText: 'Lưu ý khi vận động'),
        onChanged: (_) => _changed(),
      ),
    ],
  );
}
