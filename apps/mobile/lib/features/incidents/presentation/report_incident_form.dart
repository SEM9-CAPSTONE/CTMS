import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/ctms_button.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../application/incidents_controller.dart';
import '../domain/trip_incident.dart';

class ReportIncidentForm extends StatefulWidget {
  const ReportIncidentForm({
    super.key,
    required this.trip,
    required this.controller,
  });
  final IncidentTrip trip;
  final IncidentsController controller;
  @override
  State<ReportIncidentForm> createState() => _ReportIncidentFormState();
}

class _ReportIncidentFormState extends State<ReportIncidentForm> {
  final _form = GlobalKey<FormState>();
  final _description = TextEditingController();
  final _occurredAt = DateTime.now();
  String _category = 'injury';
  String _severity = 'medium';
  IncidentJson? _location;
  Uint8List? _photo;
  String? _error;
  bool _locating = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _locate();
  }

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _locate() async {
    setState(() => _locating = true);
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return;
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 5),
        ),
      );
      if (!mounted) return;
      setState(
        () => _location = {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracyMeters': position.accuracy,
          'capturedAt': position.timestamp.toUtc().toIso8601String(),
        },
      );
    } catch (_) {
      // Fallback: GPS location can stay null if unavailable or timed out
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _pickPhoto() async {
    try {
      final photo = await ImagePicker().pickImage(source: ImageSource.gallery);
      if (photo == null) return;
      if (await photo.length() > incidentPhotoMaxBytes) {
        throw StateError('Ảnh phải không quá 5 MB.');
      }
      if (![
        'jpg',
        'jpeg',
        'png',
        'webp',
      ].contains(photo.name.split('.').last.toLowerCase())) {
        throw StateError('Chọn ảnh JPEG, PNG hoặc WebP.');
      }
      final bytes = await photo.readAsBytes();
      if (mounted) {
        setState(() {
          _photo = bytes;
          _error = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'Không thể chọn ảnh. Chọn JPEG, PNG hoặc WebP tối đa 5 MB.',
        );
      }
    }
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.controller.save(
        trip: widget.trip,
        category: _category,
        severity: _severity,
        description: _description.text,
        occurredAt: _occurredAt,
        location: _location,
        photo: _photo,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(
          () => _error =
              'Chưa lưu được sự cố: ${e.toString().replaceAll('Exception:', '').replaceAll('StateError:', '')}.',
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_saving,
    child: CtmsScaffold(
      title: 'Báo cáo sự cố',
      subtitle: 'Nhập thông tin sự cố phát sinh tại hiện trường',
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
        tooltip: 'Quay lại',
        onPressed: _saving ? null : () => Navigator.of(context).maybePop(),
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.xxl),
          children: [
            // Trip Title Header Card
            Container(
              padding: const EdgeInsets.all(AppSpacing.cardPadding),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppRadius.cardBorderRadius,
                border: Border.all(color: AppColors.border),
                boxShadow: AppColors.cardShadowSm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Chuyến đi ghi nhận sự cố',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    widget.trip.title,
                    style: AppTypography.h3.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),

            // Category Dropdown
            Text(
              'Loại sự cố',
              style: AppTypography.label.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppRadius.cardBorderRadius,
                border: Border.all(color: AppColors.border),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _category,
                  isExpanded: true,
                  items: incidentCategories.entries
                      .map(
                        (v) => DropdownMenuItem(
                          value: v.key,
                          child: Text(
                            v.value,
                            style: AppTypography.body.copyWith(
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: _saving ? null : (v) => setState(() => _category = v!),
                ),
              ),
            ),

            const SizedBox(height: AppSpacing.lg),

            // Severity Dropdown
            Text(
              'Mức độ nghiêm trọng',
              style: AppTypography.label.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppRadius.cardBorderRadius,
                border: Border.all(color: AppColors.border),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _severity,
                  isExpanded: true,
                  items: incidentSeverities.entries
                      .map(
                        (v) => DropdownMenuItem(
                          value: v.key,
                          child: Text(
                            v.value,
                            style: AppTypography.body.copyWith(
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: _saving ? null : (v) => setState(() => _severity = v!),
                ),
              ),
            ),

            const SizedBox(height: AppSpacing.lg),

            // Description
            Text(
              'Mô tả chi tiết sự cố *',
              style: AppTypography.label.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            TextFormField(
              controller: _description,
              maxLines: 4,
              maxLength: incidentDescriptionMaxLength,
              enabled: !_saving,
              decoration: InputDecoration(
                hintText: 'Mô tả cụ thể sự việc, tình trạng nạn nhân / thiết bị, hành động đã xử lý sơ bộ...',
                hintStyle: AppTypography.body.copyWith(color: AppColors.textSecondary),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: AppRadius.cardBorderRadius,
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: AppRadius.cardBorderRadius,
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: AppRadius.cardBorderRadius,
                  borderSide: const BorderSide(color: AppColors.brandPrimary, width: 2),
                ),
              ),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Vui lòng nhập mô tả sự cố.' : null,
            ),

            const SizedBox(height: AppSpacing.sm),

            // Location Box
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppRadius.cardBorderRadius,
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.gps_fixed,
                        size: 16,
                        color: _location != null ? AppColors.brandPrimary : AppColors.textSecondary,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        'Toạ độ GPS',
                        style: AppTypography.label.copyWith(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const Spacer(),
                      if (_locating)
                        const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      else
                        TextButton(
                          onPressed: _saving ? null : _locate,
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: Text(
                            'Cập nhật vị trí',
                            style: AppTypography.caption.copyWith(
                              color: AppColors.brandPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    _location == null
                        ? (_locating
                            ? 'Đang tìm kiếm toạ độ GPS...'
                            : 'Chưa có toạ độ GPS. Báo cáo vẫn có thể gửi mà không kèm GPS.')
                        : '${_location!['latitude']}, ${_location!['longitude']} (sai số ±${_location!['accuracyMeters']} m)',
                    style: AppTypography.caption.copyWith(
                      color: _location != null ? AppColors.textPrimary : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: AppSpacing.lg),

            // Photo Attachment Box
            if (_photo != null) ...[
              ClipRRect(
                borderRadius: AppRadius.cardBorderRadius,
                child: Image.memory(_photo!, height: 180, fit: BoxFit.cover),
              ),
              const SizedBox(height: AppSpacing.xs),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: _saving ? null : () => setState(() => _photo = null),
                  icon: const Icon(Icons.delete_outline, size: 16, color: AppColors.statusDanger),
                  label: Text('Gỡ ảnh đính kèm', style: AppTypography.caption.copyWith(color: AppColors.statusDanger)),
                ),
              ),
            ] else ...[
              OutlinedButton.icon(
                onPressed: _saving ? null : _pickPhoto,
                icon: const Icon(Icons.photo_camera_outlined, size: 18),
                label: const Text('Đính kèm ảnh hiện trường (tuỳ chọn)'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                  shape: RoundedRectangleBorder(borderRadius: AppRadius.cardBorderRadius),
                  side: const BorderSide(color: AppColors.border),
                  foregroundColor: AppColors.textPrimary,
                ),
              ),
            ],

            if (_error != null) ...[
              const SizedBox(height: AppSpacing.md),
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.statusDanger.withValues(alpha: 0.1),
                  borderRadius: AppRadius.cardBorderRadius,
                  border: Border.all(color: AppColors.statusDanger.withValues(alpha: 0.3)),
                ),
                child: Text(
                  _error!,
                  style: AppTypography.caption.copyWith(
                    color: AppColors.statusDanger,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],

            const SizedBox(height: AppSpacing.xxl),

            CtmsButton(
              label: _saving ? 'Đang gửi báo cáo...' : 'Gửi báo cáo sự cố',
              icon: Icons.send_rounded,
              variant: CtmsButtonVariant.primary,
              isLoading: _saving,
              onPressed: _saving ? null : _save,
            ),
          ],
        ),
      ),
    ),
  );
}
