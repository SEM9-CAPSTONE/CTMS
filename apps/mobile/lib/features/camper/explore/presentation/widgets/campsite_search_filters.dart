import 'package:flutter/material.dart';

import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/widgets/ctms_button.dart';
import '../../application/campsite_search_controller.dart' show fixedExploreProvince;

/// CTMS-17-T02 (mobile). Exactly the filters CTMS-77 accepts (province,
/// amenities, minPrice, maxPrice) -- no status selector, no
/// date/guest-count/campsite-type fields (Figma Frame #21 has them, the
/// real backend contract doesn't -- see the Decision Gate this feature was
/// built against). Pure presentation: takes current values + callbacks,
/// no API call, no permission logic, no business filtering of its own.
///
/// `province` is not a user input: Explore is scoped to Đà Nẵng only
/// (product decision), shown as a static, non-editable line rather than a
/// field -- there is no backend support for a finer-grained
/// district/"city" filter (no such column exists on `campsites` at all), so
/// this deliberately does not offer one instead of shipping a control that
/// would look like it filters but silently wouldn't.
///
/// Search/Reset are disabled while [isLoading] (BR-241); the input fields
/// themselves are never disabled, so a Camper can keep typing the next
/// filter while the current search is still in flight.
class CampsiteSearchFilters extends StatefulWidget {
  const CampsiteSearchFilters({
    super.key,
    required this.amenities,
    required this.minPrice,
    required this.maxPrice,
    required this.isLoading,
    required this.onAmenitiesChanged,
    required this.onMinPriceChanged,
    required this.onMaxPriceChanged,
    required this.onSubmit,
    required this.onReset,
  });

  final String amenities;
  final String minPrice;
  final String maxPrice;
  final bool isLoading;
  final ValueChanged<String> onAmenitiesChanged;
  final ValueChanged<String> onMinPriceChanged;
  final ValueChanged<String> onMaxPriceChanged;
  final VoidCallback onSubmit;
  final VoidCallback onReset;

  @override
  State<CampsiteSearchFilters> createState() => _CampsiteSearchFiltersState();
}

class _CampsiteSearchFiltersState extends State<CampsiteSearchFilters> {
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
    _syncIfExternal(_amenitiesController, widget.amenities);
    _syncIfExternal(_minPriceController, widget.minPrice);
    _syncIfExternal(_maxPriceController, widget.maxPrice);
  }

  void _syncIfExternal(TextEditingController controller, String value) {
    if (controller.text != value) controller.text = value;
  }

  @override
  void dispose() {
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
        Row(
          children: [
            Icon(Icons.location_on_outlined, color: Theme.of(context).colorScheme.onSurfaceVariant),
            const SizedBox(width: AppSpacing.xs),
            Text(
              'Khu vực: $fixedExploreProvince',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ],
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
