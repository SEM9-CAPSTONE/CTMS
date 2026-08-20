import 'package:flutter/material.dart';

import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/widgets/ctms_button.dart';

/// CTMS-17-T02 (mobile). Exactly the 5 filters CTMS-77 accepts (province,
/// city, amenities, minPrice, maxPrice) -- no status selector, no
/// date/guest-count/campsite-type fields (Figma Frame #21 has them, the
/// real backend contract doesn't -- see the Decision Gate this feature was
/// built against). Pure presentation: takes current values + callbacks,
/// no API call, no permission logic, no business filtering of its own.
///
/// Search/Reset are disabled while [isLoading] (BR-241); the 5 fields
/// themselves are never disabled, so a Camper can keep typing the next
/// filter while the current search is still in flight.
class CampsiteSearchFilters extends StatefulWidget {
  const CampsiteSearchFilters({
    super.key,
    required this.province,
    required this.city,
    required this.amenities,
    required this.minPrice,
    required this.maxPrice,
    required this.isLoading,
    required this.onProvinceChanged,
    required this.onCityChanged,
    required this.onAmenitiesChanged,
    required this.onMinPriceChanged,
    required this.onMaxPriceChanged,
    required this.onSubmit,
    required this.onReset,
  });

  final String province;
  final String city;
  final String amenities;
  final String minPrice;
  final String maxPrice;
  final bool isLoading;
  final ValueChanged<String> onProvinceChanged;
  final ValueChanged<String> onCityChanged;
  final ValueChanged<String> onAmenitiesChanged;
  final ValueChanged<String> onMinPriceChanged;
  final ValueChanged<String> onMaxPriceChanged;
  final VoidCallback onSubmit;
  final VoidCallback onReset;

  @override
  State<CampsiteSearchFilters> createState() => _CampsiteSearchFiltersState();
}

class _CampsiteSearchFiltersState extends State<CampsiteSearchFilters> {
  late final _provinceController = TextEditingController(text: widget.province);
  late final _cityController = TextEditingController(text: widget.city);
  late final _amenitiesController = TextEditingController(text: widget.amenities);
  late final _minPriceController = TextEditingController(text: widget.minPrice);
  late final _maxPriceController = TextEditingController(text: widget.maxPrice);

  @override
  void didUpdateWidget(CampsiteSearchFilters oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Only overwrite a controller's text when it diverges from the parent's
    // value from OUTSIDE this widget (e.g. resetFilters() clearing state) --
    // when the divergence is just this widget's own onChanged round-trip,
    // the two already match here and nothing happens, so the cursor never
    // jumps mid-typing.
    _syncIfExternal(_provinceController, widget.province);
    _syncIfExternal(_cityController, widget.city);
    _syncIfExternal(_amenitiesController, widget.amenities);
    _syncIfExternal(_minPriceController, widget.minPrice);
    _syncIfExternal(_maxPriceController, widget.maxPrice);
  }

  void _syncIfExternal(TextEditingController controller, String value) {
    if (controller.text != value) controller.text = value;
  }

  @override
  void dispose() {
    _provinceController.dispose();
    _cityController.dispose();
    _amenitiesController.dispose();
    _minPriceController.dispose();
    _maxPriceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _provinceController,
          onChanged: widget.onProvinceChanged,
          decoration: const InputDecoration(
            labelText: 'Tỉnh/Thành',
            hintText: 'Ví dụ: Lâm Đồng',
            prefixIcon: Icon(Icons.location_on_outlined),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        TextField(
          controller: _cityController,
          onChanged: widget.onCityChanged,
          decoration: const InputDecoration(
            labelText: 'Thành phố',
            hintText: 'Ví dụ: Đà Lạt',
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        TextField(
          controller: _amenitiesController,
          onChanged: widget.onAmenitiesChanged,
          decoration: const InputDecoration(
            labelText: 'Tiện ích',
            hintText: 'wifi, nhà vệ sinh...',
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _minPriceController,
                onChanged: widget.onMinPriceChanged,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Giá từ'),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: TextField(
                controller: _maxPriceController,
                onChanged: widget.onMaxPriceChanged,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Giá đến'),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            Expanded(
              child: CtmsButton(
                label: 'Tìm kiếm',
                icon: Icons.search,
                isLoading: widget.isLoading,
                onPressed: widget.isLoading ? null : widget.onSubmit,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            CtmsButton(
              label: 'Đặt lại',
              variant: CtmsButtonVariant.secondary,
              onPressed: widget.isLoading ? null : widget.onReset,
            ),
          ],
        ),
      ],
    );
  }
}
