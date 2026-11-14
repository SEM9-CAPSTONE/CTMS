import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/api/api_exception.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/ctms_button.dart';
import '../../../../core/widgets/ctms_empty_state.dart';
import '../../data/trip_recommendations_api.dart';
import '../../domain/trip_recommendation.dart';

const tripTypeOptions = [('day_trip', 'Trong ngày'), ('overnight', 'Qua đêm')];
const difficultyOptions = [
  ('easy', 'Dễ'),
  ('moderate', 'Trung bình'),
  ('hard', 'Khó'),
  ('expert', 'Chuyên gia'),
];
const _maxPriceVnd = 1000000000;

final _vnd = NumberFormat.decimalPattern('vi_VN');

/// "500.000 đ – 2.500.000 đ", "Từ 500.000 đ", "Đến 2.000.000 đ", or null.
String? formatPriceRange(int? minPrice, int? maxPrice) {
  String money(int amount) => '${_vnd.format(amount)} đ';
  if (minPrice != null && maxPrice != null) {
    return '${money(minPrice)} – ${money(maxPrice)}';
  }
  if (minPrice != null) return 'Từ ${money(minPrice)}';
  if (maxPrice != null) return 'Đến ${money(maxPrice)}';
  return null;
}

/// Read-only labels of the saved preferences, for the summary at the top of the suggestions.
List<String> preferenceChips(TripPreferences preferences) {
  String label(List<(String, String)> options, String value) =>
      options.firstWhere((o) => o.$1 == value, orElse: () => (value, value)).$2;
  final price = formatPriceRange(preferences.minPrice, preferences.maxPrice);
  return [
    for (final value in preferences.tripTypes) label(tripTypeOptions, value),
    for (final value in preferences.difficulties)
      'Độ khó ${label(difficultyOptions, value)}',
    for (final code in preferences.regions)
      preferences.regionOptions
          .firstWhere(
            (o) => o.code == code,
            orElse: () => TripRegionOption(code, code),
          )
          .label,
    ?price,
  ];
}

/// Opens the same form as the web dialog. Returns true when preferences were saved.
Future<bool> showTripPreferencesSheet(BuildContext context) async {
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const TripPreferencesSheet(),
  );
  return saved ?? false;
}

class TripPreferencesSheet extends ConsumerWidget {
  const TripPreferencesSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preferences = ref.watch(tripPreferencesProvider);
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: preferences.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.xxl),
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (_, _) => CtmsEmptyState(
          icon: Icons.cloud_off_outlined,
          title: 'Không tải được sở thích của bạn',
          action: CtmsButton(
            label: 'Thử lại',
            onPressed: () => ref.invalidate(tripPreferencesProvider),
          ),
        ),
        data: (value) => _PreferencesForm(initial: value),
      ),
    );
  }
}

class _PreferencesForm extends ConsumerStatefulWidget {
  const _PreferencesForm({required this.initial});

  final TripPreferences initial;

  @override
  ConsumerState<_PreferencesForm> createState() => _PreferencesFormState();
}

class _PreferencesFormState extends ConsumerState<_PreferencesForm> {
  late Set<String> _tripTypes = {...widget.initial.tripTypes};
  late Set<String> _difficulties = {...widget.initial.difficulties};
  late Set<String> _regions = {...widget.initial.regions};
  late final _minPrice = TextEditingController(
    text: widget.initial.minPrice?.toString() ?? '',
  );
  late final _maxPrice = TextEditingController(
    text: widget.initial.maxPrice?.toString() ?? '',
  );
  String? _priceError;
  bool _saving = false;

  @override
  void dispose() {
    _minPrice.dispose();
    _maxPrice.dispose();
    super.dispose();
  }

  int? _parse(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;
    final amount = int.tryParse(trimmed);
    return amount == null || amount > _maxPriceVnd ? -1 : amount;
  }

  void _clear() => setState(() {
    _tripTypes = {};
    _difficulties = {};
    _regions = {};
    _minPrice.clear();
    _maxPrice.clear();
    _priceError = null;
  });

  Future<void> _save() async {
    final minPrice = _parse(_minPrice.text);
    final maxPrice = _parse(_maxPrice.text);
    if (minPrice == -1 || maxPrice == -1) {
      setState(() => _priceError = 'Nhập số tiền hợp lệ, không quá 1 tỷ đồng.');
      return;
    }
    if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
      setState(
        () => _priceError = 'Giá thấp nhất không được lớn hơn giá cao nhất.',
      );
      return;
    }
    setState(() {
      _priceError = null;
      _saving = true;
    });
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    try {
      await ref
          .read(tripPreferencesRepositoryProvider)
          .replace(
            TripPreferences(
              tripTypes: _tripTypes,
              difficulties: _difficulties,
              regions: _regions,
              minPrice: minPrice,
              maxPrice: maxPrice,
            ),
          );
      ref.invalidate(tripPreferencesProvider);
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Đã lưu sở thích chuyến đi. Gợi ý đang được cập nhật.'),
        ),
      );
      navigator.pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      final invalid = error is ApiException && error.statusCode == 422;
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            invalid
                ? 'Sở thích chưa hợp lệ. Vui lòng kiểm tra lại khoảng giá.'
                : 'Không thể lưu sở thích. Vui lòng thử lại.',
          ),
        ),
      );
    }
  }

  Widget _group(
    String title,
    List<(String, String)> options,
    Set<String> selected,
    void Function(Set<String>) onChanged,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: AppTypography.bodyStrong),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final (code, label) in options)
              FilterChip(
                label: Text(label),
                selected: selected.contains(code),
                onSelected: _saving
                    ? null
                    : (value) => setState(
                        () => onChanged(
                          value
                              ? {...selected, code}
                              : ({...selected}..remove(code)),
                        ),
                      ),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xxl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Sở thích để gợi ý chuyến đi', style: AppTypography.h2),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Không bắt buộc. Hệ thống ưu tiên các chuyến khớp lựa chọn của bạn và giải thích lý do khi bạn mở chuyến; chuyến không khớp vẫn có thể được gợi ý.',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.lg),
          _group(
            'Loại chuyến',
            tripTypeOptions,
            _tripTypes,
            (next) => _tripTypes = next,
          ),
          _group(
            'Độ khó',
            difficultyOptions,
            _difficulties,
            (next) => _difficulties = next,
          ),
          _group(
            'Khu vực',
            [
              for (final option in widget.initial.regionOptions)
                (option.code, option.label),
            ],
            _regions,
            (next) => _regions = next,
          ),
          Text('Khoảng giá mỗi người (đồng)', style: AppTypography.bodyStrong),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _minPrice,
                  enabled: !_saving,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: InputDecoration(
                    labelText: 'Từ',
                    hintText: 'Ví dụ 500000',
                    errorText: _priceError == null ? null : '',
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: TextField(
                  controller: _maxPrice,
                  enabled: !_saving,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: InputDecoration(
                    labelText: 'Đến',
                    hintText: 'Ví dụ 2000000',
                    errorText: _priceError == null ? null : '',
                  ),
                ),
              ),
            ],
          ),
          if (_priceError case final error?)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm),
              child: Text(
                error,
                style: AppTypography.caption.copyWith(
                  color: Theme.of(context).colorScheme.error,
                ),
              ),
            ),
          const SizedBox(height: AppSpacing.xl),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              TextButton(
                onPressed: _saving ? null : _clear,
                child: const Text('Bỏ chọn tất cả'),
              ),
              CtmsButton(
                label: 'Lưu sở thích',
                isLoading: _saving,
                onPressed: _saving ? null : _save,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
