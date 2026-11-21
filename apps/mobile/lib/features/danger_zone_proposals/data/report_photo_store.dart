import 'dart:typed_data';

import 'report_photo_store_io.dart'
    if (dart.library.js_interop) 'report_photo_store_web.dart'
    as platform;

/// Report photos are binary and large, so they live outside the secure key-value store:
/// IndexedDB on the web and private application files on Android/iOS.
abstract interface class ReportPhotoStore {
  Future<void> put(String key, Uint8List bytes);
  Future<Uint8List?> get(String key);
  Future<void> delete(String key);

  factory ReportPhotoStore.platform() => platform.createReportPhotoStore();
}

/// Used by tests and as a safe fallback; contents do not survive a restart.
class MemoryReportPhotoStore implements ReportPhotoStore {
  final Map<String, Uint8List> _photos = {};

  @override
  Future<void> put(String key, Uint8List bytes) async => _photos[key] = bytes;

  @override
  Future<Uint8List?> get(String key) async => _photos[key];

  @override
  Future<void> delete(String key) async => _photos.remove(key);
}
