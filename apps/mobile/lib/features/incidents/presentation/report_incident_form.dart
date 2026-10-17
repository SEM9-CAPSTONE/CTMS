import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
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
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
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
      // An unavailable device fix stays null; never fabricate coordinates.
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
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'Chưa lưu được sự cố. Kiểm tra bộ nhớ và quyền phân công rồi thử lại.',
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_saving,
    child: Scaffold(
      appBar: AppBar(title: const Text('Báo cáo sự cố')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              widget.trip.title,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _category,
              decoration: const InputDecoration(labelText: 'Loại sự cố'),
              items: incidentCategories.entries
                  .map(
                    (v) => DropdownMenuItem(value: v.key, child: Text(v.value)),
                  )
                  .toList(),
              onChanged: _saving ? null : (v) => setState(() => _category = v!),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _severity,
              decoration: const InputDecoration(labelText: 'Mức độ'),
              items: incidentSeverities.entries
                  .map(
                    (v) => DropdownMenuItem(value: v.key, child: Text(v.value)),
                  )
                  .toList(),
              onChanged: _saving ? null : (v) => setState(() => _severity = v!),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _description,
              maxLines: 4,
              maxLength: incidentDescriptionMaxLength,
              enabled: !_saving,
              decoration: const InputDecoration(labelText: 'Mô tả'),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Nhập mô tả sự cố.' : null,
            ),
            Text('Thời điểm: ${_occurredAt.toLocal()}'),
            const SizedBox(height: 12),
            Text(
              _location == null
                  ? 'Vị trí chưa có. Báo cáo sẽ ghi nhận vị trí không khả dụng.'
                  : 'Vị trí: ${_location!['latitude']}, ${_location!['longitude']} (±${_location!['accuracyMeters']} m)',
            ),
            TextButton.icon(
              onPressed: _locating || _saving ? null : _locate,
              icon: const Icon(Icons.my_location),
              label: Text(_locating ? 'Đang lấy vị trí...' : 'Lấy vị trí'),
            ),
            if (_photo != null) ...[
              Image.memory(_photo!, height: 160, fit: BoxFit.contain),
              TextButton(
                onPressed: _saving ? null : () => setState(() => _photo = null),
                child: const Text('Bỏ ảnh'),
              ),
            ],
            OutlinedButton.icon(
              onPressed: _saving ? null : _pickPhoto,
              icon: const Icon(Icons.photo_outlined),
              label: const Text('Ảnh (không bắt buộc)'),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _saving || _locating ? null : _save,
              child: Text(_saving ? 'Đang lưu...' : 'Lưu sự cố trên thiết bị'),
            ),
          ],
        ),
      ),
    ),
  );
}
