import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/api/client_uuid.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/ctms_scaffold.dart';
import '../application/danger_zone_report_queue.dart';
import '../application/report_gps.dart';
import '../application/report_photos.dart';
import '../domain/danger_zone_report.dart';

class ReportDangerZoneForm extends ConsumerStatefulWidget {
  const ReportDangerZoneForm({
    super.key,
    required this.tripId,
    required this.tripTitle,
    required this.queue,
  });
  final String tripId;
  final String tripTitle;
  final DangerZoneReportQueue queue;
  @override
  ConsumerState<ReportDangerZoneForm> createState() =>
      _ReportDangerZoneFormState();
}

class _ReportDangerZoneFormState extends ConsumerState<ReportDangerZoneForm> {
  final _form = GlobalKey<FormState>();
  final _description = TextEditingController();
  String _hazard = 'SLIPPERY_OR_LANDSLIDE';
  String _severity = 'medium';
  ReportJson? _location;
  String? _gpsError;
  bool _locating = false;
  bool _saving = false;
  bool _picking = false;
  final List<Uint8List> _photos = [];
  Timer? _gpsRefresh;
  @override
  void initState() {
    super.initState();
    _locate();
    // The server needs a fix taken within 30 seconds of saving, so keep it fresh in the
    // background instead of making the Porter wait for GPS when they press send.
    _gpsRefresh = Timer.periodic(
      const Duration(seconds: 20),
      (_) => _refreshQuietly(),
    );
  }

  Future<void> _refreshQuietly() async {
    if (_locating || _saving || _location == null) return;
    try {
      final fix = await ref.read(reportGpsReaderProvider)();
      if (mounted && !_saving) setState(() => _location = fix);
    } catch (_) {
      // Keep the current fix; saving falls back to an explicit GPS refresh when it is stale.
    }
  }

  @override
  void dispose() {
    _gpsRefresh?.cancel();
    _description.dispose();
    super.dispose();
  }

  Future<bool> _locate() async {
    setState(() {
      _locating = true;
      _gpsError = null;
      _location = null;
    });
    try {
      final fix = await ref.read(reportGpsReaderProvider)();
      if (!mounted) return false;
      setState(() => _location = fix);
      return true;
    } catch (error) {
      if (mounted) {
        setState(
          () => _gpsError = error is ReportGpsException
              ? error.message
              : 'Chưa lấy được GPS. Hãy kiểm tra quyền vị trí và thử lại.',
        );
      }
      return false;
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  void _photoMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(backgroundColor: Colors.red, content: Text(message)),
    );
  }

  Future<void> _pickPhoto(ImageSource source) async {
    if (_picking || _photos.length >= dangerReportMaxPhotos) return;
    setState(() => _picking = true);
    try {
      final bytes = await ref.read(reportPhotoPickerProvider)(source);
      if (bytes == null || !mounted) return;
      if (bytes.length > dangerReportPhotoMaxBytes) {
        _photoMessage('Ảnh phải không quá 5 MB.');
      } else if (!isSupportedReportPhoto(bytes)) {
        _photoMessage('Chọn ảnh JPEG, PNG hoặc WebP.');
      } else {
        setState(() => _photos.add(bytes));
      }
    } catch (_) {
      _photoMessage(
        source == ImageSource.camera
            ? 'Không mở được máy ảnh. Hãy kiểm tra quyền truy cập máy ảnh.'
            : 'Không chọn được ảnh. Vui lòng thử lại.',
      );
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  bool get _sameAccount =>
      ref.read(dangerZoneReportQueueProvider.notifier) == widget.queue;
  Future<void> _save() async {
    if (_saving || !_form.currentState!.validate() || _location == null) return;
    setState(() => _saving = true);
    try {
      if (!_sameAccount) return;
      final captured = DateTime.parse(_location!['capturedAt'] as String);
      if (DateTime.now().difference(captured).abs() >
          const Duration(seconds: 30)) {
        if (!await _locate()) return;
      }
      if (!mounted || !_sameAccount) return;
      await widget.queue.commit(
        DangerZoneReport(
          tripId: widget.tripId,
          payload: {
            'clientRequestId': newClientUuid(),
            'hazardType': _hazard,
            'severity': _severity,
            'description': _description.text.trim(),
            'observedAt': DateTime.now().toUtc().toIso8601String(),
            'location': Map<String, dynamic>.from(_location!),
          },
        ),
        photos: List.of(_photos),
      );
      if (!mounted || !_sameAccount) return;
      Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.red,
            content: Text(
              'Chưa lưu được báo cáo trên thiết bị. Vui lòng thử lại.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  bool get _canAddPhoto =>
      !_saving && !_picking && _photos.length < dangerReportMaxPhotos;

  @override
  Widget build(BuildContext context) => CtmsScaffold(
    title: 'Báo điểm nguy hiểm',
    body: Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Text(
            widget.tripTitle,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: AppSpacing.lg),
          DropdownButtonFormField<String>(
            initialValue: _hazard,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Loại nguy hiểm'),
            items: [
              for (final e in hazardLabels.entries)
                DropdownMenuItem(value: e.key, child: Text(e.value)),
            ],
            onChanged: _saving ? null : (v) => setState(() => _hazard = v!),
          ),
          const SizedBox(height: AppSpacing.lg),
          DropdownButtonFormField<String>(
            initialValue: _severity,
            decoration: const InputDecoration(labelText: 'Mức độ'),
            items: [
              for (final e in hazardSeverityLabels.entries)
                DropdownMenuItem(value: e.key, child: Text(e.value)),
            ],
            onChanged: _saving ? null : (v) => setState(() => _severity = v!),
          ),
          const SizedBox(height: AppSpacing.lg),
          TextFormField(
            controller: _description,
            maxLines: 4,
            maxLength: 1000,
            enabled: !_saving,
            decoration: const InputDecoration(labelText: 'Mô tả tình huống'),
            validator: (v) => v == null || v.trim().isEmpty
                ? 'Vui lòng mô tả điểm nguy hiểm.'
                : null,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Ảnh hiện trường (${_photos.length}/$dangerReportMaxPhotos)',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: AppSpacing.sm),
          if (_photos.isNotEmpty)
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (var index = 0; index < _photos.length; index++)
                  Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.memory(
                          _photos[index],
                          width: 88,
                          height: 88,
                          fit: BoxFit.cover,
                          semanticLabel: 'Ảnh hiện trường ${index + 1}',
                        ),
                      ),
                      Positioned(
                        top: 0,
                        right: 0,
                        child: IconButton.filledTonal(
                          visualDensity: VisualDensity.compact,
                          tooltip: 'Xóa ảnh ${index + 1}',
                          onPressed: _saving
                              ? null
                              : () => setState(() => _photos.removeAt(index)),
                          icon: const Icon(Icons.close, size: 18),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          Wrap(
            spacing: AppSpacing.sm,
            children: [
              TextButton.icon(
                onPressed: _canAddPhoto
                    ? () => _pickPhoto(ImageSource.camera)
                    : null,
                icon: const Icon(Icons.photo_camera_outlined),
                label: const Text('Chụp ảnh'),
              ),
              TextButton.icon(
                onPressed: _canAddPhoto
                    ? () => _pickPhoto(ImageSource.gallery)
                    : null,
                icon: const Icon(Icons.photo_library_outlined),
                label: const Text('Chọn ảnh'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Vị trí ghi nhận',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          if (_location case final fix?)
            Text(
              '${(fix['latitude'] as num).toStringAsFixed(5)}, ${(fix['longitude'] as num).toStringAsFixed(5)} · Sai số ${(fix['accuracyMeters'] as num).round()} m',
            ),
          if (_gpsError != null)
            Text(
              _gpsError!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          TextButton.icon(
            onPressed: _locating || _saving ? null : _locate,
            icon: const Icon(Icons.my_location),
            label: Text(_locating ? 'Đang lấy GPS…' : 'Lấy lại GPS'),
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton(
            onPressed: _saving || _locating || _location == null ? null : _save,
            child: Text(
              _saving
                  ? (_locating ? 'Đang lấy lại GPS…' : 'Đang lưu…')
                  : 'Gửi báo cáo',
            ),
          ),
        ],
      ),
    ),
  );
}
