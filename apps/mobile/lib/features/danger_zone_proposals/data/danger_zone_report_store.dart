import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/danger_zone_report.dart';
import 'report_photo_store.dart';

/// Serialized durable writes shared across account changes; errors must reach the form.
class DangerZoneReportStore {
  DangerZoneReportStore([
    this.storage = const FlutterSecureStorage(),
    ReportPhotoStore? photos,
  ]) : photos = photos ?? ReportPhotoStore.platform();
  final FlutterSecureStorage storage;
  final ReportPhotoStore photos;
  Future<void> _writes = Future.value();
  Future<T> _serial<T>(Future<T> Function() action) {
    final result = _writes.then((_) => action());
    _writes = result.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return result;
  }

  Future<List<DangerZoneReport>> _read(String account) async {
    final raw = await storage.read(key: 'dangerZoneReports:$account');
    if (raw == null) return [];
    return (jsonDecode(raw) as List)
        .map(
          (v) => DangerZoneReport.fromJson(Map<String, dynamic>.from(v as Map)),
        )
        .toList();
  }

  Future<List<DangerZoneReport>> read(String account) =>
      _serial(() => _read(account));
  Future<void> put(String account, DangerZoneReport report) =>
      _serial(() async {
        final rows = await _read(account);
        final next = [...rows.where((v) => v.id != report.id), report];
        await storage.write(
          key: 'dangerZoneReports:$account',
          value: jsonEncode(next.map((v) => v.toJson()).toList()),
        );
      });

  static const _legacyPhotoPrefix = 'dangerZoneReportPhoto:';
  static const _legacyCleanupKey = 'dangerZoneReportPhotoCleanup:v1';

  /// Earlier builds kept photos in secure storage, which fills the web localStorage quota.
  /// Moves any such photo into [photos] once, then frees the secure-storage entry.
  Future<void> moveLegacyPhotos() => _serial(() async {
    if (await storage.read(key: _legacyCleanupKey) != null) return;
    final entries = Map.of(await storage.readAll());
    for (final entry in entries.entries) {
      if (!entry.key.startsWith(_legacyPhotoPrefix)) continue;
      try {
        await photos.put(
          entry.key.substring(_legacyPhotoPrefix.length),
          base64Decode(entry.value),
        );
      } catch (_) {
        // An unreadable leftover is only freed; its report reports the missing photo.
      }
      await storage.delete(key: entry.key);
    }
    await storage.write(key: _legacyCleanupKey, value: 'done');
  });

  String _photoKey(String account, String reportId, int index) =>
      '$account:$reportId:$index';

  /// Saves every photo before the report itself, so a stored report never lacks its photos.
  Future<void> putPhotos(
    String account,
    String reportId,
    List<Uint8List> list,
  ) async {
    for (var index = 0; index < list.length; index++) {
      await photos.put(_photoKey(account, reportId, index), list[index]);
    }
  }

  Future<Uint8List?> readPhoto(String account, String reportId, int index) =>
      photos.get(_photoKey(account, reportId, index));

  Future<void> deletePhoto(String account, String reportId, int index) =>
      photos.delete(_photoKey(account, reportId, index));
}

final dangerZoneReportStoreProvider = Provider(
  (ref) => DangerZoneReportStore(),
);
